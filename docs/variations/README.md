# Design variation pages

These are archived design-exploration pages. They predate the current game and are no
longer deployed with the site; each keeps its supporting `.js`/`.css` files alongside it.

- `geralt-character-study.html` — interactive 3D design sheet for the Geralt character study (equipment poses, camera views).
- `hunt-king-study.html` — interactive 3D design sheet for the Wild Hunt King boss study (uses `hunt-king-model.js`).
- `predator-study.html` — interactive 3D design sheet for the Predator-inspired enemy study (masked/unmasked, equipment poses).
- `selection-explorations.html` — gallery of ten character-selection screen directions (uses `selection-directions.js`).
- `orb-variations.html` — gallery of ten vitality/essence orb visual-effect directions.
- `quest-proposals.html` — gallery of ten shop/dialogue panel design proposals.

## How to view

Run `python3 -m http.server 8000` from the repo root, then open
`http://localhost:8000/docs/variations/<page>.html`, for example
`http://localhost:8000/docs/variations/orb-variations.html`.
