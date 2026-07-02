"""Wrapper: delega para o comando Django `manage.py seed_checklist`."""
import subprocess
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parent.parent / "backend"
cmd = [sys.executable, str(BACKEND / "manage.py"), "seed_checklist", *sys.argv[1:]]
raise SystemExit(subprocess.call(cmd, cwd=BACKEND))
