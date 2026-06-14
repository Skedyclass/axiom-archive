from django.urls import path
from . import views

urlpatterns = [
    path('', views.login_view, name='login'),
    path('logout/', views.logout_view, name='logout'),
    path('archive/', views.archive_view, name='archive'),
    path('archive/folder/<str:folder_id>/', views.folder_view, name='folder'),

    # ── Módulo de Creación de Expedientes — "Mesa de Trabajo" ──
    path('archive/workspace/', views.workspace_view, name='workspace'),
    path('archive/workspace/save/', views.workspace_save, name='workspace_save'),
    path('archive/folio/<str:folio_id>/', views.folio_view, name='folio_view'),
    path('archive/folio/<str:folio_id>/expand/', views.folio_expand, name='folio_expand'),
]
