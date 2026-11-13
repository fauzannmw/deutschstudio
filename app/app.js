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
    if (!hideArticle && w.artikel && /^(der|die|das)$/.test(w.artikel)) return '<span class="font-semibold text-teal-700 dark:text-teal-300">' + esc(w.artikel) + "</span> " + esc(w.de);
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
    iconbtn: "h-10 min-w-10 rounded-xl border border-slate-200 px-2 text-sm font-bold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800",
    menubtn: "flex min-w-0 flex-col items-start gap-2 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm enabled:hover:border-teal-500 enabled:hover:bg-teal-50 motion-safe:transition motion-safe:enabled:hover:-translate-y-0.5 disabled:opacity-50 sm:p-4 dark:border-slate-800 dark:bg-slate-900 dark:enabled:hover:bg-teal-950",
    mi: "grid min-h-10 min-w-10 place-items-center rounded-xl bg-teal-100 px-2 text-lg font-bold text-teal-900 dark:bg-teal-950 dark:text-teal-200",
    secondaryButton: "flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm font-bold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800",
    widePrimaryButton: "w-full rounded-xl bg-teal-700 px-4 py-3 font-bold text-white hover:bg-teal-800 dark:bg-teal-300 dark:text-teal-950 dark:hover:bg-teal-200",
    card: "rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:border-slate-800 dark:bg-slate-900",
    backlink: "rounded-lg px-2 py-2 text-sm font-bold text-teal-800 hover:bg-teal-100 dark:text-teal-200 dark:hover:bg-teal-950",
    chip: "rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs dark:border-slate-700 dark:bg-slate-800",
    opt: "opt flex min-w-0 items-center gap-3 rounded-xl border border-slate-300 px-3 py-3 text-left enabled:hover:border-teal-600 enabled:hover:bg-teal-50 [&>span:last-child]:break-words dark:border-slate-700 dark:enabled:hover:bg-teal-950 [&.correct]:border-emerald-600 [&.correct]:bg-emerald-100 [&.correct]:text-emerald-950 [&.wrong]:border-rose-600 [&.wrong]:bg-rose-100 [&.wrong]:text-rose-950",
    typeIn: "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base dark:border-slate-700 dark:bg-slate-900",
    sheet: "max-h-[88dvh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl dark:bg-slate-900 [&>h2]:mb-3 [&>h2]:text-xl [&>h2]:font-bold"
  };

  /* ---------- rendering root ---------- */
  var app = document.getElementById("app");
  function setKey(fn) { S.key = fn; }
  document.addEventListener("keydown", function (e) {
    if (S.key && !document.querySelector(".overlay")) S.key(e);
  });

  function header(extra) {
    return '' +
      '<div class="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">' +
        '<span class="flex items-center gap-2 text-lg font-extrabold tracking-tight sm:text-xl [&>small]:rounded-full [&>small]:bg-teal-100 [&>small]:px-2 [&>small]:py-1 [&>small]:text-xs [&>small]:font-bold [&>small]:text-teal-800 dark:[&>small]:bg-teal-950 dark:[&>small]:text-teal-200">🧠 Deutschstudio<small>B1 → C1</small></span>' +
        '<div class="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">' +
          '<div class="mr-auto flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">' +
            levelBtn("all", "Alle") + levelBtn("B2.1", "B2.1") + levelBtn("B2.2", "B2.2") +
          '</div>' +
          '<button class="' + ui.iconbtn + '" id="langBtn" title="Bedeutungssprache">' + (settings.lang === "id" ? "ID" : "EN") + '</button>' +
          '<button class="' + ui.iconbtn + '" id="helpBtn" title="Anleitung">?</button>' +
        '</div>' +
      '</div>' + (extra || "");
  }
  function levelBtn(v, label) { return '<button data-lvl="' + v + '" aria-pressed="' + (S.level === v) + '" class="rounded-lg px-2.5 py-2 text-sm font-semibold hover:bg-white aria-pressed:bg-white aria-pressed:text-teal-800 aria-pressed:shadow-sm dark:hover:bg-slate-900 dark:aria-pressed:bg-slate-900 dark:aria-pressed:text-teal-200">' + label + "</button>"; }

  function wireHeader() {
    Array.prototype.forEach.call(app.querySelectorAll("[data-lvl]"), function (b) {
      b.onclick = function () { S.level = b.getAttribute("data-lvl"); S.session = null; S.view = "dashboard"; render(); };
    });
    var lb = $("#langBtn"); if (lb) lb.onclick = function () { settings.lang = settings.lang === "id" ? "en" : "id"; save(K.set, settings); render(); };
    var hb = $("#helpBtn"); if (hb) hb.onclick = showHelp;
  }

  function render() {
    setKey(null);
    if (!DECK.words.length) { app.innerHTML = header() + '<div class="rounded-2xl bg-white p-8 text-center dark:bg-slate-900">Noch keine Wörter. Zuerst <code>node build.js</code> ausführen.</div>'; wireHeader(); return; }
    if (S.view === "session") renderSession();
    else if (S.view === "browse") renderBrowse();
    else renderDashboard();
    wireHeader();
  }

  /* ---------- dashboard ---------- */
  function renderDashboard() {
    var words = levelWords();
    var neu = 0, learning = 0, known = 0;
    words.forEach(function (w) { var b = boxOf(w); if (b === 0) neu++; else if (b >= 4) known++; else learning++; });
    var total = words.length;
    var due = dueCount();
    var unsure = words.filter(function (w) { var p = prog(w.id); return p && p.unsure; }).length;
    var pKnown = total ? (known / total * 100) : 0;
    var pLearn = total ? (learning / total * 100) : 0;

    var meetings = DECK.meetings.filter(function (m) { return S.level === "all" || m.klasse === S.level; });

    var html = header();
    html += '<section class="mb-4 rounded-3xl bg-gradient-to-br from-teal-950 to-teal-800 p-5 text-white shadow-sm sm:p-8">' +
      '<h1 class="text-3xl font-extrabold tracking-tight sm:text-4xl">Wortschatztraining</h1>' +
      '<p lang="id" class="mt-1 text-sm text-teal-100">Latihan kosakata</p>' +
      '<button data-mode="review" class="mt-5 rounded-xl bg-white px-4 py-3 text-left font-bold text-teal-950 hover:bg-teal-100">' +
        'Karteikarten starten <span lang="id" class="block text-xs font-medium text-teal-800">Mulai kartu kosakata</span>' +
      '</button></section>';
    html += '<div class="grid grid-cols-3 gap-2 sm:gap-4">' +
      tile(due, "fällig heute") + tile(known + "/" + total, "gelernt") + tile((stats.streak || 0) + " 🔥", "Serie (Tage)") +
      '</div>';

    html += '<div class="mb-3 mt-7 text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Üben</div>' +
      '<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">' +
        modeBtn("review", "🃏", "Karteikarten") +
        modeBtn("mc", "✅", "Multiple Choice") +
        modeBtn("type", "⌨️", "Eintippen") +
        modeBtn("article", "der", "Artikel") +
      '</div>' +
      '<div class="mt-3 flex flex-wrap gap-2">' +
        '<button class="' + ui.secondaryButton + '" id="diffBtn">⚑ Schwierige (' + unsure + ')</button>' +
        '<button class="' + ui.secondaryButton + '" id="browseBtn">📖 Alle Wörter</button>' +
      '</div>';

    html += '<div class="mb-3 mt-7 text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Fortschritt</div>' +
      '<div class="' + ui.card + '">' +
        '<div class="flex h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"><i class="bg-emerald-600 dark:bg-emerald-400" style="width:' + pKnown + '%"></i><i class="bg-amber-500" style="width:' + pLearn + '%"></i></div>' +
        '<div class="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-600 dark:text-slate-300 [&_i]:mr-1.5 [&_i]:inline-block [&_i]:size-2.5 [&_i]:rounded-sm"><span><i class="bg-emerald-600 dark:bg-emerald-400"></i>Gelernt ' + known + '</span>' +
          '<span><i class="bg-amber-500"></i>Am Lernen ' + learning + '</span>' +
          '<span><i class="bg-slate-300 dark:bg-slate-700"></i>Neu ' + neu + '</span></div>' +
      '</div>';

    html += '<div class="mb-3 mt-7 text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">Nach Sitzung</div><div class="' + ui.card + '" id="mlist">';
    meetings.forEach(function (m) {
      var mw = words.filter(function (w) { return w._meeting === m.meeting && w._klasse === m.klasse; });
      var kn = mw.filter(function (w) { return boxOf(w) >= 4; }).length;
      var pc = mw.length ? Math.round(kn / mw.length * 100) : 0;
      html += '<button type="button" class="mrow flex w-full items-center gap-3 border-b border-slate-200 px-2 py-3 text-left last:border-0 hover:bg-teal-50 dark:border-slate-800 dark:hover:bg-teal-950" data-meeting="' + esc(m.meeting) + '" data-klasse="' + esc(m.klasse) + '">' +
        '<span class="min-w-0 flex-1 text-sm [&>span]:block [&>span]:break-words [&>span]:text-xs [&>span]:text-slate-600 dark:[&>span]:text-slate-300"><b>' + esc(m.klasse) + " · " + esc(fmtDate(m.meeting)) + '</b><span>' + esc(m.topic) + '</span></span>' +
        '<span class="flex h-2 w-12 shrink-0 overflow-hidden rounded-full bg-slate-200 sm:w-24 dark:bg-slate-700"><i class="bg-emerald-600 dark:bg-emerald-400" style="width:' + pc + '%"></i></span>' +
        '<span class="w-9 shrink-0 text-right text-xs tabular-nums">' + pc + '%</span></button>';
    });
    html += "</div>";
    html += '<p class="mt-5 text-center text-xs text-slate-600 dark:text-slate-300">' + DECK.words.length + ' Karten · Fortschritt im Browser gespeichert</p>';

    app.innerHTML = html;
    Array.prototype.forEach.call(app.querySelectorAll("[data-mode]"), function (b) {
      b.onclick = function () { startSession({ mode: b.getAttribute("data-mode") }); };
    });
    $("#diffBtn").onclick = function () { startSession({ difficult: true, title: "Schwierige Wörter" }); };
    $("#browseBtn").onclick = function () { S.view = "browse"; render(); };
    Array.prototype.forEach.call(app.querySelectorAll(".mrow"), function (r) {
      r.onclick = function () {
        var mt = r.getAttribute("data-meeting"), kl = r.getAttribute("data-klasse");
        var m = DECK.meetings.filter(function (x) { return x.meeting === mt && x.klasse === kl; })[0] || { topic: "" };
        showMeetingPicker(mt, kl, m.topic);
      };
    });
  }
  function tile(v, l) { return '<div class="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5 dark:border-slate-800 dark:bg-slate-900 [&>b]:block [&>b]:text-xl [&>b]:tracking-tight sm:[&>b]:text-3xl [&>span]:text-xs [&>span]:text-slate-600 dark:[&>span]:text-slate-300"><b>' + v + "</b><span>" + l + "</span></div>"; }
  function modeBtn(mode, icon, label) {
    var d = modeDue(mode);
    return '<button class="' + ui.menubtn + '" data-mode="' + mode + '"><span class="' + ui.mi + '">' + icon + '</span>' +
      '<span class="text-sm font-bold sm:text-base">' + label + '</span>' + (d ? '<span class="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-950 dark:text-amber-200">' + d + ' fällig</span>' : '') + '</button>';
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
    var head = header();
    head += '<div class="mb-4 flex items-center gap-3">' +
      '<button class="' + ui.backlink + '" id="backBtn">← Beenden</button>' +
      '<div class="min-w-0 flex-1"><div class="flex h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"><i class="bg-emerald-600 dark:bg-emerald-400" style="width:' + pct + '%"></i></div></div>' +
      '<span class="text-sm text-slate-600 dark:text-slate-300">' + (S2.i + 1) + "/" + S2.queue.length + "</span></div>";
    var body;
    if (item.mode === "mcDe") body = viewMC(w, "mean");
    else if (item.mode === "mcMean") body = viewMC(w, "de");
    else if (item.mode === "type") body = viewType(w);
    else if (item.mode === "article") body = viewArticle(w);
    else body = viewFlash(w);
    app.innerHTML = head + body;
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
    return '<button aria-pressed="' + Boolean(on) + '" class="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-100 aria-pressed:border-amber-500 aria-pressed:bg-amber-100 aria-pressed:text-amber-950 dark:border-slate-700 dark:hover:bg-slate-800" id="flagBtn">⚑ ' + (on ? "Unsicher" : "Markieren") + "</button>";
  }
  function wireFlag(w) {
    var b = $("#flagBtn"); if (!b) return;
    b.onclick = function () { var on = toggleUnsure(w); b.setAttribute("aria-pressed", on); b.innerHTML = "⚑ " + (on ? "Unsicher" : "Markieren"); };
  }

  function extrasHtml(w) {
    var h = "";
    if (w.synonyme && w.synonyme.length) h += '<div class="my-1 break-words"><span class="mr-2 font-semibold text-teal-700 dark:text-teal-300">≈</span>' + esc(w.synonyme.join(", ")) + "</div>";
    if (w.gegenteil && w.gegenteil.length) h += '<div class="my-1 break-words"><span class="mr-2 font-semibold text-teal-700 dark:text-teal-300">↔</span>' + esc(w.gegenteil.join(", ")) + "</div>";
    if (w.kollokationen && w.kollokationen.length) h += '<div class="my-1 break-words"><span class="mr-2 font-semibold text-teal-700 dark:text-teal-300">+</span>' + esc(w.kollokationen.join(" · ")) + "</div>";
    if (w.hinweis) { var hn = w.hinweis[settings.lang] || w.hinweis.id || w.hinweis.en; if (hn) h += '<div class="my-1 break-words"><span class="mr-2 font-semibold text-teal-700 dark:text-teal-300">ℹ</span>' + esc(hn) + "</div>"; }
    if (h) h = '<div class="mt-3 text-sm">' + h + "</div>";
    var exs = (w.beispiele || []).slice(0, 2).map(function (e) {
      var tr = e[settings.lang] || e.id || e.en || "";
      return '<div class="mt-3 rounded-xl bg-slate-100 p-3 text-sm dark:bg-slate-800"><div class="font-semibold">' + esc(e.de) + '</div><div class="mt-1 text-slate-600 dark:text-slate-300">' + esc(tr) + "</div></div>";
    }).join("");
    return h + exs;
  }
  function metaChips(w) {
    return '<div class="flex flex-wrap gap-2"><span class="' + ui.chip + '">' + esc(w.typ || "") + '</span><span class="' + ui.chip + '">' + esc(w._klasse) + " · " + esc(fmtDate(w._meeting)) + "</span></div>";
  }

  /* flashcard (self-rated) */
  function viewFlash(w) {
    var html = '<div class="' + ui.card + '"><div class="mb-3 text-sm text-slate-600 dark:text-slate-300">Was bedeutet das? (denk nach, dann aufdecken)</div>' +
      '<div class="break-words text-2xl font-extrabold leading-tight tracking-tight sm:text-4xl">' + frontDe(w) + "</div>" +
      (w.plural ? '<div class="mt-1 text-sm text-slate-600 dark:text-slate-300">Pl.: ' + esc(w.plural) + "</div>" : "") +
      '<div id="revArea"></div>' +
      '<div class="mt-4" id="revBtnArea"><button class="' + ui.widePrimaryButton + '" id="revealBtn">Aufdecken</button></div>' +
      '<div class="mt-3">' + flagHtml(w) + "</div></div>";
    var S2 = S.session, item = S2.queue[S2.i];
    item._wire = function () {
      function reveal() {
        $("#revArea").innerHTML = '<div class="mt-4 border-t border-dashed border-slate-300 pt-4 dark:border-slate-700"><div class="break-words text-xl font-bold">' + esc(meaning(w)) + "</div>" + extrasHtml(w) + metaChips(w) + "</div>";
        $("#revBtnArea").innerHTML = '<div class="mt-3 grid gap-2 sm:grid-cols-3">' +
          '<button class="rounded-xl bg-rose-100 p-3 font-bold text-rose-900 hover:bg-rose-200" data-r="bad">Nicht gewusst</button>' +
          '<button class="rounded-xl bg-amber-100 p-3 font-bold text-amber-900 hover:bg-amber-200" data-r="warn">Unsicher</button>' +
          '<button class="rounded-xl bg-emerald-100 p-3 font-bold text-emerald-900 hover:bg-emerald-200" data-r="good">Gewusst</button></div>';
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
    var html = '<div class="' + ui.card + '"><div class="mb-3 text-sm text-slate-600 dark:text-slate-300">' + ask + '</div>' + prompt +
      '<div class="mt-4 grid gap-2" id="opts">' + opts.map(function (o, idx) {
        var label = kind === "mean" ? meaning(o) : (o.artikel && /^(der|die|das)$/.test(o.artikel) ? o.artikel + " " + o.de : o.de);
        return '<button class="' + ui.opt + '" data-id="' + esc(o.id) + '"><span class="grid size-7 shrink-0 place-items-center rounded-lg bg-slate-100 text-xs font-bold text-slate-800">' + (idx + 1) + '</span><span>' + esc(label) + "</span></button>";
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
    var html = '<div class="' + ui.card + '"><div class="mb-3 text-sm text-slate-600 dark:text-slate-300">Tippe das deutsche Wort:</div>' +
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
        $("#typeFb").innerHTML = '<div role="status" class="mt-3 font-bold ' + (ok ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300") + '">' + (ok ? "✓ Richtig!" : "✗ Richtig: " + esc(w.de)) + "</div>" +
          '<div class="mt-4 border-t border-dashed border-slate-300 pt-4 dark:border-slate-700"><div class="break-words text-xl font-bold">' + frontDe(w) + "</div>" + extrasHtml(w) + "</div>";
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
    var html = '<div class="' + ui.card + '"><div class="mb-3 text-sm text-slate-600 dark:text-slate-300">Welcher Artikel?</div>' +
      '<div class="break-words text-2xl font-extrabold leading-tight tracking-tight sm:text-4xl">' + esc(w.de) + "</div>" +
      (w.plural ? '<div class="mt-1 text-sm text-slate-600 dark:text-slate-300">Pl.: ' + esc(w.plural) + "</div>" : "") +
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
        $("#artFb").innerHTML = '<div class="mt-4 border-t border-dashed border-slate-300 pt-4 dark:border-slate-700"><div class="break-words text-xl font-bold">' + esc(w.artikel) + " " + esc(w.de) + "</div>" + extrasHtml(w) + "</div>";
        setTimeout(function () { if (S.session === S2 && S2.queue[S2.i] === item) next(ok ? "good" : "bad", w); }, ok ? 650 : 1400);
        setKey(function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); next(ok ? "good" : "bad", w); } });
      }
      Array.prototype.forEach.call(app.querySelectorAll("[data-a]"), function (b) { b.onclick = function () { choose(b.getAttribute("data-a"), b); }; });
      setKey(function (e) { var m = { "1": "der", "2": "die", "3": "das" }[e.key]; if (m) { var btns = app.querySelectorAll("[data-a]"); choose(m, btns["der die das".split(" ").indexOf(m)]); } });
    };
    return html;
  }

  function renderDone() {
    var S2 = S.session, tot = S2.right + S2.wrong;
    var html = header() + '<div class="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900"><div class="mb-2 text-4xl">🎉</div>' +
      '<h2 class="mb-2 text-2xl font-extrabold">Sitzung fertig!</h2>' +
      '<p class="text-sm text-slate-600 dark:text-slate-300">' + S2.right + " von " + tot + " richtig · Serie: " + (stats.streak || 0) + ' 🔥</p>' +
      '<div class="mt-3 flex flex-wrap gap-2">' +
        '<button class="rounded-xl bg-teal-700 px-4 py-3 font-bold text-white hover:bg-teal-800 dark:bg-teal-300 dark:text-teal-950 dark:hover:bg-teal-200" id="againBtn">Weiter üben</button>' +
        '<button class="' + ui.secondaryButton + '" id="homeBtn">Zur Übersicht</button></div></div>';
    app.innerHTML = html; wireHeader();
    $("#againBtn").onclick = function () { startSession({}); };
    $("#homeBtn").onclick = function () { S.session = null; S.view = "dashboard"; render(); };
  }

  /* ---------- browse ---------- */
  function renderBrowse() {
    var words = levelWords();
    var meetings = DECK.meetings.filter(function (m) { return S.level === "all" || m.klasse === S.level; });
    var html = header();
    html += '<div class="mb-4 flex items-center gap-3"><button class="' + ui.backlink + '" id="backBtn">← Übersicht</button><div class="min-w-0 flex-1"></div></div>';
    html += '<input class="' + ui.typeIn + '" type="search" aria-label="Wörter suchen" id="q" placeholder="Suchen …" value="' + esc(S.browseQuery) + '">';
    html += '<div class="mt-3 flex flex-wrap gap-2" id="mchips"><button class="rounded-full border border-slate-300 px-3 py-2 text-xs font-bold hover:bg-slate-100 aria-pressed:border-teal-600 aria-pressed:bg-teal-100 aria-pressed:text-teal-950 dark:border-slate-700 dark:hover:bg-slate-800" aria-pressed="' + (S.browseMeeting === "all") + '" data-m="all">Alle</button>' +
      meetings.map(function (m) { return '<button class="rounded-full border border-slate-300 px-3 py-2 text-xs font-bold hover:bg-slate-100 aria-pressed:border-teal-600 aria-pressed:bg-teal-100 aria-pressed:text-teal-950 dark:border-slate-700 dark:hover:bg-slate-800" aria-pressed="' + (S.browseMeeting === m.meeting) + '" data-m="' + esc(m.meeting) + '">' + esc(m.klasse + " " + fmtDate(m.meeting)) + "</button>"; }).join("") + "</div>";

    var q = S.browseQuery.toLowerCase();
    var list = words.filter(function (w) {
      if (S.browseMeeting !== "all" && w._meeting !== S.browseMeeting) return false;
      if (!q) return true;
      return (w.de + " " + meaning(w)).toLowerCase().indexOf(q) >= 0;
    });
    html += '<div class="mb-3 mt-7 text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">' + list.length + ' Wörter</div><div class="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white px-4 shadow-sm dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">';
    if (!list.length) html += '<div class="py-10 text-center text-sm text-slate-600 dark:text-slate-300">Nichts gefunden.</div>';
    list.forEach(function (w) {
      var b = boxOf(w); var p = prog(w.id);
      var colors = ["bg-slate-300", "bg-slate-400", "bg-amber-500", "bg-yellow-500", "bg-emerald-600", "bg-emerald-600"];
      var cls = "size-2.5 self-center rounded-full " + colors[b] + (p && p.unsure ? " ring-2 ring-amber-500 ring-offset-2 dark:ring-offset-slate-900" : "");
      html += '<div class="grid grid-cols-[auto_minmax(0,1fr)] items-baseline gap-x-3 gap-y-1 py-3 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)]"><span class="' + cls + '"></span>' +
        '<span class="break-words font-bold">' + frontDe(w) + "</span>" +
        '<span class="col-start-2 break-words text-sm text-slate-600 sm:col-start-3 dark:text-slate-300">' + esc(meaning(w)) + "</span></div>";
    });
    html += "</div>";
    app.innerHTML = html; wireHeader();
    $("#backBtn").onclick = function () { S.view = "dashboard"; render(); };
    var qi = $("#q"); qi.oninput = function () { S.browseQuery = qi.value; var pos = qi.selectionStart; renderBrowse(); var nq = $("#q"); nq.focus(); try { nq.setSelectionRange(pos, pos); } catch (e) {} };
    Array.prototype.forEach.call(app.querySelectorAll("[data-m]"), function (c) { c.onclick = function () { S.browseMeeting = c.getAttribute("data-m"); renderBrowse(); }; });
  }

  /* ---------- toast ---------- */
  var toastEl;
  var overlayClasses = "overlay fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 sm:items-center sm:p-4";
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement("div"); toastEl.className = "pointer-events-none fixed inset-x-4 bottom-5 z-40 mx-auto w-fit rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white opacity-0 shadow-lg motion-safe:transition-opacity [&.show]:opacity-100 dark:bg-slate-100 dark:text-slate-900"; toastEl.setAttribute("role", "status"); document.body.appendChild(toastEl); }
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
      g.items.map(function (it) { return '<div class="border-b border-slate-200 py-3 last:border-0 dark:border-slate-800 [&>b]:mb-1 [&>b]:block [&>p]:text-sm [&>p]:text-slate-600 dark:[&>p]:text-slate-300"><b>' + it[0] + '</b><p>' + it[1] + '</p></div>'; }).join("") +
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
        '<span class="' + ui.mi + '">' + icon + '</span><span class="text-sm font-bold sm:text-base">' + label + '</span>' +
        '<span class="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold dark:bg-slate-800">' + cnt + ' Wörter</span></button>';
    }
    var ov = document.createElement("div");
    ov.className = overlayClasses;
    ov.innerHTML = '<div class="' + ui.sheet + '"><h2>' + esc(klasse) + ' · ' + esc(fmtDate(meeting)) + '</h2>' +
      '<p class="mb-4 text-sm text-slate-600 dark:text-slate-300">' + esc(topic || "") + ' · ' + total + ' Wörter</p>' +
      '<div class="grid grid-cols-2 gap-3">' + mb("review", "🃏", "Karteikarten") + mb("mc", "✅", "Multiple Choice") +
        mb("type", "⌨️", "Eintippen") + mb("article", "der", "Artikel") + '</div>' +
      '<button class="mt-4 w-full rounded-xl border border-slate-300 px-4 py-3 font-bold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800" id="mpClose">Schließen</button></div>';
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
