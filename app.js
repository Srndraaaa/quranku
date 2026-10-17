"use strict";

const API = "https://equran.id/api/v2";
const app = document.getElementById("app");
const tafsirDialog = document.getElementById("tafsir-dialog");
const tafsirJudul = document.getElementById("tafsir-judul");
const tafsirIsi = document.getElementById("tafsir-isi");

let surahList = null;
const surahCache = new Map();
const tafsirCache = new Map();
let activeRender = null; // view aktif, untuk retry "Coba lagi"
let currentSuratNomor = null;

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

function tombol(teks) {
  return el("button", "tombol", teks);
}

function pesanMuat() {
  app.replaceChildren(el("p", "pesan", "Memuat..."));
}

function pesanError() {
  const div = el("div", "pesan error", "Gagal memuat data. Periksa koneksi internet.");
  const btn = tombol("Coba lagi");
  btn.setAttribute("data-coba-lagi", "");
  app.replaceChildren(div, btn);
}

// ---- localStorage helpers (semua dibungkus try/catch) ----

function getBookmarks() {
  try {
    const parsed = JSON.parse(localStorage.getItem("quran:bookmark"));
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function saveBookmarks(list) {
  try {
    localStorage.setItem("quran:bookmark", JSON.stringify(list));
  } catch (e) {
    // localStorage penuh/privasi-mode → abaikan, jangan crash
  }
}

function setLastRead(nomor, nomorAyat, namaLatin) {
  try {
    localStorage.setItem("quran:terakhir", JSON.stringify({ nomor, nomorAyat, namaLatin }));
  } catch (e) {
    // abaikan
  }
}

function getLastRead() {
  try {
    return JSON.parse(localStorage.getItem("quran:terakhir"));
  } catch (e) {
    return null;
  }
}

// ---- Tema (default terang, pilihan disimpan di quran:tema) ----

const tombolTema = document.getElementById("tombol-tema");

function getTema() {
  try {
    return localStorage.getItem("quran:tema") === "dark" ? "dark" : "light";
  } catch (e) {
    return "light";
  }
}

function saveTema(tema) {
  try {
    localStorage.setItem("quran:tema", tema);
  } catch (e) {
    // localStorage penuh/privasi-mode → abaikan, tema tetap berlaku di sesi ini
  }
}

function terapkanTema(tema) {
  const gelap = tema === "dark";
  document.documentElement.dataset.theme = gelap ? "dark" : "light";
  tombolTema.setAttribute("aria-label", gelap ? "Aktifkan mode terang" : "Aktifkan mode gelap");
  tombolTema.setAttribute("aria-pressed", gelap ? "true" : "false");
}

terapkanTema(getTema());

tombolTema.addEventListener("click", function () {
  const tema = getTema() === "dark" ? "light" : "dark";
  saveTema(tema);
  terapkanTema(tema);
});

// ---- Views ----

async function renderDaftar() {
  app.className = "view-daftar";
  activeRender = renderDaftar;
  pesanMuat();
  try {
    if (!surahList) {
      const res = await fetch(API + "/surat");
      const data = await res.json();
      if (res.ok === false || data.code !== 200) throw new Error("bad response");
      surahList = data.data;
    }
    const frag = document.createDocumentFragment();
    const cari = document.createElement("input");
    cari.type = "search";
    cari.id = "cari-surat";
    cari.className = "cari";
    cari.placeholder = "Cari surat…";
    cari.autocomplete = "off";
    cari.setAttribute("aria-label", "Cari surat");
    frag.appendChild(cari);
    const last = getLastRead();
    if (last && last.nomor && last.nomorAyat) {
      const lanjut = el("div", "lanjutkan");
      const a = el("a", "tombol", "Lanjutkan membaca: " + last.namaLatin + " — Ayat " + last.nomorAyat + " →");
      a.href = "#/surat/" + last.nomor + "/" + last.nomorAyat;
      lanjut.appendChild(a);
      frag.appendChild(lanjut);
    }
    const daftar = el("div", "daftar");
    const baris = [];
    for (const s of surahList) {
      const kartu = el("a", "kartu");
      kartu.href = "#/surat/" + s.nomor;
      kartu.appendChild(el("span", "badge", String(s.nomor)));
      kartu.appendChild(el("span", "nama-latin", s.namaLatin));
      const info = el("span", "info");
      info.append(el("span", "arti", s.arti), el("span", "jumlah", s.jumlahAyat + " ayat"));
      kartu.appendChild(info);
      const nama = el("span", "nama", s.nama);
      nama.setAttribute("dir", "rtl");
      nama.setAttribute("lang", "ar");
      kartu.appendChild(nama);
      daftar.appendChild(kartu);
      baris.push({ kartu: kartu, teks: (s.namaLatin + " " + s.arti + " " + s.nama + " " + s.nomor).toLowerCase() });
    }
    frag.appendChild(daftar);

    const kosong = el("p", "cari-kosong pesan", "Tidak ada surat yang cocok.");
    kosong.hidden = true;
    frag.appendChild(kosong);

    // Hide baris per baris (bukan re-render) supaya fokus input tidak hilang.
    cari.addEventListener("input", function () {
      const q = cari.value.trim().toLowerCase();
      let terlihat = 0;
      for (const b of baris) {
        const cocok = q === "" || b.teks.indexOf(q) !== -1;
        b.kartu.hidden = !cocok;
        if (cocok) terlihat++;
      }
      kosong.hidden = terlihat > 0;
    });

    app.replaceChildren(frag);
  } catch (e) {
    pesanError();
  }
}

function renderSuratTidakDitemukan() {
  const div = el("div", "pesan", "Surat tidak ditemukan.");
  const a = el("a", "tombol", "Kembali ke Daftar Surat");
  a.href = "#/";
  app.replaceChildren(div, a);
}

async function renderSurat(n, ayat) {
  app.className = "view-surat";
  currentSuratNomor = null;
  if (!Number.isInteger(n) || n < 1 || n > 114) {
    renderSuratTidakDitemukan();
    return;
  }
  activeRender = function () { renderSurat(n, ayat); };
  pesanMuat();
  try {
    let surat = surahCache.get(n);
    if (!surat) {
      const res = await fetch(API + "/surat/" + n);
      const data = await res.json();
      if (res.ok === false || data.code !== 200) throw new Error("bad response");
      surat = data.data;
      surahCache.set(n, surat);
    }
    if (!surat || !Array.isArray(surat.ayat) || surat.jumlahAyat !== surat.ayat.length) {
      renderSuratTidakDitemukan();
      return;
    }
    currentSuratNomor = surat.nomor;
    const bookmarks = getBookmarks();
    const frag = document.createDocumentFragment();

    const header = document.createElement("header");
    header.className = "surat-header";
    header.appendChild(el("h1", "", surat.namaLatin));
    header.appendChild(el("p", "sub", surat.arti + " · " + surat.tempatTurun + " · " + surat.jumlahAyat + " ayat"));
    const desk = document.createElement("p");
    desk.className = "deskripsi";
    desk.innerHTML = surat.deskripsi; // satu-satunya konten innerHTML (HTML kecil dari equran.id, dipercaya)
    header.appendChild(desk);
    frag.appendChild(header);

    for (const a of surat.ayat) {
      const art = document.createElement("article");
      art.className = "ayat";
      art.id = "ayat-" + a.nomorAyat;
      const sudah = bookmarks.some(function (b) { return b.nomor === surat.nomor && b.nomorAyat === a.nomorAyat; });
      const pArab = el("p", "arab", a.teksArab);
      pArab.setAttribute("dir", "rtl");
      pArab.setAttribute("lang", "ar");
      art.appendChild(pArab);
      art.appendChild(el("p", "latin", a.teksLatin));
      art.appendChild(el("p", "terjemah", a.teksIndonesia));
      const aksi = el("div", "aksi");
      const btnTafsir = tombol("Tafsir");
      btnTafsir.setAttribute("data-tafsir", String(a.nomorAyat));
      aksi.appendChild(btnTafsir);
      const btnBm = tombol(sudah ? "★" : "☆");
      btnBm.setAttribute("data-bookmark", String(a.nomorAyat));
      btnBm.setAttribute("aria-pressed", sudah ? "true" : "false");
      aksi.appendChild(btnBm);
      art.appendChild(aksi);
      frag.appendChild(art);
    }

    const nav = document.createElement("nav");
    nav.className = "surat-nav";
    if (surat.suratSebelumnya) {
      const a = document.createElement("a");
      a.href = "#/surat/" + surat.suratSebelumnya.nomor;
      a.textContent = "← Surat Sebelumnya";
      nav.appendChild(a);
    }
    if (surat.suratSelanjutnya) {
      const a = document.createElement("a");
      a.href = "#/surat/" + surat.suratSelanjutnya.nomor;
      a.textContent = "Surat Berikutnya →";
      nav.appendChild(a);
    }
    const up = document.createElement("a");
    up.href = "#/";
    up.textContent = "↑ Daftar Surat";
    nav.appendChild(up);
    frag.appendChild(nav);

    app.replaceChildren(frag);

    if (ayat !== undefined) {
      const target = document.getElementById("ayat-" + ayat);
      if (target) target.scrollIntoView();
      else window.scrollTo(0, 0);
    } else {
      window.scrollTo(0, 0);
    }

    const observer = new IntersectionObserver(
      function (entries) {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setLastRead(surat.nomor, Number(entry.target.id.replace("ayat-", "")), surat.namaLatin);
          }
        }
      },
      { rootMargin: "-10% 0px -85% 0px" }
    );
    for (const art of app.querySelectorAll("article.ayat")) observer.observe(art);
  } catch (e) {
    pesanError();
  }
}

function renderBookmark() {
  app.className = "view-bookmark";
  activeRender = renderBookmark;
  const list = getBookmarks();
  if (list.length === 0) {
    app.replaceChildren(el("p", "pesan", "Belum ada bookmark."));
    return;
  }
  const daftar = el("div", "daftar");
  for (const b of list) {
    const kartu = el("div", "kartu bookmark");
    const a = document.createElement("a");
    a.href = "#/surat/" + b.nomor + "/" + b.nomorAyat;
    a.textContent = b.namaLatin + " — Ayat " + b.nomorAyat;
    kartu.appendChild(a);
    const btn = tombol("Hapus");
    btn.setAttribute("data-hapus", b.nomor + ":" + b.nomorAyat);
    kartu.appendChild(btn);
    daftar.appendChild(kartu);
  }
  app.replaceChildren(daftar);
}

// ---- Tasbih ----

const DZIKIR = [
  { arab: "سُبْحَانَ اللّٰهِ", latin: "Subhanallah", arti: "Maha Suci Allah", target: 33 },
  { arab: "اَلْحَمْدُ لِلّٰهِ", latin: "Alhamdulillah", arti: "Segala puji bagi Allah", target: 33 },
  { arab: "اَللّٰهُ أَكْبَرُ", latin: "Allahu Akbar", arti: "Allah Maha Besar", target: 34 },
  { arab: "لَا إِلٰهَ إِلَّا اللّٰهُ", latin: "La ilaha illallah", arti: "Tiada tuhan selain Allah", target: 100 }
];

const SVG_NS = "http://www.w3.org/2000/svg";
const TASBIH_R = 54;
const TASBIH_KELILING = 2 * Math.PI * TASBIH_R;

let tasbih = null;       // state hitungan aktif
let tasbihView = null;   // referensi elemen view (untuk pembaruan tanpa rebuild)
let tasbihSelesai = false;

function defaultTasbih() {
  return { dzikir: 0, hitung: 0, target: DZIKIR[0].target, total: [0, 0, 0, 0] };
}

function getTasbih() {
  try {
    const p = JSON.parse(localStorage.getItem("quran:tasbih"));
    if (!p || typeof p !== "object") return defaultTasbih();
    const dzikir = Number.isInteger(p.dzikir) && p.dzikir >= 0 && p.dzikir < DZIKIR.length ? p.dzikir : 0;
    const totalOk = Array.isArray(p.total) && p.total.length === DZIKIR.length &&
      p.total.every(function (t) { return Number.isInteger(t) && t >= 0; });
    return {
      dzikir: dzikir,
      hitung: Number.isInteger(p.hitung) && p.hitung >= 0 ? p.hitung : 0,
      target: Number.isInteger(p.target) && p.target >= 1 ? p.target : DZIKIR[dzikir].target,
      total: totalOk ? p.total.slice() : [0, 0, 0, 0]
    };
  } catch (e) {
    return defaultTasbih();
  }
}

function saveTasbih(s) {
  try {
    localStorage.setItem("quran:tasbih", JSON.stringify({ dzikir: s.dzikir, hitung: s.hitung, target: s.target, total: s.total }));
  } catch (e) {
    // localStorage penuh/privasi-mode → abaikan, hitungan tetap jalan di sesi ini
  }
}

function getar(pola) {
  try {
    navigator.vibrate?.(pola);
  } catch (e) {
    // iOS/tanpa dukungan getar → abaikan
  }
}

// Animasi perayaan singkat; class dilepas dulu supaya animasi bisa dijalankan ulang.
function rayakanTasbih(ui) {
  ui.tombol.classList.remove("rayakan");
  void ui.tombol.offsetWidth;
  ui.tombol.classList.add("rayakan");
}

function gambarTasbih() {
  if (!tasbihView) return;
  const ui = tasbihView;
  const selesai = tasbih.hitung >= tasbih.target;

  ui.root.classList.toggle("selesai", selesai);
  ui.hitung.textContent = String(tasbih.hitung);
  ui.target.textContent = tasbih.hitung + " / " + tasbih.target;
  ui.ring.style.strokeDashoffset = String(TASBIH_KELILING * (1 - Math.min(tasbih.hitung / tasbih.target, 1)));
  ui.pesan.hidden = !selesai;
  ui.lanjut.hidden = !selesai;
  ui.lanjut.textContent = "Lanjut: " + DZIKIR[(tasbih.dzikir + 1) % DZIKIR.length].latin;
  ui.total.textContent = "Total: " + tasbih.total[tasbih.dzikir] + " · Semua dzikir: " +
    tasbih.total.reduce(function (a, b) { return a + b; }, 0);
  ui.tombolDzikir.forEach(function (b, i) {
    b.classList.toggle("aktif", i === tasbih.dzikir);
    b.setAttribute("aria-pressed", i === tasbih.dzikir ? "true" : "false");
  });
  if (document.activeElement !== ui.input) ui.input.value = String(tasbih.target);

  if (selesai && !tasbihSelesai) {
    getar([30, 50, 30]); // sekali per pencapaian
    rayakanTasbih(ui);
  }
  tasbihSelesai = selesai;
}

function renderTasbih() {
  app.className = "view-tasbih";
  tasbih = getTasbih();
  tasbihSelesai = tasbih.hitung >= tasbih.target;

  const root = el("div", "tasbih");

  const grup = el("div", "tasbih-dzikir");
  grup.setAttribute("role", "group");
  grup.setAttribute("aria-label", "Pilih dzikir");
  const tombolDzikir = DZIKIR.map(function (d, i) {
    const b = el("button", "dzikir");
    b.type = "button";
    b.setAttribute("data-dzikir", String(i));
    const arab = el("span", "dzikir-arab", d.arab);
    arab.setAttribute("dir", "rtl");
    arab.setAttribute("lang", "ar");
    b.append(arab, el("span", "dzikir-latin", d.latin), el("span", "dzikir-arti", d.arti));
    grup.appendChild(b);
    return b;
  });

  const panggung = el("div", "tasbih-panggung");
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("class", "tasbih-ring");
  svg.setAttribute("viewBox", "0 0 120 120");
  svg.setAttribute("aria-hidden", "true");
  const lingkar = function (cls) {
    const c = document.createElementNS(SVG_NS, "circle");
    c.setAttribute("class", cls);
    c.setAttribute("cx", "60");
    c.setAttribute("cy", "60");
    c.setAttribute("r", String(TASBIH_R));
    return c;
  };
  const ring = lingkar("ring-isi");
  ring.style.strokeDasharray = String(TASBIH_KELILING);
  svg.append(lingkar("ring-latar"), ring);

  const tombolHitung = el("button", "tasbih-tombol");
  tombolHitung.type = "button";
  tombolHitung.setAttribute("aria-label", "Tambah hitungan");
  const hitung = el("span", "tasbih-hitung");
  hitung.setAttribute("role", "status");
  hitung.setAttribute("aria-live", "polite");
  const target = el("span", "tasbih-target");
  tombolHitung.append(hitung, target);
  tombolHitung.addEventListener("animationend", function () {
    tombolHitung.classList.remove("rayakan");
  });
  panggung.append(svg, tombolHitung);

  const pesan = el("p", "tasbih-pesan", "Target tercapai");
  pesan.setAttribute("role", "status");
  pesan.setAttribute("aria-live", "polite");
  pesan.hidden = true;

  const aksi = el("div", "tasbih-aksi");
  const lanjut = tombol("Lanjut");
  lanjut.setAttribute("data-tasbih-lanjut", "");
  lanjut.hidden = true;
  const reset = tombol("Reset");
  reset.setAttribute("data-tasbih-reset", "");
  const baris = el("label", "tasbih-target-baris", "Target");
  const input = el("input", "tasbih-target-input");
  input.type = "number";
  input.id = "tasbih-target";
  input.setAttribute("min", "1");
  input.setAttribute("step", "1");
  input.setAttribute("inputmode", "numeric");
  input.setAttribute("aria-label", "Target hitungan");
  baris.appendChild(input);
  const hapus = tombol("Hapus total");
  hapus.setAttribute("data-tasbih-hapus-total", "");
  aksi.append(lanjut, reset, baris, hapus);

  const total = el("p", "tasbih-total");

  root.append(grup, panggung, pesan, aksi, total);
  app.replaceChildren(root);

  tasbihView = {
    root: root, hitung: hitung, target: target, ring: ring, pesan: pesan,
    lanjut: lanjut, input: input, total: total, tombolDzikir: tombolDzikir,
    tombol: tombolHitung
  };

  root.addEventListener("click", function (e) {
    if (e.target.closest(".tasbih-tombol")) {
      hitungTasbih();
      return;
    }
    if (e.target.closest("[data-tasbih-lanjut]")) {
      lanjutTasbih();
      return;
    }
    const btn = e.target.closest("[data-dzikir]");
    if (btn) {
      pilihDzikir(parseInt(btn.getAttribute("data-dzikir"), 10));
      return;
    }
    if (e.target.closest("[data-tasbih-reset]")) {
      tasbih.hitung = 0;
      saveTasbih(tasbih);
      gambarTasbih();
      return;
    }
    if (e.target.closest("[data-tasbih-hapus-total]")) {
      tasbih.total = [0, 0, 0, 0];
      tasbih.hitung = 0;
      saveTasbih(tasbih);
      gambarTasbih();
    }
  });

  function terapkanTarget() {
    const v = parseInt(input.value, 10);
    if (Number.isInteger(v) && v >= 1) {
      tasbih.target = v;
      saveTasbih(tasbih);
    }
    gambarTasbih(); // nilai tak wajar → biarkan target lama, field kembali ke nilai tersimpan
  }
  input.addEventListener("input", terapkanTarget);
  input.addEventListener("change", terapkanTarget);

  gambarTasbih();
}

function pindahDzikir(hitungBaru) {
  tasbih.dzikir = (tasbih.dzikir + 1) % DZIKIR.length;
  tasbih.hitung = hitungBaru;
  tasbih.target = DZIKIR[tasbih.dzikir].target;
}

function hitungTasbih() {
  if (tasbih.hitung >= tasbih.target) {
    // tap saat target tercapai sudah dihitung untuk dzikir berikutnya
    pindahDzikir(1);
  } else {
    tasbih.hitung += 1;
  }
  tasbih.total[tasbih.dzikir] += 1;
  getar(15);
  saveTasbih(tasbih);
  gambarTasbih();
}

function lanjutTasbih() {
  pindahDzikir(0); // tombol Lanjut murni pindah dzikir, tanpa menambah hitungan
  saveTasbih(tasbih);
  gambarTasbih();
}

function pilihDzikir(i) {
  if (!Number.isInteger(i) || i < 0 || i >= DZIKIR.length) return;
  tasbih.dzikir = i;
  tasbih.hitung = 0;
  tasbih.target = DZIKIR[i].target;
  saveTasbih(tasbih);
  gambarTasbih();
}

document.addEventListener("keydown", function (e) {
  if (!tasbihView || app.className !== "view-tasbih") return;
  if (e.key !== " " && e.key !== "Enter") return;
  // Kontrol apa pun (tautan, tombol, input) pakai aktivasi native-nya sendiri:
  // klik hasil aktivasi itu sudah ditangani delegasi klik di atas, jadi tidak
  // ada hitungan ganda — dan fokus di header tetap berfungsi.
  if (e.target instanceof Element && e.target.closest("a, button, input, select, textarea")) return;
  e.preventDefault(); // Space jangan menggulir halaman saat shortcut dipakai
  hitungTasbih();
});

// ---- Router ----

function router() {
  const hash = location.hash;
  let m;
  if (hash === "" || hash === "#" || hash === "#/") {
    renderDaftar();
  } else if ((m = hash.match(/^#\/surat\/(\d+)\/(\d+)$/))) {
    renderSurat(parseInt(m[1], 10), parseInt(m[2], 10));
  } else if ((m = hash.match(/^#\/surat\/(\d+)$/))) {
    renderSurat(parseInt(m[1], 10));
  } else if (hash === "#/bookmark") {
    renderBookmark();
  } else if (hash === "#/tasbih") {
    renderTasbih();
  } else {
    location.hash = "#/";
  }
}

window.addEventListener("hashchange", router);
router();

// ---- Tafsir dialog ----

document.getElementById("tafsir-tutup").addEventListener("click", function () {
  tafsirDialog.close();
});
tafsirDialog.addEventListener("click", function (e) {
  if (e.target === tafsirDialog) tafsirDialog.close();
});

async function bukaTafsir(nomorAyat) {
  const surat = surahCache.get(currentSuratNomor);
  tafsirJudul.textContent = "Tafsir " + (surat ? surat.namaLatin : "") + " ayat " + nomorAyat;
  tafsirIsi.textContent = "Memuat tafsir...";
  tafsirDialog.showModal();
  try {
    let tafsir = tafsirCache.get(currentSuratNomor);
    if (!tafsir) {
      const res = await fetch(API + "/tafsir/" + currentSuratNomor);
      const data = await res.json();
      if (res.ok === false || data.code !== 200) throw new Error("bad response");
      tafsir = data.data.tafsir;
      tafsirCache.set(currentSuratNomor, tafsir);
    }
    const item = tafsir.find(function (t) { return t.ayat === nomorAyat; });
    tafsirIsi.textContent = item ? item.teks : "Tafsir tidak tersedia.";
  } catch (e) {
    tafsirIsi.textContent = "Gagal memuat data. Periksa koneksi internet.";
  }
}

// ---- Delegated clicks on #app ----

function toggleBookmark(btn) {
  const nomorAyat = parseInt(btn.getAttribute("data-bookmark"), 10);
  const surat = surahCache.get(currentSuratNomor);
  const list = getBookmarks();
  const idx = list.findIndex(function (b) { return b.nomor === currentSuratNomor && b.nomorAyat === nomorAyat; });
  let sudah;
  if (idx >= 0) {
    list.splice(idx, 1);
    sudah = false;
  } else {
    list.push({ nomor: currentSuratNomor, nomorAyat: nomorAyat, namaLatin: surat ? surat.namaLatin : "" });
    sudah = true;
  }
  saveBookmarks(list);
  btn.textContent = sudah ? "★" : "☆";
  btn.setAttribute("aria-pressed", sudah ? "true" : "false");
}

app.addEventListener("click", function (e) {
  if (e.target.closest("[data-coba-lagi]")) {
    if (activeRender) activeRender();
    return;
  }
  const tafsirBtn = e.target.closest("[data-tafsir]");
  if (tafsirBtn) {
    bukaTafsir(parseInt(tafsirBtn.getAttribute("data-tafsir"), 10));
    return;
  }
  const bmBtn = e.target.closest("[data-bookmark]");
  if (bmBtn) {
    toggleBookmark(bmBtn);
    return;
  }
  const hapusBtn = e.target.closest("[data-hapus]");
  if (hapusBtn) {
    const parts = hapusBtn.getAttribute("data-hapus").split(":").map(Number);
    saveBookmarks(getBookmarks().filter(function (b) { return !(b.nomor === parts[0] && b.nomorAyat === parts[1]); }));
    renderBookmark();
  }
});
