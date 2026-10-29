# Badminton Impact — EPS

Application de comptage par zones pour la séquence de badminton de Lucas RIGAUX (Le Bon Sauveur — Saint-Lô).

## Fonctionnement

- Deux compteurs indépendants : joueur A à gauche, joueur B à droite.
- Choisir une trajectoire, puis toucher la zone correspondant au joueur qui marque.
- Rivière rose : 0 point.
- Au-dessus du sur-filet : 1 point.
- Sous le sur-filet : 2 points (bonus ×2).
- Faute adverse : bouton +1 du joueur concerné.
- Historique, annulation du dernier point, cumul des contrats et export CSV.

## Trois situations

1. La Baston — sans filet ordinaire, sur-filet jaune.
2. Le Carré magique — filet abaissé (mode tennis), sur-filet jaune.
3. Le Roi du terrain — filet à hauteur normale, sur-filet jaune.

L'application fonctionne dans le navigateur sur ordinateur et iPad. Les données restent sur l'appareil utilisé.

## Publication GitHub Pages

Dans **Settings → Pages**, sélectionner **Deploy from a branch**, puis **main** et **/(root)**, et enregistrer. L'adresse de publication sera : https://lucasrx08.github.io/Badminton-Impact/
