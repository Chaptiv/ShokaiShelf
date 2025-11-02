# ShokaiShelf

A lightweight AniList client with an in-house Shingen UI and recommendation engine as an **Electron + React (Vite)** desktop app.

## Table of Contents

* [Features](#features)
* [Why ShokaiShelf?](#why-shokaishelf)
* [Architecture](#architecture)
* [AnimeNetRec V2 (Recommendations)](#animenetrec-v2-recommendations)
* [Security & Privacy](#security--privacy)
* [Installation](#installation)
* [Development](#development)
* [Builds](#builds)
* [Configuration](#configuration)
* [Known Limitations / Roadmap](#known-limitations--roadmap)
* [License](#license)

---

## Features

* AniList login (OAuth) with local callback (`127.0.0.1:43210`).
* Library: “Watching / Completed / PTW”, search, trending, next airing.
* **AnimeNetRec V2**: personalized recommendations – computed **locally**.
* Caching for viewer, trending and search.
* Minimal, keyboard-friendly in-house **Shingen UI** (sidebar rail + card layout).

---

## Why ShokaiShelf?

ShokaiShelf tries to be **practical**: no cloud dependency, no telemetry, no account requirement beyond AniList. Recommendations are calculated **locally and transparently** (see below), events stay on your device.

---

## Architecture

```text
Electron (Main)  ←IPC→  Renderer (React/Vite)
      │                           │
      └─ electron-store           └─ local UI state (localStorage)
                │
          OAuth callback (HTTP 43210)
                │
             AniList API
```

* **Main process**: window, OAuth flow, IPC handlers, persistence via `electron-store`.
* **Preload**: `contextBridge` – only whitelisted functions are exposed to the renderer.
* **Renderer**: React app (Vite), calls IPC APIs, renders UI.

### Important files

```text
electron/
  main.js        # Electron main (ESM), IPC, OAuth server
  preload.cjs    # secure bridge API (window.shokai.*)
src/
  api/anilist.ts # GraphQL wrapper + caching
  pages/         # Dashboard, Library, Search, Settings
  logic/
    netrecV2.ts  # AnimeNetRec V2 (ML-based, local)
    netrec.ts    # alternative (graph-based)
  shingen/       # UI components (sidebar, styles)
```

---

## AnimeNetRec V2 (Recommendations)

AnimeNetRec V2 is an in-house recommendation engine that aims to suggest personal anime recommendations on a Netflix-like level.

**Goal:** recommendations that get “more personal” over time – **without** external services.

### Data basis

* Your AniList profile (list status, scores, PTW).
* A local “catalog” (built from available media data).
* **Usage events**: what was shown, clicked, hidden, added to list, etc.
  → stored locally in `electron-store` (`rec.events`, max. 500).

### Model

* **Small linear model** (light logistic regression) with a 10-dim feature vector:

  * bias, popularity/baseline
  * PTW flag, long-runner flag
  * “sequel without prequel” flag
  * own score (normalized)
  * time/recency factor
  * tag/studio count (lightly normalized)
  * release year (normalized)
* **Online learning**: for **positive** events (click, add_to_ptw, play_start) weights are increased, for **negative** (hide) they are reduced.
* **Impressions**: every shown recommendation is stored as an “impression”; many impressions without interaction lower that item.

### Flow (simplified)

1. Load events (`rec:loadEvents`) + existing model (`rec:getModel`).
2. Update model step-by-step per event (gradient update).
3. Score each candidate:

   * baseline × (1 + model affinity)
   * * PTW boost
   * − penalty for very long shows (without PTW)
   * − penalty for “sequel without seen prequel”
   * − damping for many impressions without interaction
4. Sort, take top N (e.g. 12).
5. Write impressions (`rec:insertEvent`) + save model (`rec:setModel`).

**Important:** everything happens **locally**.
No recommendation signals leave your device.

---

## Security & Privacy

* **Renderer** has **no** Node access (`contextIsolation` enabled).
* Access only via `window.shokai.*` (preload bridge).
* Tokens & models are stored locally in `electron-store`.
* No telemetry, no external calls except AniList GraphQL/OAuth.

---

## Installation

Requirements:

**Easy way:**
Use the provided builds for your OS.

**DEV / build yourself:**

* Node.js ≥ 18 (20 recommended)
* npm or pnpm
* Windows, macOS (Intel/ARM) or Linux

```bash
# clone
git clone https://github.com/chaptiv/ShokaiShelf.git
cd ShokaiShelf

# install deps
npm install
```

---

## Development

**Renderer dev + Electron:**

```bash
# Terminal A – Vite dev server
npm run dev:renderer
# (typically starts on http://localhost:5173)

# Terminal B – Electron dev
npm start
```

> Note: the app has a fallback – if the dev server isn’t running, it will load `dist/index.html`.

**Renderer build:**

```bash
npm run build:renderer
```

---

## Builds

### Windows (NSIS)

```bash
npm run build
# runs: vite build && electron-builder
# Output: release/<version>/ShokaiShelf-Windows-<version>-Setup.exe
```

### macOS (unsigned for testing)

In `electron-builder.json5`:

```json5
{
  "mac": { "target": ["dmg","zip"], "identity": null }
}
```

Then:

```bash
npm run build
# Output: release/<version>/ShokaiShelf-Mac-<version>.dmg
# Open: right click → Open (Gatekeeper)
```

### Linux (AppImage)

```bash
npx electron-builder --linux AppImage
```

---

## Configuration

On first start the app asks for:

* **AniList Client ID / Secret**
* **Redirect URI** (default: `http://127.0.0.1:43210/callback`)

In your AniList account go to *Settings → Developer*, create a new app, set redirect URL to `http://127.0.0.1:43210/callback`. Then click save and enter the Client ID and Secret in ShokaiShelf.
After that click the “Restart” button to refresh the app, then click “Log in with AniList”, and you’re done.

Values are stored locally.

---

## Known Limitations / Roadmap

* **No token refresh yet**: access token is not automatically renewed.
* **Tests**: unit/integration/E2E are planned (Vitest/Playwright).
* **AnimeNetRec V1 (graph)**: optional mode – not yet wired in all UI parts.
* **Large lists**: virtualized list view (react-window) planned.
* **Auto-update**: electron-updater not enabled.

---

## Known Bugs

* **Wrong “login successful” screen**: currently a wrong success screen is shown on first login.
* **Search shows no recommendations**: search still uses the old AnimeNetRec V1. Migration to V2 is in progress.
* **Dashboard layout in normal window mode**: sometimes cards look odd in non-maximized mode; maximizing the window fixes it for now.
* **Banner image not loaded**: in rare cases the banner image cannot be fetched. If possible, ShokaiShelf falls back to another image, but it won’t be a real banner.

---

## License

ShokaiShelf – Source-Available License
Copyright (c) 2025 Chaptiv

1. You may read the source code and run it locally for yourself.
2. You may **not** publish derivative works that are essentially based on this code
   (e.g. same code with different name/theme/UI).
3. You may **not** sell the code or redistribute it as part of a commercial product.
4. You may **not** use the branding, the name “ShokaiShelf”, or the presentation of AnimeNetRec V2
   without prior written permission.
5. Distribution is primarily via the official builds provided by the author (exe/dmg/app).
   Self-built versions must **not** be publicly distributed.
6. No warranty, no liability.

If you want to use the code (fork, port, integration): please ask first.

AniList is a separate platform – please follow their API rules.

---

### Thanks & Notes

ShokaiShelf is a hobby project. Contributions (issues/PRs) are welcome.
