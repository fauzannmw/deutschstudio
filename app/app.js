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
    if (!hideArticle && w.artikel && /^(der|die|das)$/.test(w.artikel)) return '<span class="art">' + esc(w.artikel) + "</span> " + esc(w.de);
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

  /* ---------- rendering root ---------- */
  var app = document.getElementById("app");
  function setKey(fn) { S.key = fn; }
  document.addEventListener("keydown", function (e) { if (S.key) S.key(e); });

  function header(extra) {
    return '' +
      '<div class="top">' +
        '<span class="brand">🧠 Deutschstudio<small>B1 → C1</small></span>' +
        '<div class="ctrls">' +
          '<div class="lvlbar">' +
            levelBtn("all", "Alle") + levelBtn("B2.1", "B2.1") + levelBtn("B2.2", "B2.2") +
          '</div>' +
          '<button class="iconbtn" id="langBtn" title="Bedeutungssprache">' + (settings.lang === "id" ? "ID" : "EN") + '</button>' +
          '<button class="iconbtn" id="helpBtn" title="Anleitung">?</button>' +
        '</div>' +
      '</div>' + (extra || "");
  }
  function levelBtn(v, label) { return '<button data-lvl="' + v + '" class="' + (S.level === v ? "on" : "") + '">' + label + "</button>"; }

  function wireHeader() {
    Array.prototype.forEach.call(app.querySelectorAll("[data-lvl]"), function (b) {
      b.onclick = function () { S.level = b.getAttribute("data-lvl"); S.session = null; S.view = "dashboard"; render(); };
    });
    var lb = $("#langBtn"); if (lb) lb.onclick = function () { settings.lang = settings.lang === "id" ? "en" : "id"; save(K.set, settings); render(); };
    var hb = $("#helpBtn"); if (hb) hb.onclick = showHelp;
  }

  function render() {
    setKey(null);
    if (!DECK.words.length) { app.innerHTML = header() + '<div class="card empty">Noch keine Wörter. Zuerst <code>node build.js</code> ausführen.</div>'; wireHeader(); return; }
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
    html += '<div class="grid tiles">' +
      tile(due, "fällig heute") + tile(known + "/" + total, "gelernt") + tile((stats.streak || 0) + " 🔥", "Serie (Tage)") +
      '</div>';

    html += '<div class="section-title">Üben</div>' +
      '<div class="menu">' +
        modeBtn("review", "🃏", "Karteikarten") +
        modeBtn("mc", "✅", "Multiple Choice") +
        modeBtn("type", "⌨️", "Eintippen") +
        modeBtn("article", "der", "Artikel") +
      '</div>' +
      '<div class="btn-row" style="margin-top:10px">' +
        '<button class="btn btn-ghost" id="diffBtn" style="flex:1">⚑ Schwierige (' + unsure + ')</button>' +
        '<button class="btn btn-ghost" id="browseBtn" style="flex:1">📖 Alle Wörter</button>' +
      '</div>';

    html += '<div class="section-title">Fortschritt</div>' +
      '<div class="card">' +
        '<div class="bar"><i class="known" style="width:' + pKnown + '%"></i><i class="learning" style="width:' + pLearn + '%"></i></div>' +
        '<div class="legend"><span><i style="background:var(--good)"></i>Gelernt ' + known + '</span>' +
          '<span><i style="background:var(--warn)"></i>Am Lernen ' + learning + '</span>' +
          '<span><i style="background:var(--surface-2)"></i>Neu ' + neu + '</span></div>' +
      '</div>';

    html += '<div class="section-title">Nach Sitzung</div><div class="card" id="mlist">';
    meetings.forEach(function (m) {
      var mw = words.filter(function (w) { return w._meeting === m.meeting && w._klasse === m.klasse; });
      var kn = mw.filter(function (w) { return boxOf(w) >= 4; }).length;
      var pc = mw.length ? Math.round(kn / mw.length * 100) : 0;
      html += '<div class="mrow" data-meeting="' + esc(m.meeting) + '" data-klasse="' + esc(m.klasse) + '">' +
        '<div class="mt"><b>' + esc(m.klasse) + " · " + esc(fmtDate(m.meeting)) + '</b><span>' + esc(m.topic) + '</span></div>' +
        '<div class="bar mini"><i class="known" style="width:' + pc + '%"></i></div>' +
        '<div class="pct">' + pc + '%</div></div>';
    });
    html += "</div>";
    html += '<p class="center muted" style="margin-top:20px;font-size:12px">' + DECK.words.length + ' Karten · Fortschritt im Browser gespeichert</p>';

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
  function tile(v, l) { return '<div class="tile"><b>' + v + "</b><span>" + l + "</span></div>"; }
  function modeBtn(mode, icon, label) {
    var d = modeDue(mode);
    return '<button class="menubtn" data-mode="' + mode + '"><span class="mi">' + icon + '</span>' +
      '<span class="ml">' + label + '</span>' + (d ? '<span class="badge due">' + d + ' fällig</span>' : '') + '</button>';
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
    head += '<div class="sess-top">' +
      '<button class="backlink" id="backBtn">← Beenden</button>' +
      '<div class="prog"><div class="bar"><i class="known" style="width:' + pct + '%"></i></div></div>' +
      '<span class="muted" style="font-size:13px">' + (S2.i + 1) + "/" + S2.queue.length + "</span></div>";
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
    return '<button class="flagbtn ' + (on ? "on" : "") + '" id="flagBtn">⚑ ' + (on ? "Unsicher" : "Markieren") + "</button>";
  }
  function wireFlag(w) {
    var b = $("#flagBtn"); if (!b) return;
    b.onclick = function () { var on = toggleUnsure(w); b.classList.toggle("on", on); b.innerHTML = "⚑ " + (on ? "Unsicher" : "Markieren"); };
  }

  function extrasHtml(w) {
    var h = "";
    if (w.synonyme && w.synonyme.length) h += '<div class="kv"><span class="lbl">≈</span>' + esc(w.synonyme.join(", ")) + "</div>";
    if (w.gegenteil && w.gegenteil.length) h += '<div class="kv"><span class="lbl">↔</span>' + esc(w.gegenteil.join(", ")) + "</div>";
    if (w.kollokationen && w.kollokationen.length) h += '<div class="kv"><span class="lbl">+</span>' + esc(w.kollokationen.join(" · ")) + "</div>";
    if (w.hinweis) { var hn = w.hinweis[settings.lang] || w.hinweis.id || w.hinweis.en; if (hn) h += '<div class="kv"><span class="lbl">ℹ</span>' + esc(hn) + "</div>"; }
    if (h) h = '<div class="extra">' + h + "</div>";
    var exs = (w.beispiele || []).slice(0, 2).map(function (e) {
      var tr = e[settings.lang] || e.id || e.en || "";
      return '<div class="ex"><div class="de">' + esc(e.de) + '</div><div class="tr">' + esc(tr) + "</div></div>";
    }).join("");
    return h + exs;
  }
  function metaChips(w) {
    return '<div class="chips" style="margin-top:14px"><span class="chip">' + esc(w.typ || "") + '</span><span class="chip">' + esc(w._klasse) + " · " + esc(fmtDate(w._meeting)) + "</span></div>";
  }

  /* flashcard (self-rated) */
  function viewFlash(w) {
    var html = '<div class="card"><div class="q-ask">Was bedeutet das? (denk nach, dann aufdecken)</div>' +
      '<div class="q-de">' + frontDe(w) + "</div>" +
      (w.plural ? '<div class="q-sub">Pl.: ' + esc(w.plural) + "</div>" : "") +
      '<div id="revArea"></div>' +
      '<div style="margin-top:16px" id="revBtnArea"><button class="btn btn-primary btn-lg" id="revealBtn">Aufdecken</button></div>' +
      '<div style="margin-top:10px">' + flagHtml(w) + "</div></div>";
    var S2 = S.session, item = S2.queue[S2.i];
    item._wire = function () {
      function reveal() {
        $("#revArea").innerHTML = '<div class="reveal"><div class="mean">' + esc(meaning(w)) + "</div>" + extrasHtml(w) + metaChips(w) + "</div>";
        $("#revBtnArea").innerHTML = '<div class="opts rate">' +
          '<button class="opt bad" data-r="bad">Nicht gewusst</button>' +
          '<button class="opt warn" data-r="warn">Unsicher</button>' +
          '<button class="opt good" data-r="good">Gewusst</button></div>';
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
    var prompt = kind === "mean" ? '<div class="q-de">' + frontDe(w) + "</div>" : '<div class="q-de" style="font-size:22px">' + esc(meaning(w)) + "</div>";
    var html = '<div class="card"><div class="q-ask">' + ask + '</div>' + prompt +
      '<div class="opts" id="opts">' + opts.map(function (o, idx) {
        var label = kind === "mean" ? meaning(o) : (o.artikel && /^(der|die|das)$/.test(o.artikel) ? o.artikel + " " + o.de : o.de);
        return '<button class="opt" data-id="' + esc(o.id) + '"><span class="num">' + (idx + 1) + '</span><span>' + esc(label) + "</span></button>";
      }).join("") + "</div>" +
      '<div style="margin-top:12px">' + flagHtml(w) + "</div></div>";
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
        setTimeout(function () { if (S.view === "session" && S.session && S.session.queue[S.session.i].word.id === w.id) next(ok ? "good" : "bad", w); }, ok ? 650 : 1400);
      }
      Array.prototype.forEach.call(app.querySelectorAll(".opt"), function (b) { b.onclick = function () { choose(b); }; });
      setKey(function (e) { var n = parseInt(e.key, 10); if (n >= 1 && n <= opts.length) { var btns = app.querySelectorAll(".opt"); if (btns[n - 1]) choose(btns[n - 1]); } });
    };
    return html;
  }

  /* type the German word */
  function viewType(w) {
    var html = '<div class="card"><div class="q-ask">Tippe das deutsche Wort:</div>' +
      '<div class="q-de" style="font-size:22px">' + esc(meaning(w)) + "</div>" +
      '<div style="margin-top:14px"><input class="type-in" id="typeIn" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="auf Deutsch …"></div>' +
      '<div id="typeFb"></div>' +
      '<div style="margin-top:12px" id="typeBtns"><button class="btn btn-primary btn-lg" id="checkBtn">Prüfen</button></div>' +
      '<div style="margin-top:10px">' + flagHtml(w) + "</div></div>";
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
        $("#typeFb").innerHTML = '<div class="feedback ' + (ok ? "ok" : "no") + '">' + (ok ? "✓ Richtig!" : "✗ Richtig: " + esc(w.de)) + "</div>" +
          '<div class="reveal" style="margin-top:10px"><div class="mean">' + frontDe(w) + "</div>" + extrasHtml(w) + "</div>";
        $("#typeBtns").innerHTML = '<button class="btn btn-primary btn-lg" id="contBtn">Weiter →</button>';
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
    var html = '<div class="card"><div class="q-ask">Welcher Artikel?</div>' +
      '<div class="q-de">' + esc(w.de) + "</div>" +
      (w.plural ? '<div class="q-sub">Pl.: ' + esc(w.plural) + "</div>" : "") +
      '<div class="opts art3" id="arts">' + ["der", "die", "das"].map(function (a) { return '<button class="opt" data-a="' + a + '">' + a + "</button>"; }).join("") + "</div>" +
      '<div id="artFb"></div><div style="margin-top:12px">' + flagHtml(w) + "</div></div>";
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
        $("#artFb").innerHTML = '<div class="reveal"><div class="mean">' + esc(w.artikel) + " " + esc(w.de) + "</div>" + extrasHtml(w) + "</div>";
        setTimeout(function () { if (S.view === "session" && S.session && S.session.queue[S.session.i].word.id === w.id) next(ok ? "good" : "bad", w); }, ok ? 650 : 1400);
        setKey(function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); next(ok ? "good" : "bad", w); } });
      }
      Array.prototype.forEach.call(app.querySelectorAll("[data-a]"), function (b) { b.onclick = function () { choose(b.getAttribute("data-a"), b); }; });
      setKey(function (e) { var m = { "1": "der", "2": "die", "3": "das" }[e.key]; if (m) { var btns = app.querySelectorAll("[data-a]"); choose(m, btns["der die das".split(" ").indexOf(m)]); } });
    };
    return html;
  }

  function renderDone() {
    var S2 = S.session, tot = S2.right + S2.wrong;
    var html = header() + '<div class="card done-wrap"><div class="big">🎉</div>' +
      "<h2>Sitzung fertig!</h2>" +
      '<p class="muted">' + S2.right + " von " + tot + " richtig · Serie: " + (stats.streak || 0) + ' 🔥</p>' +
      '<div class="btn-row" style="justify-content:center;margin-top:10px">' +
        '<button class="btn btn-primary" id="againBtn">Weiter üben</button>' +
        '<button class="btn btn-ghost" id="homeBtn">Zur Übersicht</button></div></div>';
    app.innerHTML = html; wireHeader();
    $("#againBtn").onclick = function () { startSession({}); };
    $("#homeBtn").onclick = function () { S.session = null; S.view = "dashboard"; render(); };
  }

  /* ---------- browse ---------- */
  function renderBrowse() {
    var words = levelWords();
    var meetings = DECK.meetings.filter(function (m) { return S.level === "all" || m.klasse === S.level; });
    var html = header();
    html += '<div class="sess-top"><button class="backlink" id="backBtn">← Übersicht</button><div class="prog"></div></div>';
    html += '<input class="type-in" id="q" placeholder="Suchen …" value="' + esc(S.browseQuery) + '" style="font-size:16px;margin-bottom:10px">';
    html += '<div class="chips" id="mchips"><span class="chip ' + (S.browseMeeting === "all" ? "on" : "") + '" data-m="all">Alle</span>' +
      meetings.map(function (m) { return '<span class="chip ' + (S.browseMeeting === m.meeting ? "on" : "") + '" data-m="' + esc(m.meeting) + '">' + esc(m.klasse + " " + fmtDate(m.meeting)) + "</span>"; }).join("") + "</div>";

    var q = S.browseQuery.toLowerCase();
    var list = words.filter(function (w) {
      if (S.browseMeeting !== "all" && w._meeting !== S.browseMeeting) return false;
      if (!q) return true;
      return (w.de + " " + meaning(w)).toLowerCase().indexOf(q) >= 0;
    });
    html += '<div class="section-title">' + list.length + ' Wörter</div><div class="card wlist">';
    if (!list.length) html += '<div class="empty">Nichts gefunden.</div>';
    list.forEach(function (w) {
      var b = boxOf(w); var p = prog(w.id);
      var cls = "dot b" + b + (p && p.unsure ? " flag" : "");
      html += '<div class="witem"><span class="' + cls + '"></span>' +
        '<span class="wde">' + frontDe(w) + "</span>" +
        '<span class="wmean">' + esc(meaning(w)) + "</span></div>";
    });
    html += "</div>";
    app.innerHTML = html; wireHeader();
    $("#backBtn").onclick = function () { S.view = "dashboard"; render(); };
    var qi = $("#q"); qi.oninput = function () { S.browseQuery = qi.value; var pos = qi.selectionStart; renderBrowse(); var nq = $("#q"); nq.focus(); try { nq.setSelectionRange(pos, pos); } catch (e) {} };
    Array.prototype.forEach.call(app.querySelectorAll("[data-m]"), function (c) { c.onclick = function () { S.browseMeeting = c.getAttribute("data-m"); renderBrowse(); }; });
  }

  /* ---------- toast ---------- */
  var toastEl;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement("div"); toastEl.className = "toast"; document.body.appendChild(toastEl); }
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
    ov.className = "overlay";
    ov.innerHTML = '<div class="sheet"><h2>' + esc(g.title) + '</h2>' +
      g.items.map(function (it) { return '<div class="gitem"><b>' + it[0] + '</b><p>' + it[1] + '</p></div>'; }).join("") +
      '<button class="btn btn-primary btn-lg" id="helpClose">' + esc(g.close) + '</button></div>';
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
      return '<button class="menubtn" data-mode="' + mode + '"' + (cnt ? '' : ' disabled') + '>' +
        '<span class="mi">' + icon + '</span><span class="ml">' + label + '</span>' +
        '<span class="badge">' + cnt + ' Wörter</span></button>';
    }
    var ov = document.createElement("div");
    ov.className = "overlay";
    ov.innerHTML = '<div class="sheet"><h2>' + esc(klasse) + ' · ' + esc(fmtDate(meeting)) + '</h2>' +
      '<p class="muted" style="margin:-8px 0 14px">' + esc(topic || "") + ' · ' + total + ' Wörter</p>' +
      '<div class="menu">' + mb("review", "🃏", "Karteikarten") + mb("mc", "✅", "Multiple Choice") +
        mb("type", "⌨️", "Eintippen") + mb("article", "der", "Artikel") + '</div>' +
      '<button class="btn btn-ghost btn-lg" id="mpClose" style="margin-top:14px">Schließen</button></div>';
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
