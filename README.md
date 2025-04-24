# ShokaiShelf
![ChatGPT Image 23  Apr  2025, 23_50_12](https://github.com/user-attachments/assets/eea7f139-5564-4715-bb31-51d2256a34bf)
ShokaiShelf is a desktop application for organizing your anime collection. Search and browse anime via the AniList API, build a **Watch List** for series you want to track and a **Buy List** for DVDs & Blu-Rays—all in a modern, Qt6-powered interface.

---

## Features

- **Anime Search & Discovery**  
  - Search by title, genre and release year  
  - Home screen with the current year’s most popular anime  
- **Personal Lists**  
  - **Watch List** – keep track of what you want to watch  
  - **Buy List** – plan your DVD/Blu-Ray purchases  
- **Offline-persistent Storage**  
  - SQLite database stored in your OS’s AppData folder  
- **Asynchronous Image Loading**  
  - Fetch cover art without blocking the UI  
  - LRU cache to minimize network requests  
- **Polished UI**  
  - PyQt6 + optional Qt-Material theming  
  - Custom smooth-scrolling, responsive layouts and splash screen  
- **Auto-Updater**  
  - Checks for and applies updates at launch  

---

## Installation

1. **Clone the repository**  
   ```bash
   git clone https://github.com/your-username/ShokaiShelf.git
   cd ShokaiShelf
   ```

2. **(Optional) Create & activate a virtual environment**  
   ```bash
   python -m venv venv
   source venv/bin/activate    # Linux / macOS
   venv\Scripts\activate       # Windows
   ```

3. **Install dependencies**  
   ```bash
   pip install PyQt6 aiohttp requests packaging
   # Optional: for a Material theme
   pip install qt-material
   ```

   Or, if you provide a `requirements.txt`:  
   ```bash
   pip install -r requirements.txt
   ```

---

## Usage

### From source  
```bash
python -m ShokaiShelf.main
```

### Windows Executable  
Double-click the `ShokaiShelf.exe` in your distribution package.

---

### Project Structure

```
ShokaiShelf/
├── api.py           # AniList GraphQL integration (search & popular)
├── database.py      # SQLite storage for watch_list & buy_list
├── main.py          # Entry point, UI setup & application logic
├── models.py        # Data models & shared style constants
├── ui_components.py # Reusable Qt widgets (cards, buttons, inputs)
├── utils.py         # Image loader, LRU cache & worker signals
└── updater.py       # Auto-update mechanism
```

---

## Development & Packaging

To build a standalone Windows executable with **PyInstaller**:

```bash
pip install pyinstaller
pyinstaller --onefile --windowed --name ShokaiShelf main.py
```

Adjust `--add-data` flags if you include resources (e.g. `translations/`).

---

## Known Issues

- Splash-screen updater may fail behind strict corporate proxies.  
- Description text is fetched raw from AniList and may contain HTML tags.  
- First launch may take a moment as the database and cache initialize.

---

## Update Rollout

- **Major Releases** (e.g. v0.0.5 and above)  
  Available via both GitHub Releases and the built-in auto-updater.

- **Minor Updates, Desings and Hotfixes** (e.g. v0.0.4a, v0.0.4b)  
  Delivered exclusively through the auto-updater for seamless patching.

  _ShokaiShelf v0.0.4 or later is required to receive any updates via the auto-updater._

## License

ShokaiShelf is released under the **MIT License**. See [LICENSE](LICENSE) for details. (In the Making)

---

> **Note:** ShokaiShelf is currently in early development. Feedback, bug reports and contributions are very welcome!
```
