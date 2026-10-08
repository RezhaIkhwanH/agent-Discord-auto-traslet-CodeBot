require('dotenv').config();
const axios = require('axios');
const path = require('path');

const { Client, GatewayIntentBits } = require('discord.js');
const {
    joinVoiceChannel,
    EndBehaviorType,
    VoiceConnectionStatus,
    entersState
} = require('@discordjs/voice');

const { convertPcmToWav, get_traslete } = require('./Tools/servicetts');

const prism = require('prism-media');
const fs = require('fs');

///kode bot

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
    ],
});

// Folder sementara untuk menyimpan rekaman audio
const RECORDINGS_DIR = path.join(__dirname, 'recordings');
if (!fs.existsSync(RECORDINGS_DIR)) {
    fs.mkdirSync(RECORDINGS_DIR);
}

const activeStreams = new Map();
const targetUsers = new Set();


client.once('ready', () => {
    console.log(`🤖 Bot MOM online sebagai: ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    // PERINTAH 1: !join (Bot masuk ke Voice Channel & Mulai Dengar)
    if (message.content.toLowerCase() === '!translator-join') {
        const voiceChannel = message.member?.voice.channel;

        if (!voiceChannel) {
            return message.reply('Kamu harus masuk ke Voice Channel dulu!');
        }

        // Connect ke Voice Channel
        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: voiceChannel.guild.id,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            selfDeaf: false,
            selfMute: true
        });

        try {
            await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
            message.reply(`🎙️ Bot berhasil masuk ke channel **${voiceChannel.name}** dan siap menjadi translator!`);

            // Mulai mendengarkan audio stream
            listenToAudioStream(connection, message.channel);

        } catch (error) {
            console.error(error);
            message.reply('Gagal bergabung ke Voice Channel.');
        }
    }

    // PERINTAH 2: !leave (Bot keluar dari Voice Channel)
    if (message.content === '!leave') {
        const { getVoiceConnection } = require('@discordjs/voice');
        const connection = getVoiceConnection(message.guild.id);

        if (!connection) {
            return message.reply('Bot sedang tidak ada di Voice Channel manapun.');
        }

        connection.destroy();
        message.reply('👋 Bot telah keluar dari Voice Channel senang menjadi penerjemah anda.');


    }

    // PERINTAH 3: !only (Filter hanya user tertentu yang diproses)
    if (message.content.toLowerCase().startsWith('!only')) {
        const mentions = message.mentions.users;
        if (mentions.size > 0) {
            targetUsers.clear();
            mentions.forEach(user => targetUsers.add(user.id));
            const userNames = Array.from(mentions.values()).map(u => `**${u.username}**`).join(', ');
            return message.reply(`🎯 **Filter Aktif!** Hanya suara dari ${userNames} yang akan diterjemahkan.`);
        } else {
            targetUsers.clear();
            return message.reply('🔄 **Filter Reset!** Sekarang suara semua member di voice channel akan diterjemahkan.');
        }
    }
});





// FUNGSI UTAMA: Menangkap Audio Stream per User
function listenToAudioStream(connection, textChannel) {
    const receiver = connection.receiver;

    receiver.speaking.on('start', async (userId) => {
        // Cek jika filter targetUsers aktif dan userId tidak masuk daftar target, langsung skip!
        if (targetUsers.size > 0 && !targetUsers.has(userId)) {
            return;
        }

        if (activeStreams.has(userId)) return;
        activeStreams.set(userId, true);

        // Ambil data user (gunakan await client.users.fetch agar aman jika cache kosong)
        let username = userId;
        try {
            const user = await client.users.fetch(userId);
            if (user) username = user.username;
        } catch (e) {
            console.warn(`Gagal mengambil data user untuk ID ${userId}`);
        }

        const startTime = new Date();
        const formattedTime = startTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        console.log(`🗣️ ${username} mulai berbicara...`);

        // Ambil audio stream pengguna
        const opusStream = receiver.subscribe(userId, {
            end: {
                behavior: EndBehaviorType.AfterSilence,
                duration: 1200,
            },
        });

        opusStream.on('error', (err) => {
            console.warn(`⚠️ Warning pada opusStream ${username}:`, err.message);
            activeStreams.delete(userId);
        });

        const opusDecoder = new prism.opus.Decoder({ frameSize: 960, channels: 2, rate: 48000 });

        opusDecoder.on('error', (err) => {
            console.warn(`⚠️ Warning decoder Opus ${username} (diabaikan):`, err.message);
            activeStreams.delete(userId);
        });

        const filename = path.join(RECORDINGS_DIR, `${Date.now()}_${userId}.pcm`);
        const outStream = fs.createWriteStream(filename);

        outStream.on('error', (err) => {
            console.error(`❌ Gagal menulis file PCM untuk ${username}:`, err.message);
            activeStreams.delete(userId);
        });

        opusStream.pipe(opusDecoder).pipe(outStream);

        outStream.on('finish', async () => {
            console.log(`💾 Rekaman audio dari ${username} tersimpan di: ${filename}`);
            activeStreams.delete(userId);
            try {
                if (!fs.existsSync(filename)) return;
                const stats = fs.statSync(filename);
                if (stats.size === 0) {
                    console.log(`⚠️ File PCM kosong untuk ${username}, melewati transkripsi.`);
                    fs.unlinkSync(filename);
                    return;
                }

                // ==========================================
                // 1. ANALISIS AUDIO LENGKAP (VAD & NOISE FILTER)
                // ==========================================
                const pcmBuffer = fs.readFileSync(filename);

                // Decoder Discord output PCM 16-bit Stereo 48kHz (192,000 bytes/detik)
                const BYTES_PER_SECOND = 48000 * 2 * 2;
                const durationInSeconds = pcmBuffer.length / BYTES_PER_SECOND;

                if (durationInSeconds < 1.0) { // Kurang dari 1.0 detik durasi asli
                    console.log(`⚠️ Audio terlalu pendek (${durationInSeconds.toFixed(2)}s) untuk ${username}, melewati transkripsi.`);
                    fs.unlinkSync(filename);
                    return;
                }

                // Hitung RMS, Peak Amplitude, Crest Factor, dan Voice Activity (VAD)
                const analysis = analyzeAudioPcm(pcmBuffer);

                // A. Pengecekan Volume / Noise Dasar (RMS Threshold)
                const VOLUME_THRESHOLD = 0.02; // Naikkan sensitivitas dari 0.01 ke 0.02 agar desah napas & noise halus terfilter
                if (analysis.overallRms < VOLUME_THRESHOLD) {
                    console.log(`⚠️ Suara terlalu kecil/hanya noise (RMS: ${analysis.overallRms.toFixed(4)}) untuk ${username}, melewati transkripsi.`);
                    fs.unlinkSync(filename);
                    return;
                }

                // B. Pengecekan Bersiul / Nada Murni (Crest Factor)
                // Bersiul / nada murni memiliki rasio Peak / RMS sangat rendah (sekitar 1.4 - 1.8)
                // Suara manusia berbicara memiliki variasi dinamika tinggi (Crest Factor > 1.95)
                if (analysis.crestFactor < 1.8) {
                    console.log(`⚠️ Deteksi nada murni/noise/dengung (Crest Factor: ${analysis.crestFactor.toFixed(2)}) untuk ${username}, melewati transkripsi.`);
                    fs.unlinkSync(filename);
                    return;
                }

                // C. Pengecekan Durasi Suara Aktif (VAD)
                // Memastikan benar-benar ada ucapan minimal 0.5 detik
                if (analysis.activeSpeechDuration < 0.5 || analysis.activeSpeechRatio < 0.20) {
                    console.log(`⚠️ Tidak cukup ucapan manusia terdeteksi (Durasi Suara Aktif: ${analysis.activeSpeechDuration.toFixed(2)}s / ${Math.round(analysis.activeSpeechRatio * 100)}%) untuk ${username}, melewati transkripsi.`);
                    fs.unlinkSync(filename);
                    return;
                }

                // ==========================================
                // PROSES LANJUTAN JIKA LOLOS PENGECEKAN
                // ==========================================
                const file_path = await convertPcmToWav(filename);
                const traslate_data = await get_traslete(file_path);

                if (!traslate_data || !traslate_data.bahasa_awal) {
                    console.log(`⚠️ Tidak ada respon transkripsi valid dari server STT untuk ${username}.`);
                    return;
                }

                const bahasa_awal = traslate_data.bahasa_awal.toLowerCase();

                if (traslate_data.traslate && traslate_data.traslate.length !== 0 && !['indonesian', 'indonesia'].includes(bahasa_awal)) {
                    textChannel.send(`**${username}** : ${formattedTime} | ${traslate_data.traslate}`);
                } else {
                    console.log(`**${username}** : ${formattedTime} | ${traslate_data.bahasa_awal}`);
                }

            } catch (error) {
                console.log(`Terjadi kesalahan pada proses transkripsi ${username}:`, error);
            } finally {
                // Pastikan file temporary juga dibersihkan jika ada error di tengah jalan
                if (fs.existsSync(filename)) {
                    fs.unlinkSync(filename);
                }
                console.log(`🔓 Kunci dilepas untuk ${username}, siap mendengarkan kembali.`);
            }
        });
    });
}

/**
 * Analisis PCM Audio (48kHz, 16-bit LE, Stereo)
 * Mengukur RMS, Crest Factor (Filter Bersiul), dan Voice Activity (VAD)
 */
function analyzeAudioPcm(pcmBuffer) {
    const BYTES_PER_FRAME = 4; // 16-bit (2 bytes) * 2 channels (Stereo)
    const totalSamples = Math.floor(pcmBuffer.length / BYTES_PER_FRAME);
    if (totalSamples === 0) return { overallRms: 0, maxPeak: 0, crestFactor: 0, activeSpeechDuration: 0, activeSpeechRatio: 0 };

    let sumSquares = 0;
    let maxPeak = 0;

    for (let i = 0; i < pcmBuffer.length; i += BYTES_PER_FRAME) {
        const left = pcmBuffer.readInt16LE(i) / 32768;
        const right = pcmBuffer.readInt16LE(i + 2) / 32768;
        const sample = (left + right) / 2;

        const absSample = Math.abs(sample);
        if (absSample > maxPeak) maxPeak = absSample;
        sumSquares += sample * sample;
    }

    const overallRms = Math.sqrt(sumSquares / totalSamples);
    const crestFactor = overallRms > 0 ? maxPeak / overallRms : 0;

    // Frame-by-frame VAD (Per frame 20ms = 48000 * 0.02 * 4 bytes = 3840 bytes)
    const FRAME_SIZE_BYTES = 3840;
    let activeFrames = 0;
    let total20msFrames = 0;

    for (let offset = 0; offset + FRAME_SIZE_BYTES <= pcmBuffer.length; offset += FRAME_SIZE_BYTES) {
        let frameSum = 0;
        const numSamples = FRAME_SIZE_BYTES / 4;
        for (let i = 0; i < FRAME_SIZE_BYTES; i += 4) {
            const left = pcmBuffer.readInt16LE(offset + i) / 32768;
            const right = pcmBuffer.readInt16LE(offset + i + 2) / 32768;
            const sample = (left + right) / 2;
            frameSum += sample * sample;
        }
        const frameRms = Math.sqrt(frameSum / numSamples);
        total20msFrames++;
        if (frameRms > 0.025) {
            activeFrames++;
        }
    }

    const activeSpeechDuration = activeFrames * 0.02;
    const activeSpeechRatio = total20msFrames > 0 ? activeFrames / total20msFrames : 0;

    return {
        overallRms,
        maxPeak,
        crestFactor,
        activeSpeechDuration,
        activeSpeechRatio
    };
}

client.login(process.env.DISCORD_TOKEN);    