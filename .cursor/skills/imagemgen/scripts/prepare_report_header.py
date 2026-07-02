#!/usr/bin/env python3
"""Gera cabeçalho nítido do relatório PDF (EMSERH+ + título)."""
from __future__ import annotations

import io
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[4]
REPORT_DIR = ROOT / "backend" / "static" / "report"
SKILL_SCRIPT = ROOT / ".cursor" / "skills" / "imagemgen" / "scripts" / "remove_background.py"

# Import process_image from skill script
sys.path.insert(0, str(SKILL_SCRIPT.parent))
from remove_background import process_image  # noqa: E402

HEADER_WIDTH = 1400
HEADER_HEIGHT = 220
BORDER = 4
INNER_PAD = 14
LOGO_SOURCE = REPORT_DIR / "image32.png"
LOGO_OUT = REPORT_DIR / "emserh-logo.png"
HEADER_OUT = REPORT_DIR / "report-header.png"
HEADER_SOURCE_BACKUP = REPORT_DIR / "report-header-source.png"

TITLE_LINES = (
    "RELATÓRIO TÉCNICO DE DIAGNÓSTICO DE SAÚDE",
    "SEGURANÇA E MEIO AMBIENTE",
)


def _font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = (
        "C:/Windows/Fonts/timesbd.ttf" if bold else "C:/Windows/Fonts/times.ttf",
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
        "arial.ttf",
    )
    for name in candidates:
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def _draw_double_border(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int]) -> None:
    x0, y0, x1, y1 = box
    for offset in (0, 3):
        draw.rectangle((x0 + offset, y0 + offset, x1 - offset, y1 - offset), outline="#000000", width=1)


def _prepare_logo() -> Image.Image:
    if not LOGO_SOURCE.exists():
        raise FileNotFoundError(f"Logo fonte não encontrada: {LOGO_SOURCE}")
    process_image(LOGO_SOURCE, LOGO_OUT, method="black", max_width=420)
    logo = Image.open(LOGO_OUT).convert("RGBA")
    return logo


def build_header(logo: Image.Image) -> Image.Image:
    canvas = Image.new("RGB", (HEADER_WIDTH, HEADER_HEIGHT), "white")
    draw = ImageDraw.Draw(canvas)

    outer = (8, 8, HEADER_WIDTH - 8, HEADER_HEIGHT - 8)
    _draw_double_border(draw, outer)

    split_x = int(HEADER_WIDTH * 0.30)
    draw.line((split_x, outer[1] + 1, split_x, outer[3] - 1), fill="#000000", width=1)

    # Logo à esquerda
    logo_area_w = split_x - outer[0] - INNER_PAD * 2
    logo_area_h = outer[3] - outer[1] - INNER_PAD * 2
    ratio = min(logo_area_w / logo.width, logo_area_h / logo.height, 1.0)
    logo_w = max(1, int(logo.width * ratio))
    logo_h = max(1, int(logo.height * ratio))
    logo_resized = logo.resize((logo_w, logo_h), Image.Resampling.LANCZOS)
    lx = outer[0] + INNER_PAD + (logo_area_w - logo_w) // 2
    ly = outer[1] + INNER_PAD + (logo_area_h - logo_h) // 2
    canvas.paste(logo_resized, (lx, ly), logo_resized)

    # Título à direita
    title_font = _font(34, bold=True)
    title_x0 = split_x + INNER_PAD
    title_x1 = outer[2] - INNER_PAD
    title_area_w = title_x1 - title_x0

    line_heights = []
    line_widths = []
    for line in TITLE_LINES:
        bbox = draw.textbbox((0, 0), line, font=title_font)
        line_widths.append(bbox[2] - bbox[0])
        line_heights.append(bbox[3] - bbox[1])

    line_gap = 8
    total_h = sum(line_heights) + line_gap * (len(TITLE_LINES) - 1)
    ty = outer[1] + (outer[3] - outer[1] - total_h) // 2

    for i, line in enumerate(TITLE_LINES):
        tw = line_widths[i]
        tx = title_x0 + (title_area_w - tw) // 2
        draw.text((tx, ty), line, fill="#000000", font=title_font)
        ty += line_heights[i] + line_gap

    return canvas


def main() -> None:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    if HEADER_OUT.exists() and not HEADER_SOURCE_BACKUP.exists():
        HEADER_OUT.replace(HEADER_SOURCE_BACKUP)

    logo = _prepare_logo()
    header = build_header(logo)
    header.save(HEADER_OUT, "PNG", optimize=True)
    print(f"Logo: {LOGO_OUT} ({LOGO_OUT.stat().st_size // 1024} KB)")
    print(f"Header: {HEADER_OUT} ({HEADER_OUT.stat().st_size // 1024} KB, {header.width}x{header.height})")


if __name__ == "__main__":
    main()
