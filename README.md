# Deutschstudio

Persönlicher Vokabeltrainer von **B1 Richtung C1**, gebaut aus Fauzans eigenen Unterrichtsmaterialien.
Vanilla HTML/CSS/JS, **keine Abhängigkeiten**, Fortschritt im Browser (`localStorage`).

## Lokal benutzen
- Doppelklick auf `app/index.html` in einem normalen Browser (Chrome/Edge), **oder**
- einen kleinen Server starten und `http://localhost:4599` öffnen:
  ```bash
  python -m http.server 4599 --directory app
  ```

## Neue Vokabeln hinzufügen (pro Sitzung)
1. Eine JSON-Datei in `content/wortschatz/<Level>/<YYYY-MM-DD>.json` ablegen
   (Schema: siehe vorhandene Dateien; Pflicht pro Wort: `id`, `de`, `typ`, `bedeutung {id,en}`).
2. Bundle neu bauen:
   ```bash
   node build.js
   ```
3. Fertig – beim Deploy macht Vercel Schritt 2 automatisch bei jedem `git push`.

## Online stellen (Vercel + GitHub)
- Repo zu GitHub pushen, in Vercel importieren.
- Vercel-Einstellungen stehen schon in `vercel.json`
  (Build: `node build.js`, Output: `app`). Kein `node_modules`, kein Backend.

## Trainingsmodi (MVP)
Karteikarten + Spaced Repetition (Leitner), Multiple Choice (beide Richtungen),
Eintippen, Artikel (der/die/das). Wörter als **„unsicher"** markieren → eigener Stapel.

## Ordner
```
content/wortschatz/<Level>/*.json   Inhalt (eine Datei pro Sitzung)
build.js                            bündelt Inhalt -> app/data.js
app/                                die Website (index.html, style.css, app.js, data.js)
docs/                               Architektur (arc42) + ADRs
```
