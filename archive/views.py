from django.shortcuts import render


def game_view(request):
    """ASPERTER VS REAL LIFE — el juego corre 100% en el cliente (Three.js).
    Django solo sirve esta página. Sin login ni base de datos."""
    return render(request, 'archive/game.html')
