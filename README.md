# ShokaiShelf (Public Beta 0.2.0)

ShokaiShelf ist ein moderner, lokaler Anime-Client mit AniList-Integration und einer leistungsstarken Recommendation-Engine ("NetRec Dream").

## ✨ Features (v0.2.0 Public Beta)

- **NetRec Dream Engine**: Personalisierte Empfehlungen, die komplett lokal berechnet werden (Privacy First).
- **Modernes UI**: Glassmorphism-Design mit flüssigen Animationen und Responsive Layouts.
- **AniList Sync**: Volle Synchronisation deiner Listen, Scores und Aktivitäten.
- **Discord Rich Presence**: Zeige deinen Freunden, was du gerade schaust.
- **Achievements**: Gamified Tracking deiner Anime-Reise.
- **Auto-Updater**: Automatische Updates via GitHub Releases.
- **Scrobbler**: Erkennt Video-Player und aktualisiert deinen Status automatisch (Beta).

## 🚀 Installation

1. Lade den neuesten Installer von der [Releases-Seite](https://github.com/Chaptiv/ShokaiShelf/releases) herunter.
2. Installiere die Anwendung.
3. Beim ersten Start wirst du durch den **Setup-Wizard** geführt.
   - Du benötigst einen AniList-Account.
   - Du musst eigene API-Credentials erstellen (Anleitung im Wizard).

## ⚠️ Bekannte Beta-Einschränkungen

- **Titel-Beschreibungen**: Werden aktuell meist auf Englisch angezeigt (AniList API Limitation).
- **Scrobbler**: Funktioniert am besten mit VLC und MPC-HC; Browser-Player werden experimentell unterstützt.
- **Performance**: Der erste Start/Scan kann je nach Listengröße einige Sekunden dauern.

## 🛠 Tech Stack

- **Frontend**: React, Vite, Framer Motion
- **Backend / Shell**: Electron, Node.js
- **Data**: AniList GraphQL API

## Feedback & Bugs

Bitte melde Fehler direkt im [Issue Tracker](https://github.com/Chaptiv/ShokaiShelf/issues).
Füge wenn möglich Screenshots und Logs hinzu.

---

© 2024-2026 Maximilian Erb. MIT License.