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

// ---- Views ----

async function renderDaftar() {
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
    const last = getLastRead();
    if (last && last.nomor && last.nomorAyat) {
      const lanjut = el("div", "lanjutkan");
      const a = el("a", "tombol", "Lanjutkan membaca: " + last.namaLatin + " — Ayat " + last.nomorAyat + " →");
      a.href = "#/surat/" + last.nomor + "/" + last.nomorAyat;
      lanjut.appendChild(a);
      frag.appendChild(lanjut);
    }
    const daftar = el("div", "daftar");
    for (const s of surahList) {
      const kartu = el("a", "kartu");
      kartu.href = "#/surat/" + s.nomor;
      kartu.appendChild(el("span", "badge", String(s.nomor)));
      kartu.appendChild(el("span", "nama-latin", s.namaLatin));
      kartu.appendChild(el("span", "arti", s.arti));
      kartu.appendChild(el("span", "jumlah", s.jumlahAyat + " ayat"));
      const nama = el("span", "nama", s.nama);
      nama.setAttribute("dir", "rtl");
      nama.setAttribute("lang", "ar");
      kartu.appendChild(nama);
      daftar.appendChild(kartu);
    }
    frag.appendChild(daftar);
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
