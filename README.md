# ShokaiShelf  
A lightweight AniList client with an in-house Shingen UI and a fully local recommendation engine, built as an Electron + React (Vite) desktop app.

---

## Table of Contents
- Features  
- Why ShokaiShelf?  
- Architecture  
- AnimeNetRec V2 (Recommendations)  
- Security & Privacy  
- Installation  
- Development  
- Builds  
- Configuration  
- Known Limitations / Roadmap  
- License  

---

## Features

- AniList OAuth login with a local callback (http://127.0.0.1:43210).  
- Library views: Watching, Completed, Plan-to-Watch; plus search, trending, and next-airing sections.  
- AnimeNetRec V2: fully local, personalized recommendations.  
- Caching for viewer, trending, and search data.  
- Minimal, keyboard-friendly in-house “Shingen UI” (sidebar rail + card layout).

---

## Why ShokaiShelf?

ShokaiShelf focuses on practicality:  
- No cloud dependencies  
- No telemetry  
- No accounts beyond AniList  
- All recommendation data stays on your device  
- Local, transparent machine-learning model  

The goal is a fast, private AniList client with a modern UI and genuinely helpful recommendations — without external processing.

---

## Architecture

Electron (Main) ←IPC→ Renderer (React/Vite)
│ │
└─ electron-store └─ local UI state (localStorage)
│
OAuth callback (HTTP 43210)
│
AniList API

markdown
Code kopieren

**Main process**  
- Window creation  
- OAuth flow  
- IPC handlers  
- Persistence via electron-store  

**Preload**  
- Secure contextBridge  
- Only whitelisted functions are exposed as `window.shokai.*`  

**Renderer**  
- React app (Vite)  
- Uses IPC APIs  
- Renders UI  

### Important Files
electron/
main.js # Electron main (ESM), IPC, OAuth server
preload.cjs # secure API bridge (window.shokai.*)

src/
api/anilist.ts # GraphQL wrapper + caching
pages/ # Dashboard, Library, Search, Settings
logic/
netrecV2.ts # AnimeNetRec V2 (local ML engine)
netrec.ts # alternative (graph-based)
shingen/ # UI components/styles

yaml
Code kopieren

---

## AnimeNetRec V2 (Recommendations)

AnimeNetRec V2 is a custom-built local recommendation engine designed to give “Netflix-like” personalized suggestions — computed entirely on your device.

### Data Basis
- Your AniList profile (list status, scores, PTW)  
- Local media catalog  
- Usage events: shown, clicked, hidden, added to list  
- Stored locally in electron-store (`rec.events`, up to 500 entries)

### Model

A lightweight linear model (logistic regression) with a 10-dimensional feature vector:

- bias, popularity baseline  
- PTW flag  
- long-runner flag  
- “sequel without prequel” flag  
- own score (normalized)  
- recency factor  
- tag/studio count (normalized)  
- release year  

Online learning:  
- Positive actions (click, add_to_ptw, play_start) reinforce weights  
- Negative actions (hide) weaken them  

Impressions (items shown but not interacted with) are also stored — many impressions without interaction reduce that item’s score.

### Flow (Simplified)

1. Load events (`rec:loadEvents`) and existing model (`rec:getModel`).  
2. Update model step-by-step (gradient updates).  
3. Score all candidates with:  
   - baseline × (1 + model affinity)  
   - PTW boost  
   - penalties for long shows without PTW  
   - penalty for sequels without prequels  
   - damping for heavy “impression spam”  
4. Sort and take the top N.  
5. Write impressions (`rec:insertEvent`) and save model (`rec:setModel`).  

**Everything stays local — no recommendation data leaves your device.**

---

## Security & Privacy

- Renderer has **no Node.js access** (contextIsolation enabled).  
- Communication only via strict preload API (`window.shokai.*`).  
- Tokens and model data stored locally through electron-store.  
- No telemetry, no tracking, no analytics.  
- Only external calls: AniList OAuth + AniList GraphQL.

---

## Installation

### Requirements
- Use the official builds for your OS (recommended)

### Build Yourself
- Node.js ≥ 18 (20 recommended)  
- npm or pnpm  
- Windows, macOS (Intel/ARM), or Linux  


## Configuration

On first start ShokaiShelf requires the following AniList credentials:

- **AniList Client ID**
- **AniList Client Secret**
- **Redirect URI**  
  Default: `http://127.0.0.1:43210/callback`

### How to set this up

1. Visit **AniList → Settings → Developer**  
2. Click **Create New App**  
3. Set the Redirect URL to:  
   `http://127.0.0.1:43210/callback`
4. Copy the generated **Client ID** and **Client Secret** into ShokaiShelf  
5. Restart the app and click **"Log in with AniList"**

All values are stored **locally** on your device.

---

## Known Limitations / Roadmap

- No automatic token refresh implemented yet
- Large list views will be virtualized for better performance  
- Auto-update (electron-updater) is currently disabled  
- Additional ML features planned for AnimeNetRec V2  
- UI responsiveness improvements for smaller window sizes

---

## License

**ShokaiShelf – Source-Available License © 2025 Chaptiv**

You may:

- Read the source code  
- Run the software locally for personal use  

You may **not**:

- Publish derivative works based on this code  
- Rebrand, reskin, or redistribute modified builds  
- Sell the software or include it in a commercial product  
- Use the name **“ShokaiShelf”**, its branding, or the presentation of **AnimeNetRec V2** without permission  

Official distribution is provided only through the releases published by the author.  
Self-built versions must **not** be publicly distributed.

AniList is a separate platform — please follow their API usage rules.

---

## Thanks & Notes

ShokaiShelf is a hobby project built with care and curiosity.  
Issues and pull requests are welcome.
