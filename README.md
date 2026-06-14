# AXIOM ARCHIVE

ARG de thriller corporativo en Django 6. Terminal retro-CRT con un archivero de
expedientes y una "Mesa de Trabajo" donde el agente compone evidencias (polaroids,
notas, casetes, hilo rojo, sellos) que se guardan en el navegador.

## Arquitectura

- **Sin base de datos.** La sesión usa cookies firmadas (`signed_cookies`).
- El **board pesado** (imágenes, posiciones, rotaciones) vive en `localStorage`
  del navegador (`axiom_agent_archive`).
- El servidor solo guarda en sesión un **índice ligero** de folios autorizados
  (`request.session['agent_folios']`).

## Desarrollo local

```bash
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
python manage.py runserver
```

Abre http://127.0.0.1:8000 y entra con el código de acceso (por defecto `AXIOM-7749`).

## Despliegue en Render

El repo incluye `render.yaml` (Blueprint). En [Render](https://render.com):

1. **New → Blueprint** y selecciona este repositorio.
2. Render lee `render.yaml`, crea el Web Service (plan free, sin BD) y genera
   `SECRET_KEY` automáticamente.
3. Define `AXIOM_ACCESS_CODE` en el panel (Environment) con tu código de acceso.
4. Deploy.

Variables de entorno relevantes:

| Variable             | Descripción                                  |
|----------------------|----------------------------------------------|
| `SECRET_KEY`         | Clave Django (Render la genera).             |
| `DEBUG`              | `False` en producción.                       |
| `AXIOM_ACCESS_CODE`  | Código de acceso del login.                  |
| `ALLOWED_HOSTS`      | Hosts extra (coma-separados), opcional.      |
| `CSRF_TRUSTED_ORIGINS`| Orígenes extra, opcional.                   |
