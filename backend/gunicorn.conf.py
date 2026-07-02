"""Configuração Gunicorn para CloudPanel (apiinspecao.iadvh.org.br)."""
import os
from pathlib import Path

chdir = str(Path(__file__).resolve().parent)
bind = os.getenv("GUNICORN_BIND", "127.0.0.1:8011")
workers = 2
threads = 2
timeout = 120
keepalive = 5
wsgi_app = "config.wsgi:application"
accesslog = "-"
errorlog = "-"
loglevel = "info"
capture_output = True
