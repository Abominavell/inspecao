from inspections.models import Inspection
from inspections.services.ssma_config import load_ssma_config

_EDITABLE_COVER_FIELD_MAP = {
    "diretor_executivo": "cover_diretor_executivo",
    "gerente_geral": "cover_gerente_geral",
    "gerente_sst": "cover_gerente_sst",
    "gerente_meio_ambiente": "cover_gerente_meio_ambiente",
}

_STRUCTURE_COVER_FIELD_MAP = {
    "diretoria_executiva": "cover_diretoria_executiva",
    "gerencia_geral": "cover_gerencia_geral",
    "gerencia_sst": "cover_gerencia_sst",
    "gerencia_meio_ambiente": "cover_gerencia_meio_ambiente",
}

# Somente nomes editáveis na tela; rótulos de gerência vêm do config SSMA.
EDITABLE_COVER_FIELDS = {
    "diretor executivo (capa)": "cover_diretor_executivo",
    "gerente geral (capa)": "cover_gerente_geral",
    "gerente SST (capa)": "cover_gerente_sst",
    "gerente de meio ambiente (capa)": "cover_gerente_meio_ambiente",
}


def structure_cover_defaults() -> dict[str, str]:
    defaults = load_ssma_config()
    return {
        model_field: defaults[config_key]
        for config_key, model_field in _STRUCTURE_COVER_FIELD_MAP.items()
    }


def default_cover_fields() -> dict[str, str]:
    defaults = load_ssma_config()
    return {
        model_field: defaults[config_key]
        for config_key, model_field in _EDITABLE_COVER_FIELD_MAP.items()
    }


def inspection_cover_config(inspection: Inspection) -> dict:
    """Monta os dados da capa: rótulos fixos do config SSMA e nomes editáveis da inspeção."""
    defaults = load_ssma_config()
    unit = inspection.unit
    return {
        "diretoria_executiva": defaults["diretoria_executiva"],
        "diretor_executivo": inspection.cover_diretor_executivo or defaults["diretor_executivo"],
        "gerencia_geral": defaults["gerencia_geral"],
        "gerente_geral": inspection.cover_gerente_geral or defaults["gerente_geral"],
        "gerencia_sst": defaults["gerencia_sst"],
        "gerente_sst": inspection.cover_gerente_sst or defaults["gerente_sst"],
        "gerencia_meio_ambiente": defaults["gerencia_meio_ambiente"],
        "gerente_meio_ambiente": inspection.cover_gerente_meio_ambiente or defaults["gerente_meio_ambiente"],
        "regional": unit.regional or defaults["regional"],
        "cidade": unit.city or defaults["cidade"],
    }
