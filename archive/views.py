import json
import random
from datetime import datetime

from django.shortcuts import render, redirect
from django.conf import settings
from django.http import JsonResponse
from django.templatetags.static import static
from django.urls import reverse
from django.views.decorators.http import require_POST

# ─── Archivero ────────────────────────────────────────────────────────────────
# El archivero arranca VACÍO: ya no hay expedientes oficiales de ejemplo.
# Los únicos folios son los que el agente crea en la Mesa de Trabajo.
FOLDERS = {}


# ─── Views ───────────────────────────────────────────────────────────────────

def login_required(view_func):
    def wrapper(request, *args, **kwargs):
        if not request.session.get('authenticated'):
            return redirect('login')
        return view_func(request, *args, **kwargs)
    wrapper.__name__ = view_func.__name__
    return wrapper


def login_view(request):
    error = None
    if request.method == 'POST':
        code = request.POST.get('code', '').strip().upper()
        if code == settings.ACCESS_CODE.upper():
            request.session['authenticated'] = True
            return redirect('archive')
        else:
            error = 'CÓDIGO INCORRECTO — ACCESO DENEGADO'
    return render(request, 'archive/login.html', {'error': error})


def logout_view(request):
    request.session.flush()
    return redirect('login')


@login_required
def archive_view(request):
    # El servidor solo conoce los IDs/títulos AUTORIZADOS (sin datos pesados).
    # Los datos visuales (imágenes, coordenadas, notas) viven en localStorage y
    # los pinta archive_list.js leyendo esta misma lista.
    agent_folios = request.session.get('agent_folios', [])
    return render(request, 'archive/archive.html', {
        'agent_folios_json': json.dumps(agent_folios),
    })


@login_required
def folder_view(request, folder_id):
    folder = FOLDERS.get(folder_id)
    if not folder:
        return redirect('archive')
    return render(request, 'archive/folder.html', {
        'folder_id': folder_id,
        'folder': folder,
    })


# ─── Mesa de Trabajo — Creación manual de expedientes ──────────────────────────
#
# PERSISTENCIA INTELIGENTE (sin BD y sin reventar la cookie de 4 KB):
#   · Los DATOS PESADOS (imágenes base64, coordenadas, notas, hilos, sellos) se
#     guardan ÍNTEGROS en el localStorage del navegador, bajo la clave
#     `axiom_agent_archive` → { 'FOLIO-XXXX': { id, title, date, board } }.
#   · El SERVIDOR solo registra un índice ligero de "folios autorizados" en la
#     sesión firmada: request.session['agent_folios'] = [{id, title, date}, ...].
#     Así sabe qué folios existen y son válidos, sin cargar nada pesado.
#
# El POST de guardado es deliberadamente liviano: { folio_id, title }.

# Fotografías mockup disponibles para las Polaroids (clave → archivo en static/img).
WORKSPACE_PHOTOS = [
    {'key': 'facility',  'label': 'INSTALACIÓN AXIOM'},
    {'key': 'subject',   'label': 'SUJETO [REDACTADO]'},
    {'key': 'corridor',  'label': 'PASILLO NIVEL CERO'},
    {'key': 'document',  'label': 'DOCUMENTO RECUPERADO'},
]


def _ws_config(mode, folio=None):
    """Configuración para workspace.js. El BOARD NO viaja aquí: vive en
    localStorage; el cliente lo carga por folioId."""
    return json.dumps({
        'mode': mode,  # 'create' | 'view' | 'expand'
        'photos': [
            {'key': p['key'], 'label': p['label'],
             'src': static('archive/img/%s.svg' % p['key'])}
            for p in WORKSPACE_PHOTOS
        ],
        'saveUrl': reverse('workspace_save'),
        'archiveUrl': reverse('archive'),
        'folioId': folio['id'] if folio else None,
        'title': folio['title'] if folio else '',
        'expandUrl': reverse('folio_expand', args=[folio['id']]) if folio else None,
        'viewUrl': reverse('folio_view', args=[folio['id']]) if folio else None,
    })


def _new_folio_id(folios):
    taken = {f['id'] for f in folios}
    while True:
        fid = 'EXPED-%04d' % random.randint(1000, 9999)
        if fid not in taken:
            return fid


def _find_folio(request, folio_id):
    return next((f for f in request.session.get('agent_folios', []) if f['id'] == folio_id), None)


@login_required
def workspace_view(request):
    """Mesa de trabajo en blanco — creación de un expediente nuevo."""
    return render(request, 'archive/workspace.html', {
        'mode': 'create',
        'ws_config': _ws_config('create'),
    })


@login_required
def folio_view(request, folio_id):
    """Inspección de un folio del agente en SOLO LECTURA (board desde localStorage)."""
    folio = _find_folio(request, folio_id)
    if not folio:
        return redirect('archive')
    return render(request, 'archive/workspace.html', {
        'mode': 'view',
        'folio': folio,
        'ws_config': _ws_config('view', folio),
    })


@login_required
def folio_expand(request, folio_id):
    """Ampliar un folio: piezas existentes bloqueadas, se pueden añadir nuevas."""
    folio = _find_folio(request, folio_id)
    if not folio:
        return redirect('archive')
    return render(request, 'archive/workspace.html', {
        'mode': 'expand',
        'folio': folio,
        'ws_config': _ws_config('expand', folio),
    })


@login_required
@require_POST
def workspace_save(request):
    """Registro LIGERO: solo { folio_id, title }. El board pesado ya está en
    localStorage del cliente. El servidor mantiene el índice de folios válidos."""
    try:
        payload = json.loads(request.body.decode('utf-8'))
    except (ValueError, UnicodeDecodeError):
        return JsonResponse({'ok': False, 'error': 'PAYLOAD ILEGIBLE'}, status=400)

    title = (payload.get('title') or '').strip() or 'EXPEDIENTE SIN TÍTULO'
    folio_id = payload.get('folio_id')

    folios = list(request.session.get('agent_folios', []))
    now = datetime.now().strftime('%d.%m.%Y')
    existing = next((f for f in folios if f['id'] == folio_id), None)

    if existing:
        existing['title'] = title
        existing['date'] = '%s · act. %s' % (existing.get('date', now).split(' · ')[0], now)
    else:
        folio_id = _new_folio_id(folios)
        folios.append({'id': folio_id, 'title': title, 'date': now})

    request.session['agent_folios'] = folios
    request.session.modified = True

    return JsonResponse({
        'ok': True,
        'folio_id': folio_id,
        'viewUrl': reverse('folio_view', args=[folio_id]),
    })
