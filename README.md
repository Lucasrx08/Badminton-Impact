# Badminton Impact — EPS

Application de comptage par zones pour la séquence de badminton de Lucas RIGAUX (Le Bon Sauveur — Saint-Lô).

## Utilisation

1. Depuis l'accueil, choisir **La Baston**, **Le Carré magique** ou **Le Roi du terrain**.
2. Choisir une **poule de 3 ou 4 joueurs** et renseigner les prénoms.
3. Les rencontres se succèdent automatiquement : poule de 3 = 3 rencontres, poule de 4 = 6 rencontres par tour.
4. Sélectionner le joueur **A ou B** : sa sélection reste active.
5. Toucher directement **+1** ou **+2** dans la zone d'impact du **demi-terrain** : aucun choix préalable de trajectoire n'est nécessaire.
6. Utiliser **Faute adverse +1**, **Annuler** et **Terminer le match** selon les besoins.

### Règles de points

- Volant dans la **rivière rose** : **0 point**.
- Volant direct **au-dessus du sur-filet** : **1 point**.
- Volant direct **sous le sur-filet** : **2 points**.
- **Faute adverse** : **1 point**.

### Situations et contrats

- **La Baston** : sans filet ordinaire, sur-filet jaune. N1 au-dessus de 30 pts, N2 au-dessus de 40 pts.
- **Le Carré magique** : filet abaissé (mode tennis), sur-filet jaune. N1 au-dessus de 40 pts, N2 au-dessus de 50 pts, N3 au-dessus de 60 pts.
- **Le Roi du terrain** : filet normal, sur-filet jaune. N2 au-dessus de 60 pts, N3 au-dessus de 70 pts, N4 au-dessus de 80 pts.

Deux compteurs indépendants sont visibles durant le match. Le classement et les points cumulés des 3 ou 4 joueurs sont visibles en dessous. Les résultats sont sauvegardés **localement**, séparément pour chaque situation et taille de poule. Export CSV possible. Les anciennes données de la version 1 sont reprises dans la poule de 3.

## Publication GitHub Pages

Dans **Settings → Pages**, sélectionner **Deploy from a branch**, puis **main** et **/(root)**. Adresse attendue : https://lucasrx08.github.io/Badminton-Impact/
