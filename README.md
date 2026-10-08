# Discord Auto Translate Voice Bot

Bot Discord berbasis Node.js yang otomatis masuk ke voice channel, menangkap audio pengguna, mengirimkannya ke server translate/STT, lalu menampilkan hasil transkripsi ke text channel Discord.

Proyek ini dibuat untuk kebutuhan auto translate voice-to-text di Discord, misalnya untuk meeting, live chat, voice room, atau komunitas yang ingin menerjemahkan percakapan secara real-time.

---

## Fitur utama

- Bergabung ke voice channel Discord dan mendengarkan audio user secara real-time
- Menangkap stream audio dari Discord dalam format PCM
- Mengubah file audio dari PCM ke WAV agar lebih siap diproses
- Mengirim audio ke endpoint FastAPI atau server translate
- Menampilkan hasil transkripsi/terjemahan ke channel text Discord
- Mendukung filter user tertentu dengan perintah `!only`
- Bisa dipakai untuk kebutuhan voice-to-text dan auto translate sederhana

---

## Struktur proyek

```text
agent-Discord-auto-traslet/
├── Tools/
│   └── servicetts.js      # Konversi PCM ke WAV dan kirim audio ke server translate
├── recordings/            # Folder sementara untuk penyimpanan file audio
├── .env                   # Token Discord dan konfigurasi rahasia
├── .gitignore             # File yang diabaikan Git
├── index.js               # Bot utama Discord
├── package.json           # Dependensi dan script project
├── README.md              # Dokumentasi project
└── package-lock.json      # Lock file npm
```

---

## Prasyarat

Sebelum menjalankan bot, pastikan sudah ada:

1. Node.js versi 18+
2. Bot Discord yang sudah dibuat di Discord Developer Portal
3. Token Discord valid
4. AI agent untuk translate/STT yang berjalan lokal di endpoint berikut:

```text
http://127.0.0.1:8000/traslate-audio
```

Repo AI agent untuk proses voice-to-text dan translate adalah:

- https://github.com/RezhaIkhwanH/Agent-auto-traslet-CodeAgent

Repo ini adalah repo agent AI yang menangani transkripsi dan terjemahan audio.

Server ini menerima file audio `wav` dan mengembalikan hasil transkripsi/terjemahan.

---

## Instalasi

1. Masuk ke folder project:

```bash
cd agent-Discord-auto-traslet
```

2. Install dependency:

```bash
npm install
```

3. Buat file `.env` di root project dan isi dengan konfigurasi berikut:

```env
DISCORD_TOKEN=your_discord_bot_token_here
```

Contoh:

```env
DISCORD_TOKEN=ODQxMTIzNDU2NzY0MzQxNzI0.GJkL2n.abcxyz
```

> Pastikan token discord tidak dibagikan ke publik.

---

## Menjalankan bot

Jalankan perintah berikut:

```bash
npm start
```

Jika ingin mode development / auto reload:

```bash
npm run dev
```

Saat bot berhasil login, terminal biasanya akan menampilkan seperti ini:

```text
🤖 Bot MOM online sebagai: NamaBot#1234
```

---

## Perintah bot

Di Discord, gunakan command berikut:

```text
!translator-join
```

Perintah ini akan membuat bot masuk ke voice channel tempat Anda berada.

```text
!leave
```

Perintah ini akan membuat bot keluar dari voice channel.

```text
!only @username
```

Perintah ini akan membatasi proses translate hanya untuk user tertentu. Jika dikirim tanpa mention, filter akan direset.

Contoh:

```text
!only @Rafi
```

---

## Alur kerja bot

1. Bot masuk ke voice channel menggunakan `joinVoiceChannel`
2. Bot mendengarkan stream audio user yang sedang berbicara
3. Audio dipotong dan disimpan sementara sebagai file PCM
4. File PCM dikonversi ke WAV dengan FFmpeg
5. File WAV dikirim ke server translate AI agent di `http://127.0.0.1:8000/traslate-audio`
6. Hasil transkripsi/terjemahan dikirim ke channel Discord yang aktif

Repo AI agent yang dipakai adalah:
https://github.com/RezhaIkhwanH/Agent-auto-traslet-CodeAgent

Ini repo agent AI-nya yang bertugas untuk mengubah voice ke teks dan translate.

---

## Catatan penting

- Bot hanya akan memproses audio jika user sedang berbicara dan ada suara yang valid
- Jika server translate tidak aktif atau endpoint gagal, bot tidak akan menghasilkan teks
- File audio sementara di folder `recordings/` akan dibersihkan setelah diproses
- Pastikan bot memiliki izin untuk masuk ke voice channel dan mem-proses audio

---

## Lisensi

Project ini dibuat untuk kebutuhan personal / prototype dan bisa dikembangkan lebih lanjut sesuai kebutuhan Anda.

---

## Tips penggunaan

- Gunakan bot di server Discord dengan channel voice yang jelas
- Pastikan perangkat mikrofonnya berfungsi dengan baik
- Jika hasil transkripsi tidak akurat, cek kualitas audio dan endpoint server translate
- Untuk kebutuhan multi-language, sesuaikan server translate yang dipakai

---

## Sumber referensi utama

- Discord.js
- @discordjs/voice
- FFmpeg
- FastAPI / server translate endpoint

Jika Anda mau, saya juga bisa bantu bikin versi README yang lebih profesional untuk GitHub, termasuk banner, install step yang lebih rapi, dan contoh `.env` plus struktur project yang lebih lengkap.
