# Web Reader Al-Quran — Rencana Implementasi

## Context

Membangun web reader Al-Quran di `D:/workspace/quranku` (saat ini kosong) dengan data dari API gratis **equran.id v2** (sumber: Kemenag RI). Tanpa API key, tanpa backend, tanpa build step: HTML/CSS/JS vanilla yang langsung jalan di browser. Fitur MVP: daftar surat, baca per surat (teks Arab + transliterasi latin + terjemah Indonesia), tafsir Kemenag per ayat, bookmark ayat, dan posisi terakhir dibaca — semuanya tersimpan di localStorage. Deploy menyusul; desain statis-siap (bisa dibuka via double-click `index.html` maupun di-host apa adanya).

Fakta API terverifikasi langsung hari ini (bukan asumsi):

- `GET https://equran.id/api/v2/surat` → `{code, message, data: [...]}`, `data` array 114 objek: `nomor, nama (Arab), namaLatin, jumlahAyat, tempatTurun, arti, deskripsi (string HTML: <i>, <br>), audioFull`.
- `GET https://equran.id/api/v2/surat/{n}` → `data` objek surat + `data.ayat[]`: `nomorAyat, teksArab, teksLatin, teksIndonesia` + `suratSelanjutnya`/`suratSebelumnya` (objek atau `false`).
- `GET https://equran.id/api/v2/tafsir/{n}` → `data` objek surat + `data.tafsir[]`: `ayat, teks` (teks polos panjang, banyak `\n`).
- Header: `access-control-allow-origin: *`, method GET/OPTIONS/HEAD. Surat tak valid → HTTP 404.
- Bentuk response di atas sudah diambil dan dilihat langsung; jangan diverifikasi ulang.

## Approach

Aturan menyeluruh:

- API base: `const API = "https://equran.id/api/v2"` di `app.js`.
- **`app.js` WAJIB script klasik biasa (`<script src="app.js" defer>`), BUKAN `type="module"`** — ES module diblokir CORS saat dibuka via `file://`, yang mematikan mode "double-click index.html".
- Routing hash: `#/` = daftar surat; `#/surat/{n}` = baca surat; `#/surat/{n}/{ayat}` = baca + scroll ke ayat; `#/bookmark` = daftar bookmark. Router: satu listener `window.addEventListener("hashchange", render)` yang mem-parse `location.hash` lalu memanggil view yang sesuai. URL tak dikenal → arahkan ke `#/`.
- Cache in-memory per sesi (variabel module-level): `Map` untuk detail surat (`key: nomor`) dan tafsir (`key: nomor`), plus satu variabel untuk daftar surat. Tanpa cache localStorage untuk data Al-Quran (tidak diminta; cukup fetch on-demand).
- Semua string dari API dirender aman: `deskripsi` (HTML kecil `<i>`/`<br>` dari equran.id) dirender via `innerHTML` apa adanya — sumber dipercaya karena seluruh aplikasi menampilkan data dari sumber ini; semua string lain (`teksArab`, `teksLatin`, `teksIndonesia`, `teks` tafsir, `namaLatin`) dirender via `textContent`. Tafsir: `textContent` + CSS `white-space: pre-line` agar `\n` tampil sebagai baris. Jangan pernah merender input pengguna sama sekali (tidak ada input bebas selain input pencarian yang tidak ada di scope).
- Fetch gagal (offline/API mati) di setiap view: tampilkan blok pesan "Gagal memuat data. Periksa koneksi internet." + tombol "Coba lagi" yang memanggil ulang fungsi render view itu. `res.ok === false` atau `code !== 200` dianggap gagal.
- HTML `<html lang="id">`; teks Arab dikemas `<p class="arab" dir="rtl" lang="ar">`.
- Font Arab: link Google Fonts (`Amiri`, dengan fallback `Scheherazade New, "Traditional Arabic", serif` di CSS). Online saja — konsisten dengan fakta bahwa data juga dari internet.
- Tema: terang/gelap otomatis via `@media (prefers-color-scheme: dark)`, CSS variables (`--bg, --fg, --muted, --border, --card`), mobile-first, lebar konten maksimal ~48rem.
- UI berbahasa Indonesia.

### Langkah 1 — Rangka: index.html, style.css, router, daftar surat

Buat `index.html` (judul "Al-Quran Reader", link font Google, `<link rel="stylesheet" href="style.css">`, `<header>` berisi judul + link nav "Daftar Surat" (`#/`) dan "Bookmark" (`#/bookmark`), `<main id="app">`, `<script src="app.js" defer>`), `style.css` (variabel tema, layout daftar, tombol, kartu ayat, modal — gaya dipakai langkah berikut), dan `app.js` dengan router hash + view daftar surat.

View daftar surat (`#/`): fetch `API + "/surat"` sekali, simpan ke variabel module-level; render 114 baris — nomor urut dalam badge, `namaLatin`, `arti`, `jumlahAyat ayat`, dan `nama` (Arab, dir=rtl). Setiap baris adalah `<a href="#/surat/{nomor}">`. Pesan "Memuat..." selama fetch.

### Langkah 2 — View baca surat

`renderSurat(n)`: ambil dari cache Map atau fetch `API + "/surat/" + n` (404 → pesan "Surat tidak ditemukan." + link kembali ke `#/`). Tampilkan header surat (nama Latin, arti, tempat turun, jumlah ayat, `deskripsi` via innerHTML) lalu daftar ayat. Per ayat, satu `<article class="ayat" id="ayat-{nomorAyat}">` berisi:

1. `<p class="arab" dir="rtl" lang="ar">` → `teksArab`
2. `<p class="latin">` → `teksLatin`
3. `<p class="terjemah">` → `teksIndonesia`
4. baris tombol kecil: **Tafsir** (`data-tafsir="{nomorAyat}"`) dan **Bookmark ☆/★** (`data-bookmark="{nomorAyat}"`) — penanganan di langkah 3 & 4; di langkah 2 tombol sudah dirender dengan benar.

Navigasi: tombol/link "← Surat Sebelumnya" dan "Surat Berikutnya →" dari `suratSebelumnya`/`suratSelanjutnya` (objek → link `#/surat/{nomor}`, `false` → disembunyikan), plus link "↑ Daftar Surat". Route `#/surat/{n}/{ayat}`: setelah render, `scrollIntoView()` elemen `#ayat-{ayat}` (jika tidak ada, cukup ke atas).

Validasi route: `n` harus integer 1–114 dan `jumlahAyat` cocok dengan panjang `ayat[]` (kalau tidak, anggap surat tidak ditemukan).

### Langkah 3 — Tafsir per ayat (modal)

Satu `<dialog id="tafsir-dialog">` global di `index.html` (judul: "Tafsir {namaLatin} ayat {n}", isi teks, tombol close). Delegasi satu event listener di `#app` untuk klik `[data-tafsir]`: ambil surat dari cache, lalu cache tafsir atau fetch `API + "/tafsir/" + nomorSurat`; cari `data.tafsir.find(t => t.ayat === n)`; tidak ketemu → isi "Tafsir tidak tersedia." `dialog.showModal()`. Teks via `textContent` + class `pre-line`. Selama fetch tafsir: tulis "Memuat tafsir..." di dialog.

### Langkah 4 — Bookmark + posisi terakhir

Kunci localStorage (nilai selalu JSON):

- `"quran:bookmark"` → array objek `{nomor, nomorAyat, namaLatin}` (unik per `nomor:nomorAyat`; `namaLatin` disimpan saat supaya halaman bookmark tak perlu fetch surat).
- `"quran:terakhir"` → `{nomor, nomorAyat, namaLatin}`.

Delegasi klik `[data-bookmark]`: toggle ke/dari array, tulis localStorage, perbarui label tombol (☆/★) langsung tanpa re-render penuh; localStorage penuh/privasi-mode error → `try/catch` dan abaikan (jangan crash).

View `#/bookmark`: baca `quran:bookmark`, render daftar link `#/surat/{nomor}/{nomorAyat}` per item (teks: "{namaLatin} — Ayat {n}") + tombol "Hapus" per item. Kosong → pesan "Belum ada bookmark."

Posisi terakhir: di view surat, pasang `IntersectionObserver` pada semua `article.ayat` dengan `rootMargin: "-10% 0px -85% 0px"`; saat ayat terlihat di pita atas, tulis `quran:terakhir` (ganti, bukan tambah). Hanya menyimpan; tampilan "Lanjutkan membaca: {namaLatin} — Ayat {n} →" (link `#/surat/{nomor}/{nomorAyat}`) ditampilkan di **daftar surat** (`#/`) di atas daftar, jika `quran:terakhir` ada. Observer dipasang ulang setiap render surat; view lain tak perlu melepas observer lama (observer lama kehilangan target saat DOM diganti).

### Urutan & ketergantungan

Langkah 1 → 2 → 3 → 4 berurutan; setelah tiap langkah aplikasi tetap berfungsi penuh untuk fitur yang sudah ada. Tidak ada langkah yang saling mandiri — semua di 3 file yang sama.

## Critical files & anchors

- `app.js` (baru) — semua logika: konstanta `API`, cache (`surahList`, `Map` detail/tafsir), `router()` pada `hashchange`, `renderDaftar()`, `renderSurat(n, ayat?)`, `renderBookmark()`, handler delegasi `[data-tafsir]`/`[data-bookmark]`, helper `getBookmarks()/setLastRead()`.
- `index.html` (baru) — `<dialog id="tafsir-dialog">` dan `<main id="app">`; script klasik (bukan module).
- `style.css` (baru) — `.arab` (font Amiri, ukuran ~1.8rem, line-height lebar), `.ayat`, `.latin`, `.terjemah`, `dialog`, tema dark via media query.

(Cuma 3 file; daftar di atas untuk menjaga implementer tidak salah pada dua jebakan: `type="module"` dan struktur respons API.)

## Verification

Prasyarat: tidak perlu install apa pun; cukup browser. Buka `D:/workspace/quranku/index.html` dengan double-click (mode file:// — sengaja, membuktikan CORS aman).

1. **Daftar surat**: buka `index.html` → 114 baris tampil, urut 1–114; baris 1 = "Al-Fatihah — Pembukaan — 7 ayat" + الفاتحة. (Membuktikan fetch `/surat` + render.)
2. **Baca surat**: klik Al-Fatihah → URL `#/surat/1`; ayat 1 menampilkan teks Arab بِسْمِ اللّٰهِ..., latin "Bismillāhir-raḥmānir-raḥīm(i).", terjemah "Dengan nama Allah Yang Maha Pengasih lagi Maha Penyayang."; tombol "Surat Sebelumnya" tidak ada, "Surat Berikutnya →" mengarah ke `#/surat/2`. (Fetch `/surat/1`, RTL, navigasi.)
3. **Deep-link ayat**: buka `index.html#/surat/1/5` langsung di address bar → halaman ter-scroll ke ayat 5 (iyāka naʿbudu).
4. **Tafsir**: di `#/surat/1` klik "Tafsir" ayat 1 → dialog terbuka berisi teks tafsir basmalah ("Surah al-Fatihah dimulai dengan Basmalah..."); tutup; klik Tafsir ayat 2 → dialog menampilkan tafsir ayat 2 (bukan ayat 1 — membuktikan lookup by nomor, bukan indeks pertama).
5. **Bookmark**: klik ☆ di ayat 3 Al-Fatihah → berubah ★; buka `#/bookmark` → item "Al-Fatihah — Ayat 3" ada; reload halaman → masih ada (localStorage persist); klik "Hapus" → item hilang.
6. **Posisi terakhir**: di `#/surat/2` (Al-Baqarah) scroll ke ayat 10, tunggu 1 detik, kembali ke `#/` → banner "Lanjutkan membaca: Al-Baqarah — Ayat 10" muncul; klik → kembali tepat ke ayat 10 Al-Baqarah.
7. **Error path**: DevTools → Network → Offline, lalu buka `#/surat/5` → tampil "Gagal memuat data. Periksa koneksi internet." + "Coba lagi"; kembalikan Online, klik "Coba lagi" → surat Al-Ma'idah termuat.
8. **Mode gelap**: aktifkan preferensi dark OS → latar gelap, teks terang, teks Arab tetap terbaca.

## Assumptions

- Data Al-Quran di-fetch on-demand per surat tanpa cache offline (diminta "diambil via API"; offline mode di luar scope). Jika kelak perlu offline: tambah Cache API/service worker sebagai langkah terpisah.
- Audio dan pencarian ayat tidak dibuat (tidak dipilih saat diskusi fitur); API sudah menyediakan keduanya bila nanti ditambah.
- Font Amiri dari Google Fonts CDN (butuh internet); fallback font sistem Arab sudah didefinisikan bila CDN gagal.
- equran.id dipercaya sebagai sumber konten (termasuk merender `deskripsi` berformat HTML via innerHTML) — tradeoff disengaja untuk menghindari dependensi sanitizer; semua konten yang dirender berasal dari API ini saja.
