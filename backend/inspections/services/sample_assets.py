"""Gera imagens de exemplo para o seed (NC simuladas)."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

SAMPLE_DIR = Path(__file__).resolve().parent.parent.parent / "static" / "sample"

SAMPLE_IMAGES = [
    (
        "nc_material_acumulado.jpg",
        "Item 1.2 — NC",
        "Acúmulo de material no perímetro do prédio",
        (180, 60, 50),
    ),
    (
        "nc_estacionamento.jpg",
        "Item 1.5 — NC",
        "Estacionamento sem demarcação adequada",
        (40, 90, 160),
    ),
    (
        "nc_protecao_colisao.jpg",
        "Item 1.6 — NC",
        "Estruturas expostas sem proteção contra colisão",
        (120, 80, 30),
    ),
    (
        "nc_fios_desorganizados.jpg",
        "Item 11.1 — NC",
        "Fios desorganizados em setores internos",
        (60, 60, 60),
    ),
]


def _font(size: int):
    for name in ("arial.ttf", "Arial.ttf", "segoeui.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def ensure_sample_images() -> Path:
    SAMPLE_DIR.mkdir(parents=True, exist_ok=True)
    title_font = _font(22)
    body_font = _font(16)

    for filename, title, subtitle, color in SAMPLE_IMAGES:
        path = SAMPLE_DIR / filename
        if path.exists():
            continue

        img = Image.new("RGB", (640, 480), color=(235, 235, 235))
        draw = ImageDraw.Draw(img)
        draw.rectangle((20, 20, 620, 460), outline=color, width=6)
        draw.rectangle((40, 180, 600, 420), fill=(210, 210, 210), outline=(150, 150, 150), width=2)
        draw.text((40, 40), title, fill=(0, 0, 0), font=title_font)
        draw.text((40, 80), subtitle, fill=(80, 80, 80), font=body_font)
        draw.text((50, 200), "Registro fotográfico de exemplo", fill=(100, 100, 100), font=body_font)
        draw.text((50, 240), "Inspeção SSMA — EMSERH", fill=(100, 100, 100), font=body_font)
        img.save(path, "JPEG", quality=85)

    logo_path = Path(__file__).resolve().parent.parent.parent / "static" / "report" / "emserh-logo.png"
    if not logo_path.exists():
        logo_path.parent.mkdir(parents=True, exist_ok=True)
        logo = Image.new("RGB", (400, 120), color=(255, 255, 255))
        draw = ImageDraw.Draw(logo)
        draw.text((20, 40), "EMSERH", fill=(0, 102, 51), font=_font(48))
        logo.save(logo_path, "PNG")

    return SAMPLE_DIR
