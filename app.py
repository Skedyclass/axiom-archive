"""Puente WSGI para Render.

Render arranca por defecto con `gunicorn app:app`. Este módulo expone la
aplicación WSGI de Django bajo los nombres `app` y `application`, de modo que
ese comando por defecto funcione sin tener que configurar el Start Command.

El comando recomendado sigue siendo, si lo configuras en el panel:
    gunicorn axiom_project.wsgi:application
"""
from axiom_project.wsgi import application

# Alias para `gunicorn app:app` (y `app:application` / `app`).
app = application
