# Notes techniques

App Vite en JS pur, pas de framework UI.

## Parsing

`@rlrml/subtr-actor` compile en WASM (~4 Mo). Le fichier `.replay` reste en local : `FileReader` → buffer → WASM. Rien n'est envoyé au réseau.

## Rendu

- `minimap.js` : canvas 2D, positions joueurs/balle frame par frame
- `charts.js` : boost, possession, heatmaps
- `compare.js` : plusieurs replays en parallèle

## Déploiement double

- **Vercel** : `base` par défaut `/`, `vercel.json` avec clean URLs
- **GitHub Pages** : workflow CI avec `VITE_BASE_PATH=/RLReplay/` pour le sous-chemin

Le WASM et les fonts sont bundlés par Vite dans `dist/assets/`.
