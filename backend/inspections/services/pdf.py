import base64
import io
import re
from pathlib import Path

from django.conf import settings
from jinja2 import Environment, FileSystemLoader, select_autoescape
from PIL import Image

from inspections.models import Inspection
from inspections.services.cover import inspection_cover_config
from inspections.services.scoring import compute_section_scores, get_checklist_summary, get_non_conformities


def _file_to_data_uri(path: Path, *, max_width: int | None = None) -> str | None:
    if not path.exists():
        return None
    suffix = path.suffix.lower()
    mime = "image/jpeg" if suffix in (".jpg", ".jpeg") else "image/png"

    if max_width and suffix in (".png", ".jpg", ".jpeg"):
        img = Image.open(path)
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGBA" if suffix == ".png" else "RGB")
        if img.width > max_width:
            ratio = max_width / img.width
            resized = img.resize((max_width, max(1, int(img.height * ratio))), Image.Resampling.LANCZOS)
            img = resized
        buf = io.BytesIO()
        fmt = "PNG" if suffix == ".png" else "JPEG"
        save_kwargs = {"quality": 85} if fmt == "JPEG" else {}
        if fmt == "JPEG" and img.mode == "RGBA":
            img = img.convert("RGB")
        img.save(buf, format=fmt, **save_kwargs)
        data = base64.b64encode(buf.getvalue()).decode("ascii")
        return f"data:{mime};base64,{data}"

    data = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:{mime};base64,{data}"


def _photo_to_data_uri(file_path: str) -> str | None:
    return _file_to_data_uri(Path(file_path))


def _fmt_score(score) -> str:
    if score is None:
        return "—"
    return f"{score * 100:.1f}%".replace(".", ",")


def _fmt_section_title(section_order: int, title: str) -> str:
    """Título como no modelo: '1. AREAS EXTERNAS' (sem repetir número se já existir)."""
    if re.match(r"^\d+\.\s", title):
        return title.upper()
    return f"{section_order}. {title}".upper()


def _resolve_pdf_engine() -> str:
    try:
        from weasyprint import HTML  # noqa: F401

        return "weasyprint"
    except Exception:
        return "xhtml2pdf"


def generate_report_pdf(inspection: Inspection) -> bytes:
    scores = compute_section_scores(inspection)
    pdf_engine = _resolve_pdf_engine()
    non_conformities = get_non_conformities(inspection)
    checklist_summary = get_checklist_summary(inspection)

    for nc in non_conformities:
        nc["photo_data_uris"] = []
        for photo_path in nc["photos"]:
            uri = _photo_to_data_uri(photo_path)
            if uri:
                nc["photo_data_uris"].append(uri)

    static_dir = settings.BASE_DIR / "static" / "report"
    logo_path = static_dir / "emserh-logo.png"
    header_banner_path = static_dir / "report-header.png"
    if not logo_path.exists():
        logo_path = static_dir / "image32.png"

    templates_dir = settings.BASE_DIR / "templates"
    env = Environment(
        loader=FileSystemLoader(templates_dir),
        autoescape=select_autoescape(["html", "xml"]),
    )
    env.filters["fmt_score"] = _fmt_score
    env.filters["fmt_section_title"] = _fmt_section_title

    template = env.get_template("report.html")
    address_photo_uri = None
    if inspection.address_photo:
        address_photo_uri = _file_to_data_uri(Path(inspection.address_photo.path), max_width=520)

    html = template.render(
        ssma=inspection_cover_config(inspection),
        inspection=inspection,
        unit=inspection.unit,
        scores=scores,
        score_sections=scores["sections"],
        non_conformities=non_conformities,
        checklist_summary=checklist_summary,
        logo_uri=_file_to_data_uri(logo_path, max_width=200),
        header_banner_uri=_file_to_data_uri(header_banner_path, max_width=720),
        address_photo_uri=address_photo_uri,
        pdf_engine=pdf_engine,
    )

    if pdf_engine == "weasyprint":
        from weasyprint import HTML

        return HTML(string=html, base_url=str(settings.BASE_DIR)).write_pdf()

    from xhtml2pdf import pisa

    result = io.BytesIO()
    status = pisa.CreatePDF(html, dest=result, encoding="utf-8")
    if status.err:
        raise RuntimeError("Falha ao gerar PDF com xhtml2pdf")
    return result.getvalue()
