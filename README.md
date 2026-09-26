# Sudoku Perpignan

Sudoku dont les 9 chiffres sont remplacés par les lettres de **PERPIGNAN** (P-E-R-P-I-G-N-A-N), chacune avec sa couleur. Les deux « P » (chiffres 1 et 4) et les deux « N » (chiffres 7 et 9) sont volontairement identiques : seule la couleur les distingue.

Application 100 % statique, sans build : ouvrir `index.html` ou servir le dossier avec n'importe quel serveur HTTP.

📖 Pour comprendre en détail comment fonctionne le code (générateur, interface, exports, sécurité), voir [DOCUMENTATION.md](DOCUMENTATION.md).

## Fonctionnalités
- Partie interactive (3 niveaux), vérification, indice, effacement, jeu au clavier (flèches, touches 1-9).
- Export PNG / PDF d'une grille.
- Export par lot (jusqu'à 500 grilles) : PDF avec solutions et certificat, ou ZIP de PNG.
- Format du PDF de lot au choix : taille de page (A4, A5, Lettre US, 6×9 po, 8×10 po), 1, 2 ou 4 grilles par page (puzzles et solutions séparément), marge de reliure (**minimum 12,7 mm**, jamais en dessous) et marges miroir pour l'impression recto-verso (la reliure alterne gauche/droite).

## Niveaux de difficulté
Le niveau est défini par la technique nécessaire, pas seulement par le nombre d'indices (`levelOf` dans `sudoku.js`) :

| Niveau | Une grille est acceptée si… |
|---|---|
| Facile | elle se résout avec les seuls candidats uniques (*naked singles*) |
| Moyen | elle demande aussi des chiffres uniques dans une ligne/colonne/bloc (*hidden singles*) |
| Difficile | ces techniques ne suffisent pas |

Toutes les grilles ont une solution unique, revérifiée par une résolution indépendante.

## Tests
```
npm test
```
(Node ≥ 18, aucune dépendance.)

## Dépendances (CDN, avec SRI)
html2canvas, jsPDF, JSZip, FileSaver, Font Awesome via cdnjs. Les versions et hashes SRI sont dans `index.html` ; une Content-Security-Policy limite les scripts à `self` + cdnjs. La police Outfit (SIL OFL) est hébergée dans `fonts/`.
Lors d'une mise à jour d'une librairie, recalculer le hash : `openssl dgst -sha384 -binary <fichier> | openssl base64 -A`.
