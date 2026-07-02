"""Configuração Gunicorn para CloudPanel (apiinspecaoiadvh.org.br)."""
from pathlib import Path

chdir = str(Path(__file__).resolve().parent)
bind = "127.0.0.1:8000"
workers = 2
threads = 2
timeout = 120
keepalive = 5
wsgi_app = "config.wsgi:application"
accesslog = "-"
errorlog = "-"
loglevel = "info"
capture_output = True
