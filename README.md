# Deutschstudio

Persönlicher Vokabeltrainer von **B1 Richtung C1**, gebaut aus Fauzans eigenen Unterrichtsmaterialien.
Vanilla HTML/JavaScript mit Tailwind CSS, Fortschritt im Browser (`localStorage`).

## Lokal benutzen
- Doppelklick auf `app/index.html` in einem normalen Browser (Chrome/Edge), **oder**
- einen kleinen Server starten und `http://localhost:4599` öffnen:
  ```bash
  python -m http.server 4599 --directory app
  ```

## Neue Vokabeln hinzufügen (pro Sitzung)
1. Eine JSON-Datei in `content/wortschatz/<Level>/<YYYY-MM-DD>.json` ablegen
   (strenges Schema: siehe [`docs/content-schema.md`](docs/content-schema.md) bzw.
   [`docs/wortschatz.schema.json`](docs/wortschatz.schema.json); Pflicht pro Wort:
   `id`, `de`, `typ`, `modi`, `bedeutung {id,en}`).
2. Bundle neu bauen und validieren:
   ```bash
   node build.js
   ```
3. Fertig – beim Deploy macht Vercel Schritt 2 automatisch bei jedem `git push`.

## Online stellen (Vercel + GitHub)
- Repo zu GitHub pushen, in Vercel importieren.
- Vercel-Einstellungen stehen schon in `vercel.json`
  (Build: `npm run build:css && node build.js`, Output: `app`). Vercel baut das
  Tailwind-Stylesheet also bei **jedem** Deploy frisch aus der aktuellen Auszeichnung –
  es kann nie aus Versehen veraltet bleiben.

## Stylesheet lokal aktualisieren
Nur nötig, wenn man **lokal per Doppelklick** (ohne Server) mit geänderten
Tailwind-Klassen arbeiten will – für Vercel passiert das automatisch (siehe oben).
- Einmal `npm install` ausführen (legt `node_modules/` nur temporär an, ist in `.gitignore`).
- Nach Änderungen an Tailwind-Klassen in `app/app.js`/`app/index.html`:
  ```bash
  npm run build:css
  ```
  und `app/tailwind.css` mit einchecken.
- `app/theme.css` enthält nur echtes Custom-CSS (mobile Navigation, Hero-Grafik,
  gezielte Mobil-Feinschliffe) – keine Tailwind-Klassen von Hand nachbauen.
- `node_modules/` danach wieder löschen (`rm -rf node_modules`), damit der
  Projektordner in OneDrive schlank bleibt.

## Trainingsmodi (MVP)
Karteikarten + Spaced Repetition (Leitner), Multiple Choice (beide Richtungen),
Eintippen, Artikel (der/die/das). Wörter als **„unsicher"** markieren → eigener Stapel.

## Ordner
```
content/wortschatz/<Level>/*.json   Inhalt (eine Datei pro Sitzung)
build.js                            bündelt Inhalt -> app/data.js
app/                                die Website (index.html, app.js, data.js, tailwind.css, theme.css)
docs/                               Architektur (arc42) + ADRs
```
