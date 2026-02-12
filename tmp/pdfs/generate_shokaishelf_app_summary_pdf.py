#!/usr/bin/env python3
import os
import textwrap
from datetime import datetime, timezone


OUT_PATH = "output/pdf/shokaishelf-app-summary.pdf"


def escape_pdf_text(text: str) -> str:
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def text_cmd(x: float, y: float, text: str, font: str = "F1", size: float = 10.0) -> str:
    return f"BT /{font} {size} Tf 1 0 0 1 {x:.2f} {y:.2f} Tm ({escape_pdf_text(text)}) Tj ET"


class Layout:
    def __init__(self) -> None:
        self.commands: list[str] = []
        self.y = 752.0
        self.left = 54.0
        self.body_size = 10.0
        self.body_leading = 12.0

    def add_title(self, text: str) -> None:
        self.commands.append(text_cmd(self.left, self.y, text, font="F2", size=18.0))
        self.y -= 20.0

    def add_subtitle(self, text: str) -> None:
        self.commands.append(text_cmd(self.left, self.y, text, font="F1", size=9.0))
        self.y -= 16.0

    def add_heading(self, text: str) -> None:
        self.commands.append(text_cmd(self.left, self.y, text, font="F2", size=12.0))
        self.y -= 14.0

    def add_paragraph(self, text: str, width: int = 98) -> None:
        for line in textwrap.wrap(text, width=width):
            self.commands.append(text_cmd(self.left, self.y, line, font="F1", size=self.body_size))
            self.y -= self.body_leading
        self.y -= 4.0

    def add_bullets(self, items: list[str], width: int = 92) -> None:
        for item in items:
            wrapped = textwrap.wrap(item, width=width)
            if not wrapped:
                continue
            self.commands.append(text_cmd(self.left, self.y, f"- {wrapped[0]}", font="F1", size=self.body_size))
            self.y -= self.body_leading
            for extra in wrapped[1:]:
                self.commands.append(text_cmd(self.left + 12.0, self.y, extra, font="F1", size=self.body_size))
                self.y -= self.body_leading
        self.y -= 4.0

    def check_fit(self) -> None:
        if self.y < 42.0:
            raise RuntimeError("Content overflowed page bounds; reduce content.")


def build_pdf_stream(layout: Layout) -> bytes:
    stream = "\n".join(layout.commands) + "\n"
    return stream.encode("latin-1", errors="replace")


def write_pdf(path: str, content_stream: bytes) -> None:
    objects: list[bytes] = []
    objects.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    objects.append(b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
    objects.append(
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>"
    )
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>")
    objects.append(
        f"<< /Length {len(content_stream)} >>\nstream\n".encode("latin-1")
        + content_stream
        + b"endstream"
    )

    pdf = bytearray()
    pdf.extend(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = [0]

    for idx, obj in enumerate(objects, start=1):
        offsets.append(len(pdf))
        pdf.extend(f"{idx} 0 obj\n".encode("latin-1"))
        pdf.extend(obj)
        pdf.extend(b"\nendobj\n")

    xref_pos = len(pdf)
    pdf.extend(f"xref\n0 {len(objects) + 1}\n".encode("latin-1"))
    pdf.extend(b"0000000000 65535 f \n")
    for off in offsets[1:]:
        pdf.extend(f"{off:010d} 00000 n \n".encode("latin-1"))

    pdf.extend(
        (
            "trailer\n"
            f"<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
            "startxref\n"
            f"{xref_pos}\n"
            "%%EOF\n"
        ).encode("latin-1")
    )

    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(pdf)


def main() -> None:
    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    layout = Layout()
    layout.add_title("ShokaiShelf-Beta: One-Page App Summary")
    layout.add_subtitle(f"Generated from repository evidence only ({generated_at})")

    layout.add_heading("What it is")
    layout.add_paragraph(
        "ShokaiShelf-Beta is an Electron desktop app with a React frontend for AniList-connected anime tracking and discovery. "
        "It combines library management, recommendation engines, social activity, and local desktop integrations in one client."
    )

    layout.add_heading("Who it is for")
    layout.add_paragraph(
        "Primary persona: AniList users who actively watch and track anime and want a desktop companion for recommendations, "
        "scrobbling, and alerts."
    )

    layout.add_heading("What it does")
    layout.add_bullets(
        [
            "Runs AniList OAuth setup/login and AniList GraphQL reads/writes (viewer, lists, search, save/delete list entries).",
            "Shows personalized recommendations via local recommendation logic (`netrecV3` and `netrecDream`) plus feedback learning.",
            "Provides a library workspace with status tabs, progress edits, sort/filter controls, and airing-focused views.",
            "Supports anime search/discovery with query input, popular genre shortcuts, mood/vibe selection, and quick add/update.",
            "Includes a social feed view (following/global) and a composer for creating activity posts.",
            "Offers desktop integrations: notifications, Discord Rich Presence, local scrobbler matching, and Miru extension bridge.",
        ]
    )

    layout.add_heading("How it works (architecture)")
    layout.add_bullets(
        [
            "Renderer layer (React): pages/components in `src/`, AniList API wrapper in `src/api/anilist.ts`, and recommendation/feedback logic in `src/logic/*`.",
            "Bridge layer (preload): `electron/preload.js` exposes `window.shokai` APIs and forwards renderer calls via Electron IPC.",
            "Main process layer: `electron/main.js` owns OAuth callback handling, IPC handlers, app services (`ScrobblerEngine`, `DiscordPresence`, `NotificationEngine`, `MiruBridge`), and persistent store access.",
            "Data flow: UI action -> `window.shokai` API -> IPC handler -> local store/service and/or AniList endpoints -> response back to renderer.",
            "Offline cache/sync code exists in repo (`electron/offlineStore.ts`, `src/logic/offline/sync-manager.ts`) but runtime main process currently sets `offlineStore = null` with offline mode unavailable.",
        ]
    )

    layout.add_heading("How to run (minimal)")
    layout.add_bullets(
        [
            "Install dependencies: `npm install`.",
            "Run development app: `npm run dev` (starts Vite and Electron).",
            "On first launch, open setup, enter AniList Client ID/Secret, then sign in through AniList OAuth.",
            "Create production package: `npm run build`.",
            "Required Node.js version: Not found in repo. Supported OS matrix: Not found in repo.",
        ]
    )

    layout.check_fit()
    content_stream = build_pdf_stream(layout)
    write_pdf(OUT_PATH, content_stream)
    print(OUT_PATH)


if __name__ == "__main__":
    main()
