#!/usr/bin/env python3
"""Remove fundo de imagens e gera versões otimizadas para a plataforma web."""

from __future__ import annotations

import argparse
import io
from pathlib import Path

from PIL import Image
from rembg import remove

SUBTITLE_COLOR = (0, 77, 38, 255)  # verde escuro legível em fundo claro


def _resize(image: Image.Image, max_width: int | None) -> Image.Image:
    if max_width and image.width > max_width:
        ratio = max_width / image.width
        image = image.resize((max_width, int(image.height * ratio)), Image.Resampling.LANCZOS)
    return image


def remove_black_background(image: Image.Image, threshold: int = 48) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    w, h = rgba.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if r <= threshold and g <= threshold and b <= threshold:
                pixels[x, y] = (0, 0, 0, 0)
    return rgba


def remove_light_background(image: Image.Image, min_value: int = 150, spread: int = 22) -> Image.Image:
    """Remove fundo branco/cinza e padrão xadrez de transparência falsa."""
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    w, h = rgba.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if abs(r - g) <= spread and abs(g - b) <= spread and r >= min_value:
                pixels[x, y] = (0, 0, 0, 0)
    return rgba


def clean_alpha_fringe(image: Image.Image, min_alpha: int = 160) -> Image.Image:
    """Remove halo semi-transparente que aparece como caixa no fundo claro."""
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    w, h = rgba.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a < min_alpha:
                pixels[x, y] = (0, 0, 0, 0)
                continue
            neutral = abs(r - g) <= 20 and abs(g - b) <= 20
            if neutral and r >= 110 and r <= 250:
                pixels[x, y] = (0, 0, 0, 0)
    return rgba


def recolor_light_text_for_ui(image: Image.Image) -> Image.Image:
    """Texto branco/cinza do subtítulo → verde escuro para fundo claro da UI."""
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    w, h = rgba.size
    subtitle_y = int(h * 0.52)
    for y in range(subtitle_y, h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a < 120:
                continue
            if r >= 175 and g >= 175 and b >= 175:
                pixels[x, y] = SUBTITLE_COLOR
            elif abs(r - g) <= 18 and abs(g - b) <= 18 and r >= 90:
                pixels[x, y] = (0, 0, 0, 0)
    return rgba


def crop_to_content(image: Image.Image, padding: int = 6) -> Image.Image:
    rgba = image.convert("RGBA")
    bbox = rgba.getbbox()
    if not bbox:
        return rgba
    x0, y0, x1, y1 = bbox
    x0 = max(0, x0 - padding)
    y0 = max(0, y0 - padding)
    x1 = min(rgba.width, x1 + padding)
    y1 = min(rgba.height, y1 + padding)
    return rgba.crop((x0, y0, x1, y1))


def remove_with_rembg(data: bytes) -> Image.Image:
    return Image.open(io.BytesIO(remove(data))).convert("RGBA")


def finalize_for_web(image: Image.Image) -> Image.Image:
    image = clean_alpha_fringe(image)
    image = recolor_light_text_for_ui(image)
    image = clean_alpha_fringe(image)
    return crop_to_content(image)


def process_image(
    input_path: Path,
    output_path: Path,
    *,
    method: str = "auto",
    max_width: int | None = None,
) -> None:
    raw = input_path.read_bytes()
    source = Image.open(io.BytesIO(raw))

    if method == "black":
        result = remove_black_background(source)
    elif method == "light":
        result = remove_light_background(source)
    elif method == "rembg":
        result = remove_with_rembg(raw)
    else:
        sample = source.convert("RGB").resize((min(source.width, 64), min(source.height, 64)))
        colors = list(sample.getdata())
        dark = sum(1 for r, g, b in colors if r < 50 and g < 50 and b < 50)
        light = sum(1 for r, g, b in colors if r > 165 and g > 165 and b > 165)
        if dark > len(colors) * 0.35:
            result = remove_black_background(source)
        elif light > len(colors) * 0.20:
            result = remove_light_background(source)
        else:
            result = remove_with_rembg(raw)

    result = finalize_for_web(result)
    result = _resize(result, max_width)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    result.save(output_path, "PNG", optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser(description="Remove fundo e exporta PNG transparente")
    parser.add_argument("input", type=Path, help="Imagem de entrada")
    parser.add_argument("-o", "--output", type=Path, required=True, help="PNG de saída")
    parser.add_argument("--max-width", type=int, default=None, help="Redimensiona mantendo proporção")
    parser.add_argument(
        "--method",
        choices=("auto", "black", "light", "rembg"),
        default="auto",
        help="Estratégia de remoção de fundo",
    )
    args = parser.parse_args()

    if not args.input.exists():
        raise SystemExit(f"Arquivo não encontrado: {args.input}")

    process_image(args.input, args.output, method=args.method, max_width=args.max_width)
    print(f"Salvo: {args.output} ({args.output.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
