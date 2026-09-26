# Documentation technique — Sudoku Perpignan

Ce document explique le fonctionnement interne du projet, fichier par fichier. Pour une présentation rapide (installation, tests), voir le [README](README.md).

## 1. Vue d'ensemble

L'application est 100 % statique : pas de serveur, pas de build, pas de framework. Quatre fichiers front-end suffisent :

```
index.html     → structure de la page, chargement des librairies CDN (avec SRI) + CSP
style.css      → apparence (thème sang et or, grille, palette, panneau de lot)
sudoku.js      → moteur du jeu : génération, résolution, vérification (aucune dépendance au DOM)
pdf-layout.js  → géométrie des pages du PDF de lot : marges, reliure, placement des grilles (fonctions pures)
app.js         → interface : rendu, interactions, exports PNG/PDF/ZIP
```

`sudoku.js` et `pdf-layout.js` sont chargés avant `app.js` et n'ont aucune connaissance du DOM ni de jsPDF : on peut les utiliser tels quels dans Node (c'est ce que font `test/sudoku.test.js` et `test/pdf-layout.test.js`). `app.js` fait tout le reste : il instancie `SudokuGenerator`, maintient l'état de la partie et pilote les exports.

Flux général :

```
sudoku.js (SudokuGenerator)
        │  generatePuzzle('easy'|'medium'|'hard')
        ▼
app.js  ── état { currentSolved, currentPuzzle, userBoard } ──▶ rendu de la grille (#board)
        │                                                          │
        │                                                    interactions utilisateur
        │                                                    (clic, clavier, palette)
        ▼
   exports : PNG (html2canvas) / PDF (jsPDF) / ZIP de lot (JSZip + FileSaver)
```

## 2. Le moteur : `sudoku.js`

Une grille est un tableau `9×9` de nombres `0` (case vide) à `9`. Les couleurs et lettres associées à chaque chiffre sont définies côté interface (`MAPPING` dans [app.js:2-12](app.js#L2-L12)) — le moteur ne manipule que des chiffres.

### 2.1 Le solveur (`_search`)

Tout repose sur une seule fonction de recherche, [`_search(grid, limit)`](sudoku.js#L49-L97), un backtracking sur bitmasks :

- La grille est représentée à plat (81 cases), pas en tableau 2D, pour éviter l'indirection.
- Pour chaque ligne, colonne et bloc 3×3, un entier de 16 bits mémorise quels chiffres sont déjà posés (bit `n` = chiffre `n` présent). Trois tables `SUDOKU_ROW`, `SUDOKU_COL`, `SUDOKU_BOX` ([sudoku.js:3-5](sudoku.js#L3-L5)) donnent instantanément, pour une case donnée, l'index de sa ligne/colonne/bloc.
- À chaque étape, l'algorithme choisit **la case vide qui a le moins de candidats possibles** (heuristique *minimum remaining values*) plutôt que la première case vide trouvée. C'est ce qui rend la résolution rapide : les impasses sont détectées tôt.
- `SUDOKU_POPCOUNT` ([sudoku.js:6-10](sudoku.js#L6-L10)) est une table précalculée qui donne en O(1) le nombre de bits à 1 d'un masque de candidats (0 à 1023), pour ne pas le recompter à chaque case.
- `limit` arrête la recherche dès que ce nombre de solutions est trouvé : `solve()` utilise `limit=1` (juste trouver *une* solution), `countSolutions()` utilise `limit=2` par défaut (juste besoin de savoir si c'est unique — pas la peine de compter au-delà de 2).

Toutes les autres fonctions de résolution du fichier (`solve`, `countSolutions`) sont de fines enveloppes autour de `_search`.

### 2.2 Générer une grille complète

[`generateSolvedBoard()`](sudoku.js#L143-L148) :
1. Remplit les 3 blocs diagonaux (haut-gauche, centre, bas-droite) avec des chiffres 1-9 mélangés aléatoirement — ces 3 blocs ne peuvent pas se contredire entre eux puisqu'aucun ne partage de ligne, colonne ou bloc avec un autre ([`fillDiagonal`](sudoku.js#L115-L117)/[`fillBox`](sudoku.js#L119-L128)). C'est ce qui donne un point de départ aléatoire sans avoir à randomiser tout le solveur.
2. Appelle `solve()` pour compléter le reste par déduction. Comme le solveur est déterministe (il essaie toujours les chiffres dans l'ordre 1→9), c'est le remplissage aléatoire des blocs diagonaux qui garantit une grille différente à chaque appel.

### 2.3 Retirer des chiffres en préservant l'unicité

[`removeDigitsWithUniqueness(solved, K)`](sudoku.js#L152-L177) part d'une grille complète et tente de vider `K` cases :
- Les 81 positions sont mélangées aléatoirement, puis testées une par une.
- Pour chaque case, on la vide, puis `countSolutions()` vérifie que la grille a encore **exactement une solution**. Si oui, la case reste vide ; sinon, on la remet et on passe à la suivante.
- Le nombre de cases réellement retirées peut être inférieur à `K` si trop de retraits rendent la grille ambiguë (rare en dessous de 55 cases retirées, plus fréquent au-delà).

### 2.4 Classer la difficulté

Le niveau n'est **pas** défini par le nombre d'indices restants, mais par la technique de résolution minimale nécessaire — [`levelOf(puzzle)`](sudoku.js#L285-L290) :

| Fonction | Technique simulée | Niveau si elle suffit |
|---|---|---|
| [`_solveNakedSingles`](sudoku.js#L186-L203) | Une case n'a qu'un seul chiffre possible (*naked single*) | Facile |
| [`_solveNakedAndHiddenSingles`](sudoku.js#L207-L279) | + un chiffre qui ne peut aller qu'à un seul endroit dans une ligne/colonne/bloc (*hidden single*) | Moyen |
| — | Ni l'un ni l'autre ne suffit (nécessite des techniques comme les paires nues, X-Wing, etc., que le moteur ne simule pas) | Difficile |

Ces deux fonctions sont des solveurs logiques *purs* — elles ne devinent jamais, elles s'arrêtent dès qu'aucune déduction supplémentaire n'est possible. `levelOf` les essaie dans l'ordre du plus simple au plus complexe et retourne le premier niveau qui aboutit à une grille complète.

### 2.5 Orchestration : `generatePuzzle(difficulty)`

C'est le point d'entrée utilisé par l'interface — [sudoku.js:306-335](sudoku.js#L306-L335). Pour chaque difficulté, `SUDOKU_LEVELS` ([sudoku.js:14-18](sudoku.js#L14-L18)) définit :
- `remove` : une fourchette `[min, max]` de cases à retirer (tirée aléatoirement à chaque tentative, pour varier le nombre d'indices d'une partie à l'autre) ;
- `attempts` : combien de grilles candidates essayer avant d'abandonner.

Algorithme :
1. Génère une grille complète, en retire des cases dans la fourchette voulue.
2. **Revérifie par une résolution indépendante** que la grille retirée redonne bien la solution stockée (`verifySolutionMatch` — filet de sécurité contre un bug qui désynchroniserait grille/solution).
3. Si `levelOf(puzzle)` correspond au niveau demandé, retourne immédiatement `{ solvedData, puzzleData, levelMet: true }`.
4. Sinon, retente (jusqu'à `attempts` fois), en gardant la dernière grille valide obtenue.
5. Si aucune tentative n'a atteint le niveau demandé, retourne quand même la dernière grille valide, mais avec `levelMet: false` — **la grille a toujours une unique solution**, seul le niveau annoncé n'est pas garanti. C'est `app.js` qui décide quoi faire de ce cas (voir [§3.6](#36-génération-dun-lot)).

### 2.6 Fonctions utilitaires

- [`fingerprint(board)`](sudoku.js#L180-L182) : sérialise une grille en chaîne de 81 chiffres, utilisée pour détecter les doublons exacts dans un lot.
- [`verifySolutionMatch(puzzle, solution)`](sudoku.js#L294-L301) : résout `puzzle` depuis zéro et compare case par case au `solution` attendu — utilisé à la fois pendant la génération et en double vérification finale du lot.

## 3. L'interface : `app.js`

Tout le code est dans un unique listener `DOMContentLoaded` ([app.js:1](app.js#L1)) pour garantir que le DOM existe avant qu'on le manipule.

### 3.1 État de la partie

Quatre grilles/valeurs sont maintenues en mémoire ([app.js:26-35](app.js#L26-L35)) :

| Variable | Rôle |
|---|---|
| `currentSolved` | la solution complète (jamais montrée) |
| `currentPuzzle` | la grille de départ (cases *données*, non modifiables) |
| `userBoard` | ce que le joueur a rempli — c'est elle qui est affichée |
| `selectedCell` / `selectedNumber` | case et lettre actuellement sélectionnées |

`startNewGame()` ([app.js:105-117](app.js#L105-L117)) appelle `generator.generatePuzzle(diff)`, clone `puzzleData` deux fois (une copie de référence `currentPuzzle`, une copie de travail `userBoard`) et réinitialise l'état visuel (sélection, message de statut, minuteur de victoire).

### 3.2 Rendu et sélection

`renderBoard()` ([app.js:155-183](app.js#L155-L183)) reconstruit les 81 cases à chaque nouvelle partie. Chaque case est un vrai `<button>` (pas une `<div>`), ce qui la rend focusable et activable au clavier nativement. Les cases *données* reçoivent la classe `given` et ne peuvent pas être modifiées.

**Navigation clavier** : un seul `<button>` de la grille a `tabindex="0"` à la fois (*roving tabindex*, [app.js:196-205](app.js#L196-L205)) — Tab n'arrête donc la navigation qu'une fois sur la grille, puis les flèches déplacent la sélection à l'intérieur (`moveSelection`, [app.js:282-286](app.js#L282-L286)), bornées aux limites de la grille. C'est la manière standard d'implémenter un composant type « grille » accessible.

Chaque case porte un `aria-label` recalculé à chaque changement (`updateCellLabel`, [app.js:187-194](app.js#L187-L194)) du type « Ligne 3, colonne 5, lettre P vert » : comme deux lettres (P et N) apparaissent deux fois chacune, la couleur fait partie de la description pour lever l'ambiguïté au clavier/lecteur d'écran, exactement comme un joueur voyant s'appuie sur elle.

### 3.3 Saisie

Trois façons de poser une lettre, toutes convergent vers `updateCell(cell, val)` ([app.js:214-228](app.js#L214-L228)) :
1. **Palette puis case** : cliquer une lettre de la palette la sélectionne (`selectedNumber`), puis cliquer une case l'y place.
2. **Case puis palette** : cliquer une case la sélectionne, puis cliquer une lettre l'y place immédiatement.
3. **Clavier** : case sélectionnée + touche `1`-`9` (correspond à la position dans P-E-R-P-I-G-N-A-N), `Suppr`/`Retour arrière`/`0` pour effacer, `Espace` pour effacer la case focalisée.

`updateCell` met à jour `userBoard`, le texte/la couleur de la case, son `aria-label`, puis appelle `checkWinCondition()`.

### 3.4 Victoire

`checkWinCondition()` ([app.js:259-268](app.js#L259-L268)) compare `userBoard` à `currentSolved` case par case après chaque saisie. Un drapeau `won` évite de redéclencher la modale en boucle si le joueur continue à modifier une grille déjà complète et correcte. À la victoire, un message de statut apparaît puis la modale s'ouvre après un court délai (300 ms, pour laisser voir la dernière lettre posée).

La modale ([app.js:270-280](app.js#L270-L280)) déplace le focus sur son bouton *Fermer* à l'ouverture, le piège à l'intérieur avec `Tab` tant qu'elle est ouverte, se ferme avec `Échap`, et **rend le focus** à l'élément qui l'avait avant ouverture — le cycle focus standard d'une boîte de dialogue accessible.

### 3.5 Export d'une seule grille

- **PNG** ([`exportToPng`](app.js#L315-L334)) : `html2canvas` capture le `<div id="capture-area">` (le plateau) tel qu'affiché à l'écran et déclenche un téléchargement.
- **PDF** ([`exportToPdf`](app.js#L336-L378)) : dessine la grille en **vectoriel** avec jsPDF plutôt que de rasteriser une capture d'écran — texte net à n'importe quel zoom, fichier plus léger. `drawGridOnPdf` ([app.js:444-482](app.js#L444-L482)) trace d'abord les fines lignes grises intérieures, puis par-dessus les épaisses lignes rouges des blocs 3×3 (pour qu'elles ne soient jamais recouvertes), puis les lettres centrées avec `baseline: 'middle'`.

### 3.6 Génération d'un lot

`generateBatchPuzzles(config, onProgress)` ([app.js:389-439](app.js#L389-L439)) génère les grilles demandées niveau par niveau (Facile puis Moyen puis Difficile) :
- Chaque grille générée est acceptée seulement si `result.levelMet` est vrai **et** que son empreinte (`fingerprint`) n'a pas déjà été vue dans ce lot — ce qui garantit zéro doublon exact dans un même export.
- `await new Promise(r => setTimeout(r, 0))` avant chaque génération rend la main au navigateur entre deux grilles, pour que la barre de progression s'anime au lieu de geler l'interface.
- Si 200 générations d'affilée sont rejetées (doublon ou niveau non atteint), la boucle abandonne ce niveau plutôt que de tourner indéfiniment — filet de sécurité pour les cas limites (ex. demander 500 grilles « Difficile » avec un très petit nombre de tentatives).
- Une **passe de vérification finale** ré-résout indépendamment chaque grille du lot et rejette celles qui ne correspondent pas à leur solution stockée (`verifySolutionMatch`) — une seconde ligne de défense après celle déjà faite dans `generatePuzzle`.

Le nombre de grilles réellement obtenues peut donc être inférieur au nombre demandé. `countByLevel` et `batchDoneLabel` ([app.js:531-541](app.js#L531-L541)) s'assurent que la page de couverture, le certificat et le message final du PDF affichent toujours les quantités **réelles**, jamais celles demandées au départ.

### 3.7 Export PDF du lot

`exportBatchPdf()` construit un document multi-pages avec jsPDF, dans le format choisi par l'utilisateur (panneau « Format du PDF », lu par `getPdfFormat()`) :
1. Page de couverture (titre, date, décompte par niveau réel).
2. Pages de puzzles, 1, 2 ou 4 grilles par page, dessinées avec le même `drawGridOnPdf` que l'export simple.
3. Page de séparation « Solutions ».
4. Pages de solutions, 1, 2 ou 4 grilles par page (réglage indépendant des puzzles).
5. Certificat de qualité récapitulant les garanties (solution unique, aucune grille en double, etc.), avec les vrais chiffres du lot.

`beginPage()` crée chaque page, calcule ses marges selon sa parité et y pose le numéro de page. Les textes de la couverture, du séparateur et du certificat sont ajustés à la largeur utile (`fitSize`), donc rien ne déborde même sur un petit format.

#### Format, marges et reliure (`pdf-layout.js`)

Toute la géométrie est isolée dans des fonctions pures, testables sans navigateur :

| Fonction | Rôle |
|---|---|
| `clampGutter(mm)` | force la marge de reliure entre **12,7 mm** (0,5 po) et 30 mm, quoi qu'il soit saisi (vide, texte, négatif…) |
| `pageMargins(n, gutter, mirror)` | marges de la page `n`. La page 1 est une page de droite (recto), donc reliure à gauche ; les pages paires ont la reliure à droite. Sans « marges miroir », la reliure reste toujours à gauche |
| `gridSlots(w, h, margins, perPage)` | position et taille de chaque grille (1, 2 ou 4 par page), titre compris, à l'intérieur des marges |
| `cellSize(w, h, gutter, perPage)` | taille d'une case en mm, utilisée pour l'indication affichée sous le panneau |

Points à connaître :
- Le cadre rouge de la grille fait 1,1 mm d'épaisseur, centré sur le bord : `gridSlots` le compte, donc c'est l'**encre visible** (et pas seulement le tracé théorique) qui respecte la marge.
- Marge extérieure 12,7 mm, haut 15 mm, bas 18 mm (place pour le numéro de page).
- À reliure minimale, la marge intérieure est de 12,7 mm sur tous les formats. Sur les petits formats (A5, 6×9 po) avec 4 grilles par page ou une reliure très large, les cases deviennent petites : l'interface affiche alors un avertissement en rouge sous les options (seuil : cases < 6 mm).
- Le ZIP de PNG n'est pas concerné par ces réglages.

### 3.8 Export ZIP du lot

`exportBatchZip()` ([app.js:738-786](app.js#L738-L786)) suit la même génération, mais rend chaque grille comme une image PNG via `<canvas>` (`drawPuzzleCanvas`, [app.js:684-732](app.js#L684-L732), rendu à `SCALE=3` pour la netteté) plutôt qu'en PDF vectoriel — plus adapté à une distribution image par image. Les images sont rangées dans deux dossiers (`puzzles/`, `solutions/`) d'une archive JSZip, puis téléchargées via FileSaver (`saveAs`).

## 4. Sécurité et robustesse

- **CSP** ([index.html:7](index.html#L7)) : limite les scripts et styles à l'origine (`'self'`) et à `cdnjs.cloudflare.com`, interdit les objets/plugins, interdit toute soumission de formulaire. Le seul style inline nécessaire (injecté par html2canvas pendant la capture) est autorisé par son hash exact plutôt que par un `'unsafe-inline'` global.
- **SRI** (`integrity="sha384-…"` sur chaque `<script>`/`<link>` CDN) : si le fichier livré par le CDN ne correspond pas au hash attendu, le navigateur refuse de l'exécuter. Protège contre une compromission du CDN.
- **Police auto-hébergée** (`fonts/outfit-latin.woff2`) : plus de dépendance à Google Fonts, donc l'app fonctionne aussi hors-ligne et en ouverture directe du fichier (`file://`).
- **Vérification croisée systématique** : toute grille produite (partie simple ou lot) est re-résolue indépendamment et comparée à sa solution stockée avant d'être utilisée. Voir [§2.5](#25-orchestration--generatepuzzledifficulty) et [§3.6](#36-génération-dun-lot).

## 5. Tests

`test/pdf-layout.test.js` vérifie la géométrie du PDF pour chaque taille de page × 1/2/4 grilles par page × marges miroir on/off × plusieurs reliures, sur plusieurs pages consécutives : les grilles (cadre compris) restent dans les marges, la marge intérieure est toujours ≥ 12,7 mm, aucune grille n'en chevauche une autre, et `clampGutter` refuse toute valeur sous 12,7 mm.

`test/sudoku.test.js` (Node, module natif `node:test`, aucune dépendance) vérifie :
- qu'une grille complète générée est valide (chaque ligne/colonne contient bien 1-9) ;
- que `countSolutions` retourne bien 0 / 1 / 2+ selon les cas ;
- que chaque niveau de difficulté produit des grilles à solution unique, cohérentes avec leur solution stockée, et classées au bon niveau par `levelOf` ;
- que les niveaux sont bien ordonnés par technique de résolution (pas seulement par nombre d'indices) ;
- que des grilles générées à la suite sont distinctes.

```
npm test
```

## 6. Pour aller plus loin

- Les couleurs des 9 lettres sont volontairement fixes (identité visuelle du projet) — voir `MAPPING` dans [app.js:2-12](app.js#L2-L12) pour les lettres/couleurs CSS et `PDF_COLORS`/`CANVAS_COLORS` ([app.js:14-24](app.js#L14-L24)) pour leurs équivalents RGB utilisés dans les exports.
- Mettre à jour une librairie CDN implique de recalculer son hash SRI (commande dans le [README](README.md)).
- Le moteur (`sudoku.js`) n'a aucune dépendance à `app.js` ni au DOM : il peut être réutilisé tel quel dans un autre contexte (Node, extension, etc.).
