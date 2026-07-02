from pathlib import Path

import yaml
from django.conf import settings

_DEFAULTS = {
    "diretoria_executiva": "Diretoria Executiva de SSMA",
    "diretor_executivo": "Jorge Araújo",
    "gerencia_geral": "Gerencia Geral de Qualidade, Saúde Segurança e Meio Ambiente",
    "gerente_geral": "Leonardo Espíndola",
    "gerencia_sst": "Gerencia de Saúde Segurança do Trabalho",
    "gerente_sst": "Thiago Gléria",
    "gerencia_meio_ambiente": "Gerencia de Meio Ambiente",
    "gerente_meio_ambiente": "Jaciara Aguiar",
    "regional": "Norte",
    "cidade": "São Luís/MA",
}


def load_ssma_config() -> dict:
    config_path: Path = settings.SSMA_CONFIG_PATH
    if config_path.exists():
        with open(config_path, encoding="utf-8") as f:
            data = yaml.safe_load(f) or {}
        return {**_DEFAULTS, **data}
    return dict(_DEFAULTS)
