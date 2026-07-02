"""Cria inspeção de exemplo com fotos NC (wrapper do comando Django)."""
import subprocess
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent / "backend"
PYTHON = BACKEND_DIR / ".venv" / "Scripts" / "python.exe"
if not PYTHON.exists():
    PYTHON = Path(sys.executable)

MANAGE = BACKEND_DIR / "manage.py"


def main():
    args = [str(PYTHON), str(MANAGE), "seed_sample", *sys.argv[1:]]
    result = subprocess.run(args, cwd=BACKEND_DIR)
    raise SystemExit(result.returncode)


if __name__ == "__main__":
    main()
