#!/usr/bin/env python3
import os
import textwrap
from datetime import datetime, timezone


OUT_PATH = "output/pdf/shokaishelf-engine-vergleich-de.pdf"


def esc(text: str) -> str:
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def txt(x: float, y: float, text: str, font: str = "F1", size: float = 9.2) -> str:
    return f"BT /{font} {size:.1f} Tf 1 0 0 1 {x:.2f} {y:.2f} Tm ({esc(text)}) Tj ET"


class Page:
    def __init__(self) -> None:
        self.left = 42.0
        self.y = 770.0
        self.commands: list[str] = []

    def title(self, s: str) -> None:
        self.commands.append(txt(self.left, self.y, s, font="F2", size=16.0))
        self.y -= 18.0

    def sub(self, s: str) -> None:
        self.commands.append(txt(self.left, self.y, s, font="F1", size=8.4))
        self.y -= 14.0

    def h(self, s: str) -> None:
        self.commands.append(txt(self.left, self.y, s, font="F2", size=10.4))
        self.y -= 11.2

    def p(self, s: str, width: int = 118) -> None:
        for line in textwrap.wrap(s, width=width):
            self.commands.append(txt(self.left, self.y, line))
            self.y -= 10.6
        self.y -= 2.0

    def b(self, items: list[str], width: int = 113) -> None:
        for item in items:
            lines = textwrap.wrap(item, width=width)
            if not lines:
                continue
            self.commands.append(txt(self.left, self.y, f"- {lines[0]}"))
            self.y -= 10.6
            for line in lines[1:]:
                self.commands.append(txt(self.left + 10.0, self.y, line))
                self.y -= 10.6
        self.y -= 2.0

    def check(self) -> None:
        if self.y < 38.0:
            raise RuntimeError("Seite ueberfuellt, Inhalt kuerzen.")


def build_pdf(objects: list[bytes]) -> bytes:
    out = bytearray()
    out.extend(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = [0]
    for i, obj in enumerate(objects, start=1):
        offsets.append(len(out))
        out.extend(f"{i} 0 obj\n".encode("latin-1"))
        out.extend(obj)
        out.extend(b"\nendobj\n")
    xref = len(out)
    out.extend(f"xref\n0 {len(objects)+1}\n".encode("latin-1"))
    out.extend(b"0000000000 65535 f \n")
    for off in offsets[1:]:
        out.extend(f"{off:010d} 00000 n \n".encode("latin-1"))
    out.extend(
        (
            "trailer\n"
            f"<< /Size {len(objects)+1} /Root 1 0 R >>\n"
            "startxref\n"
            f"{xref}\n"
            "%%EOF\n"
        ).encode("latin-1")
    )
    return bytes(out)


def main() -> None:
    now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    p = Page()
    p.title("ShokaiShelf: Ausfuehrliche Engine-Erklaerung und Unterschiede")
    p.sub(f"Nur repo-basierte Einordnung | Stand: {now}")

    p.h("1) Shokai-Rythm (src/logic/rhythm.ts)")
    p.b([
        "V1 ist strikt regelbasiert und komplett lokal: Genre-Gewichte aus Listenstatus, Mood/Daypart-Heuristiken, Session-Fit und leichte Frische-/Populaeritaetsanteile.",
        "Das Ranking arbeitet ohne ML-Training und ohne externe Modelldienste; Ergebnis ist nachvollziehbar ueber __why-Reasons.",
        "Diversitaet ist einfach: kleines Genre-Dedupe-Light beim Re-Ranking.",
    ])

    p.h("2) Shokai-Rythm v2 (src/logic/rhythm2.ts)")
    p.b([
        "V2 wechselt auf TF-IDF-Vektoren (Titel, Synonyme, Genres, Tags, Studios) plus Positive/Negative-Centroids aus User-Verlauf und Scores.",
        "Relevanz kombiniert aehnlichkeitsbasierte Signale (simPos/simNeg) mit Meta-Faktoren und Kontext; danach MMR fuer Diversitaet.",
        "Dashboard und Suche nutzen bewusst verschiedene Tuning-Profile (Lambda/Popularity/Seen-Penalty) und teilen letzte Empfehlungen, damit Suche anders wirkt.",
    ])

    p.h("3) AnimeNetRec (src/logic/netrec.ts)")
    p.b([
        "Graphbasierter Ansatz: Medien als Knoten, gewichtete Aehnlichkeitskanten ueber Tags/Genres/Studios/Format/Jahr.",
        "Ranking: positive und negative Personalized PageRank + BFS-Proximity + Meta/Mood-Modulation, danach MMR-Selektion.",
        "Wichtiger Unterschied zu NetRecV3: dieses Modul ist im aktuellen UI-Fluss nicht als aktiver Hauptpfad verdrahtet (keine direkte Import-Nutzung in den Page-Flows gefunden).",
    ])

    p.h("4) AnimeNetRecV2 (src/logic/netrecV2.ts)")
    p.b([
        "V2 ist ein gewichteter Multi-Faktor-Scorer auf Catalog-Ebene (Genres, Tags, Baseline, Populaeritaet, Feedback-Boost/Penalty).",
        "Feedback wird bereits einbezogen (like/dislike-aehnlichkeit), aber ohne die modulare Kandidaten-Pipeline von V3.",
        "In der Engine-Weiche ist V2 als Fallback angelegt, aber derzeit als Platzhalter markiert und liefert dort leer zurueck.",
    ])

    p.h("5) AnimeNetRecV3 (src/logic/netrecV3/*)")
    p.b([
        "V3 ist die produktive Standard-Engine: Multi-Source Candidate Generation (current-similar, collaborative, content, relations, trending).",
        "Danach folgen Features/Filter/Scoring, adaptive Lambda fuer MMR, erklaerbare Reasons und Confidence-Ausgabe.",
        "V3 ist breit integriert (z. B. Dashboard_v3, Search-Fallback-First, rec-engine-switcher auf V3-Standard).",
    ])

    p.h("6) AnimeNetRec Dream (src/logic/netrecDream/*)")
    p.b([
        "Dream (V4) erweitert V3 um pro-User DreamProfile mit adaptiven Gewichten, Behavioral Metrics, semantischen Regeln, Clustern und Lernhistorie.",
        "Scoring ist multiplikativ erweitert (Veto-Regeln, Cluster-Boost, Behavioral Modifier, Tolerance Adjustment) statt nur linearer Gewichtssumme.",
        "Migration von V3-Profilen ist im App-Startpfad verdrahtet; Dream-Empfehlungen und Feedback-Verarbeitung sind in den Dream-Pages aktiv.",
    ])

    p.h("Kernunterschiede auf einen Blick")
    p.b([
        "Komplexitaet: Rythm v1 < Rythm v2 < NetRecV2 < NetRec/NetRecV3 < Dream.",
        "Personalisierung: von festen Regeln (v1) ueber statische Gewichte (V2/V3) bis zu adaptivem, profilbasiertem Lernen (Dream).",
        "Kandidatenquellen: bei V3/Dream am staerksten ausgebaut (mehrere Quellen plus Relations/current-similar).",
        "Produktstatus im Repo: V3 + Dream klar aktiv; Rythm2 in Search-Fallback aktiv; NetRec (graph) eher experimentell/isoliert; V2 im Switcher-Fallback nicht ausimplementiert.",
    ])

    p.check()
    stream = ("\n".join(p.commands) + "\n").encode("latin-1", errors="replace")
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
        f"<< /Length {len(stream)} >>\nstream\n".encode("latin-1") + stream + b"endstream",
    ]
    pdf = build_pdf(objs)
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "wb") as f:
        f.write(pdf)
    print(OUT_PATH)


if __name__ == "__main__":
    main()
