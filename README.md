# ShokaiShelf

Ein schlanker AniList-Client mit Hauseigener Shingen-UI und Empfehlungs-Engine als **Electron + React (Vite)** Desktop-App.

## Inhalt

* [Funktionen](#funktionen)
* [Warum ShokaiShelf?](#warum-shokaishelf)
* [Architektur](#architektur)
* [AnimeNetRec V2 (Empfehlungen)](#animenetrecv2-empfehlungen)
* [Sicherheit & Datenschutz](#sicherheit--datenschutz)
* [Installation](#installation)
* [Entwicklung](#entwicklung)
* [Builds](#builds)
* [Konfiguration](#konfiguration)
* [Bekannte Limitierungen / Roadmap](#bekannte-limitierungen--roadmap)
* [Lizenz](#lizenz)

---

## Funktionen

* AniList-Login (OAuth) mit lokalem Callback (127.0.0.1:43210).
* Bibliothek: „Watching / Completed / PTW“, Suchen, Trending, Nächste Ausstrahlungen.
* **AnimeNetRecV2**: personalisierte Empfehlungen – **lokal** berechnet.
* Caching für Viewer, Trending und Suche.
* Minimalistische, tastaturfreundliche Hauseigene Shingen-UI (seitliche Rail + Kartenansichten).

---

## Warum ShokaiShelf?

ShokaiShelf versucht **praktisch** zu sein: keine Cloud-Abhängigkeit, keine Telemetrie, kein Zwang zu Accounts außerhalb von AniList. Empfehlungen werden **nachvollziehbar lokal** berechnet (siehe unten), Ereignisse bleiben auf deinem Gerät.

---

## Architektur

```
Electron (Main)  ←IPC→  Renderer (React/Vite)
      │                           │
      └─ electron-store           └─ lokale UI-Zustände (localStorage)
                │
          OAuth Callback (HTTP 43210)
                │
             AniList API
```

* **Main Process**: Fenster, OAuth-Flow, IPC-Handler, Persistenz mit `electron-store`.
* **Preload**: `contextBridge` – nur whiteliste Funktionen sind im Renderer verfügbar.
* **Renderer**: React-App (Vite), ruft IPC-APIs auf, rendert UI.

### Wichtige Dateien

```
electron/
  main.js        # Electron Main (ESM), IPC, OAuth-Server
  preload.cjs    # Sicheres Bridge-API (window.shokai.*)
src/
  api/anilist.ts # GraphQL-Wrapper + Caching
  pages/         # Dashboard, Library, Search, Settings
  logic/
    netrecV2.ts  # AnimeNetRec V2 (ML-basiert, lokal)
    netrec.ts    # Alternative (graph-basiert)
  shingen/       # UI-Komponenten (Sidebar, Styles)
```

---

## AnimeNetRecV2 (Empfehlungen)

AnimeNetRecV2 ist eine hauseigene Empfehlungsengine, die Persönliche Anime-Recommendations auf Netflix Niveau vorschlagen soll.

**Ziel:** Empfehlungen, die mit der Zeit „persönlicher“ werden – **ohne** externe Dienste.

### Datenbasis

* Dein AniList-Profil (Listenstatus, Scores, PTW).
* Ein lokaler „Katalog“ (aus vorhandenen Media-Daten zusammengebaut).
* **Nutzungsereignisse (Events)**: Was wurde angezeigt, angeklickt, verborgen, zur Liste hinzugefügt usw.
  → werden lokal in `electron-store` gehalten (`rec.events`, max. 500).

### Modell

* **Kleines lineares Modell** (Logistic Regression light) mit Feature-Vektor (10 Dimensionen):

  * Bias, Popularität/Baseline
  * PTW-Flag, Long-Runner-Flag
  * „Sequel ohne Prequel“-Flag
  * eigener Score (normiert)
  * Zeit-/Recency-Faktor
  * Tag-/Studio-Anzahl (leicht normalisiert)
  * Veröffentlichungsjahr (normiert)
* **Online-Learning**: Bei **positiven** Events (click, add_to_ptw, play_start) werden Gewichte verstärkt, bei **negativen** (hide) reduziert.
* **Impressions**: jede gezeigte Empfehlung wird als „impression“ gespeichert; viele Impressions ohne Interaktion senken das Item.

### Ablauf (vereinfacht)

1. Lade Events (`rec:loadEvents`) + existierendes Modell (`rec:getModel`).
2. Aktualisiere Modell schrittweise pro Event (Gradientenupdate).
3. Berechne Score je Kandidat:

   * Baseline × (1 + Modell-Affinität)
   * * PTW-Boost
   * − Penalty für sehr lange Serien (ohne PTW)
   * − Penalty für „Sequel ohne gesehenes Prequel“
   * − Dämpfung bei vielen Impressions ohne Interaktion
4. Sortiere, nimm Top N (z. B. 12).
5. Schreibe Impressions (`rec:insertEvent`) + speichere Modell (`rec:setModel`).

**Wichtig:** Alles passiert **lokal**.
Keine Empfehlungssignale verlassen dein Gerät.

---

## Sicherheit & Datenschutz

* **Renderer** hat **keinen** Node-Zugriff (contextIsolation an).
* Zugriff nur über `window.shokai.*` (Preload-Bridge).
* Tokens & Modelle liegen lokal in `electron-store`.
* Keine Telemetrie, keine externen Calls außer AniList GraphQL/OAuth.

---

## Installation

Voraussetzungen:

**Einfacher Weg:**
Nutze die bereitgestellten Builds für das jeweilige Betriebssystem


**DEV-Builds oder selber bauen:**

* Node.js ≥ 18 (empfohlen 20)
* npm oder pnpm
* Windows, macOS (Intel/ARM) oder Linux

```bash
# Klonen
git clone https://github.com/chaptiv/ShokaiShelf.git
cd ShokaiShelf

# Abhängigkeiten
npm install
```

---

## Entwicklung

**Renderer dev + Electron:**

```bash
# Terminal A – Vite dev server
npm run dev:renderer
# (typisch startet auf http://localhost:5173)

# Terminal B – Electron im Dev
npm start
```

> Hinweis: Die App hat einen Fallback – wenn der Dev-Server nicht läuft, lädt sie `dist/index.html`.

**Renderer Build:**

```bash
npm run build:renderer
```

---

## Builds

### Windows (NSIS)

```bash
npm run build
# führt: vite build && electron-builder
# Output: release/<version>/ShokaiShelf-Windows-<version>-Setup.exe
```

### macOS (unsigniert zum Testen)

In `electron-builder.json5`:

```json5
{
  "mac": { "target": ["dmg","zip"], "identity": null }
}
```

Dann:

```bash
npm run build
# Output: release/<version>/ShokaiShelf-Mac-<version>.dmg
# Öffnen: Rechtsklick → Öffnen (Gatekeeper)
```

### Linux (AppImage)

```bash
npx electron-builder --linux AppImage
```

---

## Konfiguration

Beim ersten Start fragt die App nach:

* **AniList Client ID / Secret**
* **Redirect URI** (Standard: `http://127.0.0.1:43210/callback`)

Im AniList Konto unter Settings -> Developer eine neue App Hinzufügen. Dann die Redirect URL `http://127.0.0.1:43210/callback` angeben. Dann auf Save und die Client-ID und Secret in ShokaiShelf angeben.
Danach über den Knopf "Neu Starten" das Programm aktualisieren, auf "Bei AniList anmelden" klicken, und Fertig!

Die Werte werden lokal gespeichert.

---

## Bekannte Limitierungen / Roadmap

* **Kein Token-Refresh**: Access-Token wird noch nicht automatisch erneuert.
* **Tests**: Unit/Integration/E2E sind geplant (Vitest/Playwright).
* **AnimeNetRec V1 (Graph)**: optionaler Modus – noch nicht überall in der UI verdrahtet.
* **Große Listen**: Virtuelle Listenansicht (react-window) wird vorbereitet.
* **Auto-Update**: electron-updater nicht aktiviert.


## Bekannte Bugs

* **Fehlerhafte Anmdeldung erfolgreich Seite**: Derzeit wird bei erstanmeldung ein falscher "Login Erfolgreich" Bildschirm angezeigt.
* **Search zeigt keine Empfehlungen an**: Search nutzt derzeit noch den alten AnimeNetRec V1. Eine Migration auf V2 läuft bereits.
* **Dashboard zeigt im Normalen Fenstermodus Animes komisch an**: Dies kann derzeit damit behoben werden, das Fenster auf Bildschirmgroße zu machen.
* **Bannerbild wird nicht geladen**: In seltenen Fällen kann das Bannerbild nicht geladen werden. Wenn möglich, zieht ShokaiShelf ein Alternatives Bild, was aber kein Banner ist.

---

## Lizenz

ShokaiShelf – Source-Available License
Copyright (c) 2025 Chaptiv

1. Du darfst den Quellcode lesen und lokal für dich ausführen.
2. Du darfst keine abgeleiteten Werke veröffentlichen, die im Wesentlichen auf diesem Code basieren
   (z.B. gleicher Code mit anderem Namen/Theme/UI).
3. Du darfst den Code nicht verkaufen oder im Rahmen eines kommerziellen Produkts weitergeben.
4. Du darfst das Branding, den Namen "ShokaiShelf" und die Darstellung von AnimeNetRec V2 nicht
   ohne vorherige schriftliche Erlaubnis verwenden.
5. Verteilung erfolgt primär über vom Autor bereitgestellte Builds (exe/dmg/app). Eigene Builds
   dürfen nicht öffentlich verteilt werden.
6. Keine Garantie, keine Haftung.

Wenn du den Code nutzen willst (Fork, Port, Integration): bitte vorher anfragen.

AniList ist eine separate Plattform – halte dich an deren API-Richtlinien.

---

### Dank & Hinweise

ShokaiShelf ist ein Hobbyprojekt. Beiträge (Issues/PRs) sind willkommen.
