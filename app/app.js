/* Deutschstudio — vanilla vocabulary trainer (MVP) */
(function () {
  "use strict";

  var DECK = (window.DECK && Array.isArray(window.DECK.words)) ? window.DECK : { words: [], meetings: [] };
  var DAY = 86400000;
  var INTERVALS = [0, 0, 1, 3, 7, 16]; // index = box (1..5); box1 -> due next session
  var SESSION_SIZE = 10;
  var K = { prog: "ds.progress.v1", stats: "ds.stats.v1", set: "ds.settings.v1" };

  /* ---------- storage ---------- */
  function load(key, fallback) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  }
  function save(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {} }

  var progress = load(K.prog, {});
  var stats = load(K.stats, { streak: 0, last: null, reviews: 0 });
  var settings = load(K.set, { lang: "id" });

  var S = { view: "dashboard", level: "all", session: null, browseMeeting: "all", browseQuery: "", key: null };

  var icons = {
    logo: '<path d="M4 18V6l8-2 8 2v12l-8 2zM12 4v16M7 9l2-.5M15 8.5l2 .5M7 13l2-.5M15 12.5l2 .5"/>',
    home: '<path d="m3 10 9-7 9 7v10H3zM9 20v-6h6v6"/>',
    repeat: '<path d="M20 7H7a4 4 0 0 0-4 4m14-7 3 3-3 3M4 17h13a4 4 0 0 0 4-4M7 14l-3 3 3 3"/>',
    book: '<path d="M12 6C8 3 4 4 3 5v14c3-1.5 6-1.5 9 1 3-2.5 6-2.5 9-1V5c-2-1.2-6-2-9 1Zm0 0v14"/>',
    blocks: '<rect x="3" y="4" width="8" height="6" rx="1"/><rect x="14" y="4" width="7" height="6" rx="1"/><rect x="3" y="14" width="18" height="6" rx="1"/>',
    keyboard: '<path d="M4 6h16v12H4zM7 9h1m3 0h1m3 0h1M7 12h1m3 0h1m3 0h2M7 15h10"/>',
    article: '<path d="M5 19V5h6a4 4 0 0 1 0 8H5m10-2h4m-2-2v8"/>',
    chart: '<path d="M4 4v16h17M8 16v-4m5 4V8m5 8V5"/>',
    folder: '<path d="M3 7V5h7l2 2h9v13H3z"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.3 2.3 0 1 1 3.4 2c-.8.5-1.2 1-1.2 2M12 17h.01"/>',
    arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
    chevron: '<path d="m9 6 6 6-6 6"/>',
    mark: '<path d="M6 4h12v16l-6-4-6 4z"/>',
    check: '<path d="m4 12 5 5L20 6"/>',
    calendar: '<rect x="3" y="6" width="18" height="15" rx="2"/><path d="M7 3v6m10-6v6M3 11h18"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'
  };
  function icon(name, cls) {
    return '<svg class="' + (cls || "size-5") + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + icons[name] + '</svg>';
  }
  var heroArt = '<svg class="hero-art" viewBox="0 0 420 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><pattern id="hero-lines" width="22" height="22" patternUnits="userSpaceOnUse"><path d="M0 22V0h22" fill="none" stroke="#fff9e3" stroke-opacity=".12"/></pattern></defs><path d="M70 0h350v300H70z" fill="url(#hero-lines)"/><circle cx="246" cy="151" r="127" fill="none" stroke="#777665"/><circle cx="246" cy="151" r="105" fill="none" stroke="#777665" stroke-dasharray="2 7"/><g transform="rotate(13 239 142)"><rect x="163" y="67" width="161" height="126" rx="24" fill="#a4b299"/><path d="m297 188 25 18-4-32" fill="#a4b299"/></g><g transform="rotate(-11 222 144)"><rect x="118" y="86" width="169" height="126" rx="23" fill="#f3af75"/><path d="m149 204-2 27 32-21" fill="#f3af75"/><text x="151" y="171" font-family="Georgia,serif" font-weight="700" font-size="80" fill="#28251e">Aa</text><circle cx="258" cy="110" r="3" fill="#28251e"/></g><path d="M341 65v25m-12-13h25M97 190v17m-8-8h17" stroke="#f9c593" stroke-width="2" stroke-linecap="round"/><circle cx="347" cy="216" r="5" fill="#f3af75"/><circle cx="130" cy="54" r="4" fill="#a4b299"/><path d="m318 242 13 13m-13 0 13-13" stroke="#a4b299" stroke-width="2"/></svg>';

  /* ---------- helpers ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function todayStr(t) { var d = new Date(t || Date.now()); return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate(); }

  function levelWords() {
    return DECK.words.filter(function (w) { return S.level === "all" || w._klasse === S.level; });
  }
  function prog(id) { return progress[id]; }
  function meaning(w) { var b = w.bedeutung || {}; return b[settings.lang] || b.id || b.en || ""; }
  function frontDe(w, hideArticle) {
    if (!hideArticle && w.artikel && /^(der|die|das)$/.test(w.artikel)) return '<span class="font-semibold text-[#34523f]">' + esc(w.artikel) + "</span> " + esc(w.de);
    return esc(w.de);
  }
  function isSimple(w) {
    if (["Nomen", "Verb", "Adjektiv", "Adverb"].indexOf(w.typ) < 0) return false;
    if (/[\/↔„(]/.test(w.de)) return false;
    if (w.de.split(" ").length > 3) return false;
    if (!meaning(w)) return false;
    return true;
  }
  function canArticle(w) { return w.typ === "Nomen" && /^(der|die|das)$/.test(w.artikel || ""); }

  function dueCount() {
    var now = Date.now(), n = 0;
    levelWords().forEach(function (w) { var p = prog(w.id); if (p && p.due <= now) n++; });
    return n;
  }
  function boxOf(w) { var p = prog(w.id); return p ? p.box : 0; }

  /* ---------- SRS ---------- */
  function grade(w, result) {
    // result: 'good' | 'warn' | 'bad'
    var p = progress[w.id] || { box: 0, due: 0, seen: 0, right: 0, wrong: 0, unsure: false };
    if (result === "good") p.box = Math.min(5, (p.box || 0) + 1);
    else if (result === "warn") p.box = Math.max(1, p.box || 1);
    else p.box = 1;
    p.seen = (p.seen || 0) + 1;
    if (result === "bad") p.wrong = (p.wrong || 0) + 1; else p.right = (p.right || 0) + 1;
    p.due = Date.now() + INTERVALS[p.box] * DAY;
    progress[w.id] = p;
    save(K.prog, progress);
    // streak
    var t = todayStr();
    if (stats.last !== t) {
      stats.streak = (stats.last === todayStr(Date.now() - DAY)) ? (stats.streak || 0) + 1 : 1;
      stats.last = t;
    }
    stats.reviews = (stats.reviews || 0) + 1;
    save(K.stats, stats);
  }
  function toggleUnsure(w) {
    var p = progress[w.id] || { box: 0, due: 0, seen: 0, right: 0, wrong: 0, unsure: false };
    p.unsure = !p.unsure; progress[w.id] = p; save(K.prog, progress);
    return p.unsure;
  }

  /* ---------- session ---------- */
  // Which words a chosen exercise mode can use.
  // A card declares its quiz modes in `modi`; Karteikarten (review) is always available.
  function validForMode(w, mode) {
    if (mode === "review") return true;
    var modi = w.modi || [];
    if (mode === "mc") return modi.indexOf("mc") >= 0;
    if (mode === "type") return modi.indexOf("tippen") >= 0;
    if (mode === "article") return modi.indexOf("artikel") >= 0;
    return true;
  }
  // Turn a chosen menu mode into the concrete card type for a word.
  function cardMode(w, mode) {
    if (mode === "mc") return Math.random() < 0.5 ? "mcDe" : "mcMean";
    if (mode === "type") return "type";
    if (mode === "article") return "article";
    return "flash"; // review
  }
  function modeDue(mode) {
    var now = Date.now();
    return levelWords().filter(function (w) { return validForMode(w, mode); })
      .filter(function (w) { var p = prog(w.id); return p && p.due <= now; }).length;
  }
  function buildSession(opts) {
    opts = opts || {};
    var now = Date.now();
    var mode = opts.mode || "review";
    var pool = levelWords().filter(function (w) { return validForMode(w, mode); });
    if (opts.meeting) pool = pool.filter(function (w) { return w._meeting === opts.meeting; });
    var size = opts.size || SESSION_SIZE;
    var list;
    if (opts.difficult) {
      list = shuffle(pool.filter(function (w) { var p = prog(w.id); return (p && p.unsure) || boxOf(w) === 1; })).slice(0, size);
    } else {
      var due = shuffle(pool.filter(function (w) { var p = prog(w.id); return p && p.due <= now; }));
      var neu = shuffle(pool.filter(function (w) { return !prog(w.id); }));
      list = due.concat(neu).slice(0, size);
      if (!list.length) { // nothing due & nothing new -> bring back the soonest reviews
        list = pool.filter(function (w) { return prog(w.id); }).sort(function (a, b) { return prog(a.id).due - prog(b.id).due; }).slice(0, size);
      }
    }
    var queue = shuffle(list).map(function (w) { return { word: w, mode: cardMode(w, mode) }; });
    if (!queue.length) return null;
    return { queue: queue, i: 0, right: 0, wrong: 0, title: opts.title || "Training" };
  }

  /* ---------- distractors ---------- */
  function distractors(w, kind, n) {
    var pool = levelWords().filter(function (x) { return x.id !== w.id && meaning(x) && (!x.typ || x.typ === w.typ || true); });
    // prefer same typ
    var same = pool.filter(function (x) { return x.typ === w.typ; });
    var src = shuffle(same.length >= n ? same : pool);
    var out = [], used = {};
    var selfKey = kind === "mean" ? meaning(w) : w.de;
    used[selfKey] = 1;
    for (var i = 0; i < src.length && out.length < n; i++) {
      var key = kind === "mean" ? meaning(src[i]) : src[i].de;
      if (used[key]) continue; used[key] = 1; out.push(src[i]);
    }
    return out;
  }

  // Shared Tailwind classes for components rendered in multiple views.
  var ui = {
    iconbtn: "grid size-10 place-items-center rounded-lg border border-[#d9d5c9] bg-[#fffefa] text-sm font-extrabold text-[#514e44] hover:bg-[#f0eee5]",
    menubtn: "flex min-w-0 items-center gap-3 rounded-[13px] border border-[#e6e3da] bg-[#fffefa] p-3 text-left enabled:hover:border-[#b6ad9a] disabled:cursor-default disabled:opacity-45 sm:p-4",
    mi: "grid size-10 shrink-0 place-items-center rounded-[9px] bg-[#f7e8d9] text-[#783c19]",
    secondaryButton: "flex min-h-[42px] flex-1 items-center justify-center gap-2 rounded-lg border border-[#d9d5c9] bg-[#fffefa] px-4 py-2.5 text-sm font-bold text-[#21221e] hover:bg-[#f0eee5]",
    widePrimaryButton: "w-full min-h-[42px] rounded-lg bg-[#242620] px-4 py-3 text-sm font-bold text-white hover:brightness-110",
    card: "rounded-[19px] border border-[#e6e3da] bg-[#fffefa] p-4 sm:p-6",
    backlink: "inline-flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-bold text-[#79421f] hover:bg-[#f3e8d9]",
    chip: "rounded-full bg-[#eeeae0] px-3 py-1 text-xs font-bold text-[#514e44]",
    opt: "opt flex min-w-0 items-center gap-3 rounded-[10px] border border-[#d4cdbf] bg-[#fffefa] px-3 py-3 text-left enabled:hover:border-[#9f816b] [&>span:last-child]:break-words [&.correct]:border-[#698771] [&.correct]:bg-[#edf1e8] [&.correct]:text-[#21221e] [&.wrong]:border-[#a84d38] [&.wrong]:bg-[#fbe7e1] [&.wrong]:text-[#5d2418]",
    typeIn: "w-full rounded-lg border border-[#ccc7b8] bg-[#fffefa] px-4 py-3 text-base text-[#21221e] placeholder:text-[#8d8c82]",
    sheet: "max-h-[88dvh] w-full max-w-xl overflow-y-auto rounded-t-[19px] bg-[#fffefa] p-5 shadow-xl sm:rounded-[19px] [&>h2]:mb-3 [&>h2]:text-xl [&>h2]:font-extrabold"
  };

  /* ---------- rendering root ---------- */
  var app = document.getElementById("app");
  function setKey(fn) { S.key = fn; }
  document.addEventListener("keydown", function (e) {
    if (S.key && !document.querySelector(".overlay")) S.key(e);
  });

  function render() {
    setKey(null);
    window.scrollTo(0, 0);
    if (!DECK.words.length) { app.innerHTML = frame('<div class="' + ui.card + ' text-center text-[#62625b]">Noch keine Wörter. Zuerst <code>node build.js</code> ausführen.</div>'); wireHeader(); return; }
    if (S.view === "session") renderSession();
    else if (S.view === "browse") renderBrowse();
    else renderDashboard();
    wireHeader();
  }

  /* ---------- application shell ---------- */
  function levelBtn(v, label) {
    return '<button data-lvl="' + v + '" aria-pressed="' + (S.level === v) + '" class="rounded-md px-2.5 py-1.5 text-xs font-bold text-[#62625b] hover:bg-white aria-pressed:bg-white aria-pressed:text-[#21221e] aria-pressed:shadow-sm">' + label + '</button>';
  }
  function sidebarButton(nav, iconName, label, active) {
    return '<button data-nav="' + nav + '" class="flex w-full items-center gap-3 rounded-[9px] px-3 py-2.5 text-left text-sm font-semibold ' + (active ? 'bg-[#e5ece2] text-[#263f30]' : 'text-[#55564f] hover:bg-[#efede6]') + '">' + icon(iconName, "size-5") + '<span>' + label + '</span></button>';
  }
  function sidebar() {
    return '<aside class="border-b border-[#e6e3da] bg-[#f1efe8] px-4 py-4 lg:fixed lg:inset-y-0 lg:left-0 lg:z-30 lg:w-[247px] lg:border-b-0 lg:border-r lg:px-4 lg:py-5">' +
      '<button data-nav="dashboard" class="mb-4 flex items-center gap-3 px-2 text-left">' + icon("logo", "size-8 text-[#34523f]") + '<span><b class="block text-[17px] leading-5">Deutschstudio</b><small class="text-[11px] text-[#77776e]">B1 bis C1</small></span></button>' +
      '<nav class="grid grid-cols-2 gap-1 sm:grid-cols-4 lg:block lg:space-y-1" aria-label="Hauptnavigation">' +
        sidebarButton("dashboard", "home", "Übersicht", S.view === "dashboard") + sidebarButton("progress", "chart", "Fortschritt", false) + sidebarButton("browse", "book", "Alle Wörter", S.view === "browse") +
        '<button data-mode="review" class="flex w-full items-center gap-3 rounded-[9px] px-3 py-2.5 text-left text-sm font-semibold text-[#55564f] hover:bg-[#efede6]">' + icon("repeat", "size-5") + '<span>Training</span></button></nav>' +
      '<div class="mt-6 hidden border-t border-[#dcd8ce] pt-4 lg:block"><p class="mb-2 px-3 text-[10px] font-bold uppercase tracking-[.15em] text-[#8a887e]">Lernmodi</p>' +
        '<button data-mode="mc" class="flex w-full items-center gap-3 rounded-[9px] px-3 py-2 text-left text-sm text-[#62625b] hover:bg-[#efede6]">' + icon("blocks", "size-[18px]") + 'Multiple Choice</button>' +
        '<button data-mode="type" class="flex w-full items-center gap-3 rounded-[9px] px-3 py-2 text-left text-sm text-[#62625b] hover:bg-[#efede6]">' + icon("keyboard", "size-[18px]") + 'Eintippen</button>' +
        '<button data-mode="article" class="flex w-full items-center gap-3 rounded-[9px] px-3 py-2 text-left text-sm text-[#62625b] hover:bg-[#efede6]">' + icon("article", "size-[18px]") + 'Artikel</button></div></aside>';
  }
  function mobileNav() {
    return '<nav class="mobile-nav lg:hidden" aria-label="Mobile Navigation">' +
      '<button data-nav="dashboard" aria-label="Übersicht">' + icon("home", "size-5") + '<span>Übersicht</span></button>' +
      '<button data-nav="progress" aria-label="Fortschritt">' + icon("chart", "size-5") + '<span>Fortschritt</span></button>' +
      '<button data-nav="browse" aria-label="Alle Wörter">' + icon("book", "size-5") + '<span>Wörter</span></button>' +
      '<button data-mode="review" aria-label="Training">' + icon("repeat", "size-5") + '<span>Training</span></button></nav>';
  }
  function frame(content, crumb) {
    return sidebar() + '<div class="min-h-screen lg:pl-[247px]"><header class="sticky top-0 z-20 flex min-h-[67px] flex-wrap items-center gap-3 border-b border-[#e6e3da] bg-[#fffefa]/95 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">' +
      '<div class="min-w-0 flex-1 text-sm text-[#77776e]">Deutschstudio' + (crumb ? ' <span class="mx-2">/</span><b class="text-[#34352f]">' + crumb + '</b>' : '') + '</div><div class="flex items-center gap-2"><div class="flex gap-1 rounded-lg bg-[#efede6] p-1">' + levelBtn("all", "Alle") + levelBtn("B2.1", "B2.1") + levelBtn("B2.2", "B2.2") + '</div>' +
      '<button class="' + ui.iconbtn + '" id="langBtn" title="Bedeutungssprache">' + (settings.lang === "id" ? "ID" : "EN") + '</button><button class="' + ui.iconbtn + '" id="helpBtn" title="Anleitung">' + icon("help", "size-5") + '</button></div></header>' +
      '<main id="main" class="mx-auto w-full max-w-[1330px] px-4 py-7 sm:px-6 lg:px-10 lg:py-9">' + content + '</main><footer class="px-4 pb-24 text-center text-xs text-[#88877e] lg:pb-8">Deutschstudio · Fortschritt wird lokal im Browser gespeichert</footer>' + mobileNav() + '</div>';
  }
  function wireHeader() {
    Array.prototype.forEach.call(app.querySelectorAll("[data-lvl]"), function (b) { b.onclick = function () { S.level = b.getAttribute("data-lvl"); S.session = null; S.view = "dashboard"; render(); }; });
    var lb = $("#langBtn"); if (lb) lb.onclick = function () { settings.lang = settings.lang === "id" ? "en" : "id"; save(K.set, settings); render(); };
    var hb = $("#helpBtn"); if (hb) hb.onclick = showHelp;
    Array.prototype.forEach.call(app.querySelectorAll("[data-mode]"), function (b) { b.onclick = function () { startSession({ mode: b.getAttribute("data-mode") }); }; });
    Array.prototype.forEach.call(app.querySelectorAll("[data-nav]"), function (b) { b.onclick = function () { var nav = b.getAttribute("data-nav"); if (nav === "browse") { S.view = "browse"; render(); return; } S.view = "dashboard"; render(); if (nav === "progress") { var el = $("#progress"); if (el) el.scrollIntoView({ behavior: "smooth" }); } }; });
  }
  function statTile(v, label, iconName) {
    return '<div class="flex min-w-0 items-center gap-4 rounded-[15px] border border-[#e6e3da] bg-[#fffefa] p-4"><span class="grid size-11 shrink-0 place-items-center rounded-xl bg-[#e5ece2] text-[#34523f]">' + icon(iconName, "size-5") + '</span><span><b class="block text-2xl leading-7 tracking-tight">' + v + '</b><span class="text-xs text-[#77776e]">' + label + '</span></span></div>';
  }
  function warmModeBtn(mode, iconName, label, description) {
    var d = modeDue(mode);
    return '<button class="' + ui.menubtn + '" data-mode="' + mode + '"><span class="' + ui.mi + '">' + icon(iconName, "size-5") + '</span><span class="min-w-0 flex-1"><b class="block text-sm sm:text-base">' + label + '</b><small class="mt-0.5 block text-xs leading-4 text-[#77776e]">' + description + '</small></span>' + (d ? '<span class="rounded-full bg-[#f7e8d9] px-2 py-1 text-xs font-semibold text-[#783c19]">' + d + '</span>' : '') + '</button>';
  }
  function renderDashboard() {
    var words = levelWords(), neu = 0, learning = 0, known = 0;
    words.forEach(function (w) { var b = boxOf(w); if (b === 0) neu++; else if (b >= 4) known++; else learning++; });
    var total = words.length, due = dueCount(), unsure = words.filter(function (w) { var p = prog(w.id); return p && p.unsure; }).length;
    var pKnown = total ? known / total * 100 : 0, pLearn = total ? learning / total * 100 : 0;
    var meetings = DECK.meetings.filter(function (m) { return S.level === "all" || m.klasse === S.level; });
    var html = '<section class="relative mb-6 overflow-hidden rounded-[19px] bg-[#f5ad6f] px-6 py-8 sm:px-9 sm:py-10"><div class="relative z-10 max-w-[610px]"><span class="mb-3 inline-flex rounded-full bg-[#fffefa]/70 px-3 py-1 text-xs font-bold text-[#6a3b1c]">Dein persönliches Sprachstudio</span><h1 class="max-w-[560px] text-3xl font-extrabold leading-[1.08] tracking-[-.035em] sm:text-[46px]">Deutsch lernen, das wirklich hängen bleibt.</h1><p class="mt-4 max-w-[520px] text-sm leading-6 text-[#543921] sm:text-base">Trainiere deinen Wortschatz aus dem Unterricht mit aktiver Wiederholung und vier verschiedenen Lernmodi.</p><button data-mode="review" class="mt-6 inline-flex items-center gap-2 rounded-lg bg-[#242620] px-5 py-3 text-sm font-bold text-white hover:brightness-110">Jetzt lernen ' + icon("arrow", "size-4") + '</button></div>' + heroArt + '</section>';
    html += '<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">' + statTile(due, "Heute fällig", "repeat") + statTile(known + "/" + total, "Sicher gelernt", "check") + statTile(stats.streak || 0, "Tage in Serie", "mark") + '</div>';
    html += '<div class="mb-4 mt-9"><p class="text-xs font-bold uppercase tracking-[.15em] text-[#8a887e]">Lernbereich</p><h2 class="mt-1 text-2xl font-extrabold tracking-tight">Wie möchtest du heute üben?</h2></div><div class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">' + warmModeBtn("review", "repeat", "Karteikarten", "Begriffe aktiv wiederholen") + warmModeBtn("mc", "blocks", "Multiple Choice", "Die richtige Bedeutung wählen") + warmModeBtn("type", "keyboard", "Eintippen", "Antwort selbst schreiben") + warmModeBtn("article", "article", "Artikel", "der, die oder das trainieren") + '</div>';
    html += '<div class="mt-3 flex flex-wrap gap-2"><button class="' + ui.secondaryButton + '" id="diffBtn">' + icon("mark", "size-4") + ' Schwierige Wörter (' + unsure + ')</button><button class="' + ui.secondaryButton + '" id="browseBtn">' + icon("book", "size-4") + ' Alle Wörter</button></div>';
    html += '<section id="progress" class="scroll-mt-24"><div class="mb-3 mt-9 text-xs font-bold uppercase tracking-[.15em] text-[#8a887e]">Fortschritt</div><div class="' + ui.card + '"><div class="mb-4 flex items-end justify-between gap-4"><div><b class="text-lg">Dein Wortschatz</b><p class="mt-1 text-sm text-[#77776e]">' + total + ' Karten in der aktuellen Auswahl</p></div><b class="text-2xl text-[#34523f]">' + Math.round(total ? known / total * 100 : 0) + '%</b></div><div class="flex h-2.5 overflow-hidden rounded-full bg-[#e9e5db]"><i class="bg-[#698771]" style="width:' + pKnown + '%"></i><i class="bg-[#d99a63]" style="width:' + pLearn + '%"></i></div><div class="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-[#62625b] [&_i]:mr-1.5 [&_i]:inline-block [&_i]:size-2.5 [&_i]:rounded-sm"><span><i class="bg-[#698771]"></i>Gelernt ' + known + '</span><span><i class="bg-[#d99a63]"></i>Am Lernen ' + learning + '</span><span><i class="bg-[#d6d2c6]"></i>Neu ' + neu + '</span></div></div></section>';
    html += '<div class="mb-3 mt-9 text-xs font-bold uppercase tracking-[.15em] text-[#8a887e]">Nach Sitzung</div><div class="' + ui.card + ' !p-2 sm:!p-3" id="mlist">';
    meetings.forEach(function (m) { var mw = words.filter(function (w) { return w._meeting === m.meeting && w._klasse === m.klasse; }); var kn = mw.filter(function (w) { return boxOf(w) >= 4; }).length; var pc = mw.length ? Math.round(kn / mw.length * 100) : 0; html += '<button type="button" class="mrow flex w-full items-center gap-3 rounded-lg border-b border-[#ece8de] px-3 py-3 text-left last:border-0 hover:bg-[#f3f1ea]" data-meeting="' + esc(m.meeting) + '" data-klasse="' + esc(m.klasse) + '"><span class="grid size-9 shrink-0 place-items-center rounded-lg bg-[#e4edf2] text-[#3e5868]">' + icon("calendar", "size-4") + '</span><span class="min-w-0 flex-1 text-sm [&>span]:block [&>span]:break-words [&>span]:text-xs [&>span]:text-[#77776e]"><b>' + esc(m.klasse) + ' · ' + esc(fmtDate(m.meeting)) + '</b><span>' + esc(m.topic) + '</span></span><span class="flex h-2 w-12 shrink-0 overflow-hidden rounded-full bg-[#e9e5db] sm:w-24"><i class="bg-[#698771]" style="width:' + pc + '%"></i></span><span class="w-9 shrink-0 text-right text-xs tabular-nums">' + pc + '%</span></button>'; });
    html += '</div>';
    app.innerHTML = frame(html, "Übersicht");
    Array.prototype.forEach.call(app.querySelectorAll("[data-mode]"), function (b) { b.onclick = function () { startSession({ mode: b.getAttribute("data-mode") }); }; });
    $("#diffBtn").onclick = function () { startSession({ difficult: true, title: "Schwierige Wörter" }); }; $("#browseBtn").onclick = function () { S.view = "browse"; render(); };
    Array.prototype.forEach.call(app.querySelectorAll(".mrow"), function (r) { r.onclick = function () { var mt = r.getAttribute("data-meeting"), kl = r.getAttribute("data-klasse"); var m = DECK.meetings.filter(function (x) { return x.meeting === mt && x.klasse === kl; })[0] || { topic: "" }; showMeetingPicker(mt, kl, m.topic); }; });
  }

  function fmtDate(iso) { var p = String(iso).split("-"); return p.length === 3 ? p[2] + "." + p[1] + "." : iso; }

  function startSession(opts) {
    var s = buildSession(opts);
    if (!s) { toast("Keine Karten verfügbar."); return; }
    S.session = s; S.view = "session"; render();
  }

  /* ---------- session / modes ---------- */
  function renderSession() {
    var S2 = S.session;
    if (!S2 || S2.i >= S2.queue.length) return renderDone();
    var item = S2.queue[S2.i], w = item.word;
    var pct = Math.round(S2.i / S2.queue.length * 100);
    var head = '<div class="mb-4 flex items-center gap-3">' +
      '<button class="' + ui.backlink + '" id="backBtn">← Beenden</button>' +
      '<div class="min-w-0 flex-1"><div class="flex h-2.5 overflow-hidden rounded-full bg-[#e9e5db]"><i class="bg-[#698771]" style="width:' + pct + '%"></i></div></div>' +
      '<span class="text-sm text-[#77776e]">' + (S2.i + 1) + "/" + S2.queue.length + "</span></div>";
    var body;
    if (item.mode === "mcDe") body = viewMC(w, "mean");
    else if (item.mode === "mcMean") body = viewMC(w, "de");
    else if (item.mode === "type") body = viewType(w);
    else if (item.mode === "article") body = viewArticle(w);
    else body = viewFlash(w);
    app.innerHTML = frame(head + '<div class="mx-auto max-w-3xl">' + body + '</div>', esc(S2.title));
    wireHeader();
    $("#backBtn").onclick = function () { S.session = null; S.view = "dashboard"; render(); };
    wireFlag(w);
    item._wire();
  }

  function next(result, w) {
    if (result) grade(w, result);
    if (result === "bad") S.session.wrong++; else if (result) S.session.right++;
    S.session.i++;
    render();
  }

  function flagHtml(w) {
    var on = prog(w.id) && prog(w.id).unsure;
    return '<button aria-pressed="' + Boolean(on) + '" class="rounded-xl border border-[#d9d5c9] px-3 py-2 text-sm font-semibold hover:bg-[#f0eee5] aria-pressed:border-[#d99a63] aria-pressed:bg-[#f7e8d9] aria-pressed:text-[#783c19]" id="flagBtn">⚑ ' + (on ? "Unsicher" : "Markieren") + "</button>";
  }
  function wireFlag(w) {
    var b = $("#flagBtn"); if (!b) return;
    b.onclick = function () { var on = toggleUnsure(w); b.setAttribute("aria-pressed", on); b.innerHTML = "⚑ " + (on ? "Unsicher" : "Markieren"); };
  }

  function extrasHtml(w) {
    var h = "";
    if (w.synonyme && w.synonyme.length) h += '<div class="my-1 break-words"><span class="mr-2 font-semibold text-[#34523f]">≈</span>' + esc(w.synonyme.join(", ")) + "</div>";
    if (w.gegenteil && w.gegenteil.length) h += '<div class="my-1 break-words"><span class="mr-2 font-semibold text-[#34523f]">↔</span>' + esc(w.gegenteil.join(", ")) + "</div>";
    if (w.kollokationen && w.kollokationen.length) h += '<div class="my-1 break-words"><span class="mr-2 font-semibold text-[#34523f]">+</span>' + esc(w.kollokationen.join(" · ")) + "</div>";
    if (w.hinweis) { var hn = w.hinweis[settings.lang] || w.hinweis.id || w.hinweis.en; if (hn) h += '<div class="my-1 break-words"><span class="mr-2 font-semibold text-[#34523f]">ℹ</span>' + esc(hn) + "</div>"; }
    if (h) h = '<div class="mt-3 text-sm">' + h + "</div>";
    var exs = (w.beispiele || []).slice(0, 2).map(function (e) {
      var tr = e[settings.lang] || e.id || e.en || "";
      return '<div class="mt-3 rounded-xl bg-[#f3f1ea] p-3 text-sm"><div class="font-semibold">' + esc(e.de) + '</div><div class="mt-1 text-[#62625b]">' + esc(tr) + "</div></div>";
    }).join("");
    return h + exs;
  }
  function metaChips(w) {
    return '<div class="flex flex-wrap gap-2"><span class="' + ui.chip + '">' + esc(w.typ || "") + '</span><span class="' + ui.chip + '">' + esc(w._klasse) + " · " + esc(fmtDate(w._meeting)) + "</span></div>";
  }

  /* flashcard (self-rated) */
  function viewFlash(w) {
    var html = '<div class="' + ui.card + '"><div class="mb-3 text-sm text-[#62625b]">Was bedeutet das? (denk nach, dann aufdecken)</div>' +
      '<div class="break-words text-2xl font-extrabold leading-tight tracking-tight sm:text-4xl">' + frontDe(w) + "</div>" +
      (w.plural ? '<div class="mt-1 text-sm text-[#62625b]">Pl.: ' + esc(w.plural) + "</div>" : "") +
      '<div id="revArea"></div>' +
      '<div class="mt-4" id="revBtnArea"><button class="' + ui.widePrimaryButton + '" id="revealBtn">Aufdecken</button></div>' +
      '<div class="mt-3">' + flagHtml(w) + "</div></div>";
    var S2 = S.session, item = S2.queue[S2.i];
    item._wire = function () {
      function reveal() {
        $("#revArea").innerHTML = '<div class="mt-4 border-t border-dashed border-[#dcd8ce] pt-4"><div class="break-words text-xl font-bold">' + esc(meaning(w)) + "</div>" + extrasHtml(w) + metaChips(w) + "</div>";
        $("#revBtnArea").innerHTML = '<div class="mt-3 grid gap-2 sm:grid-cols-3">' +
          '<button class="rounded-xl bg-[#fbe7e1] p-3 font-bold text-[#5d2418] hover:bg-[#f7d8ce]" data-r="bad">Nicht gewusst</button>' +
          '<button class="rounded-xl bg-[#f7e8d9] p-3 font-bold text-[#783c19] hover:bg-[#f3e0c9]" data-r="warn">Unsicher</button>' +
          '<button class="rounded-xl bg-[#e5ece2] p-3 font-bold text-[#263f30] hover:bg-[#d8e3d3]" data-r="good">Gewusst</button></div>';
        Array.prototype.forEach.call(app.querySelectorAll("[data-r]"), function (b) { b.onclick = function () { next(b.getAttribute("data-r"), w); }; });
        setKey(function (e) { if (e.key === "1") pick("bad"); else if (e.key === "2") pick("warn"); else if (e.key === "3") pick("good"); });
        function pick(r) { next(r, w); }
      }
      var rb = $("#revealBtn"); if (rb) rb.onclick = reveal;
      setKey(function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); reveal(); } });
    };
    return html;
  }

  /* multiple choice. kind 'mean' => show de, choose meaning; 'de' => show meaning, choose de */
  function viewMC(w, kind) {
    var ds = distractors(w, kind, 3);
    var opts = shuffle([w].concat(ds));
    var ask = kind === "mean" ? "Welche Bedeutung passt?" : "Welches Wort passt?";
    var prompt = kind === "mean" ? '<div class="break-words text-2xl font-extrabold leading-tight tracking-tight sm:text-4xl">' + frontDe(w) + "</div>" : '<div class="break-words text-xl font-bold sm:text-2xl">' + esc(meaning(w)) + "</div>";
    var html = '<div class="' + ui.card + '"><div class="mb-3 text-sm text-[#62625b]">' + ask + '</div>' + prompt +
      '<div class="mt-4 grid gap-2" id="opts">' + opts.map(function (o, idx) {
        var label = kind === "mean" ? meaning(o) : (o.artikel && /^(der|die|das)$/.test(o.artikel) ? o.artikel + " " + o.de : o.de);
        return '<button class="' + ui.opt + '" data-id="' + esc(o.id) + '"><span class="grid size-7 shrink-0 place-items-center rounded-lg bg-[#f1efe8] text-xs font-bold text-[#34352f]">' + (idx + 1) + '</span><span>' + esc(label) + "</span></button>";
      }).join("") + "</div>" +
      '<div class="mt-3">' + flagHtml(w) + "</div></div>";
    var S2 = S.session, item = S2.queue[S2.i];
    item._wire = function () {
      var answered = false;
      function choose(btn) {
        if (answered) return; answered = true;
        var ok = btn.getAttribute("data-id") === w.id;
        Array.prototype.forEach.call(app.querySelectorAll(".opt"), function (b) {
          b.disabled = true;
          if (b.getAttribute("data-id") === w.id) b.classList.add("correct");
          else if (b === btn) b.classList.add("wrong");
        });
        setKey(function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); next(ok ? "good" : "bad", w); } });
        setTimeout(function () { if (S.session === S2 && S2.queue[S2.i] === item) next(ok ? "good" : "bad", w); }, ok ? 650 : 1400);
      }
      Array.prototype.forEach.call(app.querySelectorAll(".opt"), function (b) { b.onclick = function () { choose(b); }; });
      setKey(function (e) { var n = parseInt(e.key, 10); if (n >= 1 && n <= opts.length) { var btns = app.querySelectorAll(".opt"); if (btns[n - 1]) choose(btns[n - 1]); } });
    };
    return html;
  }

  /* type the German word */
  function viewType(w) {
    var html = '<div class="' + ui.card + '"><div class="mb-3 text-sm text-[#62625b]">Tippe das deutsche Wort:</div>' +
      '<div class="break-words text-xl font-bold sm:text-2xl">' + esc(meaning(w)) + "</div>" +
      '<div class="mt-4"><input class="' + ui.typeIn + '" id="typeIn" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="auf Deutsch …"></div>' +
      '<div id="typeFb"></div>' +
      '<div class="mt-3" id="typeBtns"><button class="' + ui.widePrimaryButton + '" id="checkBtn">Prüfen</button></div>' +
      '<div class="mt-3">' + flagHtml(w) + "</div></div>";
    var S2 = S.session, item = S2.queue[S2.i];
    item._wire = function () {
      var inp = $("#typeIn"); inp.focus();
      var done = false;
      function norm(s) { return String(s).toLowerCase().normalize("NFC").replace(/^(der|die|das)\s+/, "").replace(/\s+/g, " ").trim(); }
      function check() {
        if (done) return;
        var val = norm(inp.value); if (!val) return;
        var target = norm(w.de);
        var ok = val === target || val === target.replace(/^sich\s+/, "") || ("sich " + val) === target;
        done = true; inp.disabled = true;
        $("#typeFb").innerHTML = '<div role="status" class="mt-3 font-bold ' + (ok ? "text-[#263f30]" : "text-[#5d2418]") + '">' + (ok ? "✓ Richtig!" : "✗ Richtig: " + esc(w.de)) + "</div>" +
          '<div class="mt-4 border-t border-dashed border-[#dcd8ce] pt-4"><div class="break-words text-xl font-bold">' + frontDe(w) + "</div>" + extrasHtml(w) + "</div>";
        $("#typeBtns").innerHTML = '<button class="' + ui.widePrimaryButton + '" id="contBtn">Weiter →</button>';
        $("#contBtn").onclick = function () { next(ok ? "good" : "bad", w); };
        setKey(function (e) { if (e.key === "Enter") next(ok ? "good" : "bad", w); });
        $("#contBtn").focus();
      }
      $("#checkBtn").onclick = check;
      inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); e.stopPropagation(); check(); } });
      setKey(null);
    };
    return html;
  }

  /* article der/die/das */
  function viewArticle(w) {
    var html = '<div class="' + ui.card + '"><div class="mb-3 text-sm text-[#62625b]">Welcher Artikel?</div>' +
      '<div class="break-words text-2xl font-extrabold leading-tight tracking-tight sm:text-4xl">' + esc(w.de) + "</div>" +
      (w.plural ? '<div class="mt-1 text-sm text-[#62625b]">Pl.: ' + esc(w.plural) + "</div>" : "") +
      '<div class="mt-4 grid grid-cols-3 gap-2 font-bold [&>button]:justify-center" id="arts">' + ["der", "die", "das"].map(function (a) { return '<button class="' + ui.opt + '" data-a="' + a + '">' + a + "</button>"; }).join("") + "</div>" +
      '<div id="artFb"></div><div class="mt-3">' + flagHtml(w) + "</div></div>";
    var S2 = S.session, item = S2.queue[S2.i];
    item._wire = function () {
      var answered = false;
      function choose(a, btn) {
        if (answered) return; answered = true;
        var ok = a === w.artikel;
        Array.prototype.forEach.call(app.querySelectorAll("[data-a]"), function (b) {
          b.disabled = true;
          if (b.getAttribute("data-a") === w.artikel) b.classList.add("correct");
          else if (b === btn) b.classList.add("wrong");
        });
        $("#artFb").innerHTML = '<div class="mt-4 border-t border-dashed border-[#dcd8ce] pt-4"><div class="break-words text-xl font-bold">' + esc(w.artikel) + " " + esc(w.de) + "</div>" + extrasHtml(w) + "</div>";
        setTimeout(function () { if (S.session === S2 && S2.queue[S2.i] === item) next(ok ? "good" : "bad", w); }, ok ? 650 : 1400);
        setKey(function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); next(ok ? "good" : "bad", w); } });
      }
      Array.prototype.forEach.call(app.querySelectorAll("[data-a]"), function (b) { b.onclick = function () { choose(b.getAttribute("data-a"), b); }; });
      setKey(function (e) { var m = { "1": "der", "2": "die", "3": "das" }[e.key]; if (m) { var btns = app.querySelectorAll("[data-a]"); choose(m, btns["der die das".split(" ").indexOf(m)]); } });
    };
    return html;
  }

  /* ---------- result & browse views ---------- */
  function renderDone() {
    var S2 = S.session, totalAnswers = S2.right + S2.wrong;
    var html = '<div class="mx-auto max-w-2xl rounded-[19px] border border-[#e6e3da] bg-[#fffefa] p-7 text-center sm:p-10"><span class="mx-auto grid size-14 place-items-center rounded-full bg-[#e5ece2] text-[#34523f]">' + icon("check", "size-7") + '</span><h2 class="mt-4 text-2xl font-extrabold">Sitzung fertig!</h2><p class="mt-2 text-sm text-[#62625b]">' + S2.right + ' von ' + totalAnswers + ' richtig · Serie: ' + (stats.streak || 0) + ' Tage</p><div class="mt-6 flex flex-wrap justify-center gap-2"><button class="rounded-lg bg-[#242620] px-5 py-3 text-sm font-bold text-white hover:brightness-110" id="againBtn">Weiter üben</button><button class="' + ui.secondaryButton + ' !flex-none" id="homeBtn">Zur Übersicht</button></div></div>';
    app.innerHTML = frame(html, "Ergebnis"); wireHeader();
    $("#againBtn").onclick = function () { startSession({}); };
    $("#homeBtn").onclick = function () { S.session = null; S.view = "dashboard"; render(); };
  }

  function renderBrowse() {
    var words = levelWords();
    var meetings = DECK.meetings.filter(function (m) { return S.level === "all" || m.klasse === S.level; });
    var html = '<div class="mb-5 flex flex-wrap items-center gap-3"><div class="min-w-0 flex-1"><p class="text-xs font-bold uppercase tracking-[.15em] text-[#8a887e]">Wortschatz</p><h1 class="mt-1 text-3xl font-extrabold tracking-tight">Alle Wörter</h1></div><button class="' + ui.backlink + '" id="backBtn">' + icon("arrow", "size-4 rotate-180") + ' Übersicht</button></div>';
    html += '<div class="' + ui.card + '"><input class="' + ui.typeIn + '" type="search" aria-label="Wörter suchen" id="q" placeholder="Deutsch oder Bedeutung suchen" value="' + esc(S.browseQuery) + '"><div class="mt-3 flex flex-wrap gap-2" id="mchips"><button class="rounded-full border border-[#d4cdbf] px-3 py-2 text-xs font-bold hover:bg-[#f0eee5] aria-pressed:border-[#698771] aria-pressed:bg-[#e5ece2]" aria-pressed="' + (S.browseMeeting === "all") + '" data-m="all">Alle</button>' +
      meetings.map(function (m) { return '<button class="rounded-full border border-[#d4cdbf] px-3 py-2 text-xs font-bold hover:bg-[#f0eee5] aria-pressed:border-[#698771] aria-pressed:bg-[#e5ece2]" aria-pressed="' + (S.browseMeeting === m.meeting) + '" data-m="' + esc(m.meeting) + '">' + esc(m.klasse + " " + fmtDate(m.meeting)) + '</button>'; }).join("") + '</div></div>';
    var q = S.browseQuery.toLowerCase();
    var list = words.filter(function (w) { if (S.browseMeeting !== "all" && w._meeting !== S.browseMeeting) return false; if (!q) return true; return (w.de + " " + meaning(w)).toLowerCase().indexOf(q) >= 0; });
    html += '<div class="mb-3 mt-7 text-xs font-bold uppercase tracking-[.15em] text-[#8a887e]">' + list.length + ' Wörter</div><div class="divide-y divide-[#ece8de] rounded-[19px] border border-[#e6e3da] bg-[#fffefa] px-4">';
    if (!list.length) html += '<div class="py-10 text-center text-sm text-[#62625b]">Nichts gefunden.</div>';
    list.forEach(function (w) { var box = boxOf(w), p = prog(w.id); var colors = ["bg-[#d6d2c6]", "bg-[#bdb7a8]", "bg-[#d99a63]", "bg-[#c8ad5f]", "bg-[#698771]", "bg-[#34523f]"]; var cls = "size-2.5 self-center rounded-full " + colors[box] + (p && p.unsure ? " ring-2 ring-[#d99a63] ring-offset-2" : ""); html += '<div class="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1 py-3.5 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)]"><span class="' + cls + '"></span><span class="break-words font-bold">' + frontDe(w) + '</span><span class="col-start-2 break-words text-sm text-[#62625b] sm:col-start-3">' + esc(meaning(w)) + '</span></div>'; });
    html += '</div>';
    app.innerHTML = frame(html, "Alle Wörter"); wireHeader();
    $("#backBtn").onclick = function () { S.view = "dashboard"; render(); };
    var qi = $("#q"); qi.oninput = function () { S.browseQuery = qi.value; var pos = qi.selectionStart; renderBrowse(); var nq = $("#q"); nq.focus(); try { nq.setSelectionRange(pos, pos); } catch (e) {} };
    Array.prototype.forEach.call(app.querySelectorAll("[data-m]"), function (c) { c.onclick = function () { S.browseMeeting = c.getAttribute("data-m"); renderBrowse(); }; });
  }

  /* ---------- toast ---------- */
  var toastEl;
  var overlayClasses = "overlay fixed inset-0 z-50 flex items-end justify-center bg-[#21221e]/70 sm:items-center sm:p-4";
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement("div"); toastEl.className = "pointer-events-none fixed inset-x-4 bottom-5 z-40 mx-auto w-fit rounded-xl bg-[#242620] px-4 py-3 text-sm font-semibold text-white opacity-0 shadow-lg motion-safe:transition-opacity [&.show]:opacity-100"; toastEl.setAttribute("role", "status"); document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(function () { toastEl.classList.remove("show"); }, 1800);
  }

  /* ---------- help / Anleitung ---------- */
  var GUIDE = {
    id: {
      title: "Cara pakai Deutschstudio",
      items: [
        ["🎯 Inti", "Kamu dilatih <b>mengingat sendiri</b> arti kata (bukan sekadar baca ulang). Kata yang belum lancar otomatis muncul lebih sering, yang sudah hafal makin jarang."],
        ["🧭 Pilih menu latihan", "Ada 4 menu: <b>Karteikarten</b> (kartu), <b>Multiple Choice</b> (pilihan ganda), <b>Eintippen</b> (ketik), dan <b>Artikel</b> (der/die/das). Pilih yang mau kamu latih; tiap menu ambil kata baru + kata yang perlu diulang."],
        ["🃏 Karteikarten", "Lihat kata Jerman → <b>Aufdecken</b> (buka) → nilai diri: <b>Gewusst</b> (tahu) / <b>Unsicher</b> (ragu) / <b>Nicht gewusst</b> (lupa)."],
        ["✅ Nilai jujur", "<b>Gewusst</b> = tahu → makin jarang muncul. <b>Unsicher</b> = ragu. <b>Nicht gewusst</b> = lupa → sering muncul lagi."],
        ["⚑ Markieren", "Tandai kata yang belum yakin → masuk tumpukan <b>Schwierige</b> untuk dilatih khusus."],
        ["⚙️ Kanan atas", "<b>ID/EN</b> = ganti bahasa arti. <b>Alle / B2.1 / B2.2</b> = pilih level. <b>?</b> = buka panduan ini lagi."]
      ],
      close: "Los geht's!"
    },
    en: {
      title: "How Deutschstudio works",
      items: [
        ["🎯 The idea", "You practise <b>recalling</b> the meaning yourself (not just re-reading). Words you don't know yet come back more often; words you know appear less."],
        ["🧭 Pick a mode", "Four menus: <b>Karteikarten</b> (flashcards), <b>Multiple Choice</b>, <b>Eintippen</b> (typing), and <b>Artikel</b> (der/die/das). Pick what you want to drill; each pulls new words + words due for review."],
        ["🃏 Karteikarten", "See the German word → <b>Aufdecken</b> (reveal) → rate yourself: <b>Gewusst</b> (knew it) / <b>Unsicher</b> (unsure) / <b>Nicht gewusst</b> (forgot)."],
        ["✅ Rate honestly", "<b>Gewusst</b> = knew it → shown less often. <b>Unsicher</b> = unsure. <b>Nicht gewusst</b> = forgot → shown again soon."],
        ["⚑ Markieren", "Flag a word you're unsure about → it joins the <b>Schwierige</b> (difficult) pile for focused practice."],
        ["⚙️ Top right", "<b>ID/EN</b> = switch meaning language. <b>Alle / B2.1 / B2.2</b> = pick a level. <b>?</b> = open this guide again."]
      ],
      close: "Los geht's!"
    }
  };
  function showHelp() {
    var prev = document.querySelector(".overlay"); if (prev) prev.remove();
    var g = GUIDE[settings.lang] || GUIDE.id;
    var ov = document.createElement("div");
    ov.className = overlayClasses;
    ov.innerHTML = '<div class="' + ui.sheet + '"><h2>' + esc(g.title) + '</h2>' +
      g.items.map(function (it) { return '<div class="border-b border-[#ece8de] py-3 last:border-0 [&>b]:mb-1 [&>b]:block [&>p]:text-sm [&>p]:text-[#62625b]"><b>' + it[0] + '</b><p>' + it[1] + '</p></div>'; }).join("") +
      '<button class="mt-4 ' + ui.widePrimaryButton + '" id="helpClose">' + esc(g.close) + '</button></div>';
    document.body.appendChild(ov);
    function close() { ov.remove(); settings.seenHelp = true; save(K.set, settings); }
    ov.querySelector("#helpClose").onclick = close;
    ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
  }

  /* ---------- per-meeting mode picker ---------- */
  function showMeetingPicker(meeting, klasse, topic) {
    var prev = document.querySelector(".overlay"); if (prev) prev.remove();
    var total = levelWords().filter(function (w) { return w._meeting === meeting; }).length;
    function mb(mode, icon, label) {
      var cnt = levelWords().filter(function (w) { return w._meeting === meeting && validForMode(w, mode); }).length;
      return '<button class="' + ui.menubtn + '" data-mode="' + mode + '"' + (cnt ? '' : ' disabled') + '>' +
        '<span class="' + ui.mi + '">' + icon + '</span><span class="min-w-0 flex-1 text-sm font-bold sm:text-base">' + label + '</span>' +
        '<span class="rounded-full bg-[#f1efe8] px-2 py-1 text-xs font-semibold">' + cnt + ' Wörter</span></button>';
    }
    var ov = document.createElement("div");
    ov.className = overlayClasses;
    ov.innerHTML = '<div class="' + ui.sheet + '"><h2>' + esc(klasse) + ' · ' + esc(fmtDate(meeting)) + '</h2>' +
      '<p class="mb-4 text-sm text-[#62625b]">' + esc(topic || "") + ' · ' + total + ' Wörter</p>' +
      '<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">' + mb("review", "🃏", "Karteikarten") + mb("mc", "✅", "Multiple Choice") +
        mb("type", "⌨️", "Eintippen") + mb("article", "der", "Artikel") + '</div>' +
      '<button class="mt-4 w-full rounded-xl border border-[#d9d5c9] px-4 py-3 font-bold hover:bg-[#f0eee5]" id="mpClose">Schließen</button></div>';
    document.body.appendChild(ov);
    function close() { ov.remove(); }
    Array.prototype.forEach.call(ov.querySelectorAll("[data-mode]"), function (b) {
      if (b.disabled) return;
      b.onclick = function () { var m = b.getAttribute("data-mode"); close(); startSession({ meeting: meeting, mode: m, title: fmtDate(meeting) }); };
    });
    ov.querySelector("#mpClose").onclick = close;
    ov.addEventListener("click", function (e) { if (e.target === ov) close(); });
  }

  render();
  if (!settings.seenHelp) showHelp();
})();
