const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

// Set path ffMpeg dari ffmpeg-static
ffmpeg.setFfmpegPath(ffmpegPath);


/**
 * 1. FUNGSI KONVERSI: PCM (Discord Raw) ke WAV
 * @param {string} pcmPath - Path file .pcm mentah
 * @return {Promise<string>} - Path file .wav hasil konversi
 */
function convertPcmToWav(pcmPath) {
    return new Promise((resolve, reject) => {
        const wavPath = pcmPath.replace('.pcm', '.wav');

        ffmpeg()
            .input(pcmPath)
            .inputOptions([
                '-f s16le',      // Format PCM 16-bit Signed Little-Endian (Standar Discord/Prism)
                '-ar 48000',     // Sample Rate 48kHz (Standar input Discord)
                '-ac 2'          // 2 Channels (Stereo input dari Discord)
            ])
            .output(wavPath)
            .audioFrequency(32000) // Naikkan ke 32kHz (Suara tetap jernih/bagus, jauh lebih ringan dari 48kHz)
            .audioChannels(1)      // Ubah ke Mono (Wajib untuk STT agar akurat & ringan)
            .audioCodec('pcm_s16le') // Gunakan codec PCM 16-bit standar uncompressed yang stabil
            .on('end', () => {
                // Hapus file PCM asli untuk menghemat ruang penyimpanan
                fs.unlink(pcmPath, (err) => {
                    if (err) console.error('Gagal menghapus file PCM temporary:', err);
                });
                resolve(wavPath);
            })
            .on('error', (err) => {
                reject(err);
            })
            .run();
    });
}

//  get MOM from trascrip
async function get_traslete(phat_file) {
    const URL = "http://127.0.0.1:8000/traslate-audio";
    const from_Data = new FormData();
    from_Data.append('file', fs.createReadStream(phat_file));

    try {
        const response = await axios.post(URL, from_Data, {
            headers: {
                ...from_Data.getHeaders(),
            },
        });

        if (response.status !== 200) {
            return '';
        }

        return response.data;

    } catch (error) {
        console.error("Gagal mengirim audio ke FastAPI:", error.response?.data || error.message);
        return '';
    } finally {
        // Pastikan file WAV selalu dibersihkan terlepas dari sukses atau gagal
        if (fs.existsSync(phat_file)) {
            fs.unlink(phat_file, (err) => {
                if (err) console.error('Gagal menghapus file WAV temporary:', err);
            });
        }
    }
}

module.exports = {
    convertPcmToWav,
    get_traslete
};