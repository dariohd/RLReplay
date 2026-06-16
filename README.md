# RL Replay

Outil coach pour analyser les replays Rocket League — 100 % client (WASM), sans upload.

**Démo en ligne :** [https://hhddno.github.io/RLReplay/](https://hhddno.github.io/RLReplay/)

## Fonctionnalités coach

- **Minimap 2D** + lecture frame par frame + marqueurs (buts, tirs, démos)
- **Filtre équipe** : tous / bleu / orange / mon équipe
- **Multi-replays** : charger plusieurs `.replay`, basculer entre eux, onglet **Comparer**
- **Graphiques** : boost, positionnement, possession, distribution des tirs
- **Glossaire** intégré (possession, last man, boost ledger, etc.)
- Stats, boost, positionnement, touches, mécaniques, buts tagués, heatmaps
- **Export JSON** complet

## Démarrage local

```bash
npm install
npm run dev
```

## Déploiement (GitHub Pages)

Le workflow `.github/workflows/deploy.yml` build et déploie automatiquement sur chaque push vers `main`.

Pour activer GitHub Pages : **Settings → Pages → Source : GitHub Actions**.

Build manuel :

```bash
VITE_BASE_PATH=/RLReplay/ npm run build
```

## Stack

- Vite + Vanilla JS
- `@rlrml/subtr-actor` (WebAssembly)
- Canvas 2D (minimap, graphiques, heatmaps)

## Confidentialité

Tout le parsing se fait dans le navigateur. Aucun replay n'est envoyé à un serveur.
