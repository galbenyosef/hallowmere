# Inventory design QA

final result: passed

Source: `/var/folders/8g/q2nyzsqj1k71cfv1_s0tds140000gn/T/codex-clipboard-7ce7f478-0d4e-49f8-82e3-0793d134ab16.png` (500 × 850).
Implementation: `screenshots/inventory-desktop.png` (1000 × 900 viewport) and `screenshots/inventory-mobile.png` (418 × 786 viewport), screenshots at CSS pixel density. Compared together with the source in one visual inspection. Full images were readable; no additional focused crops were needed.

Scope: reference-inspired adaptation for Hallowmere's actual weapon and charm system, not reproduction of the reference game's armor systems or item collection. Fixture used the real inventory renderer and campaign equip/collection functions, with three owned items and 161 crowns. Removed the temporary fixture after verification. Also verified inventory opening and selection in the actual game.

## Findings and corrections

- P2 narrow-screen overflow in the first capture: the panel exceeded the 418px viewport. Fixed an explicit viewport-constrained width. Final narrow capture shows every control within the frame.
- P2 attributes extended slightly past their panel on desktop. Reduced stat-row vertical padding. Final desktop and narrow captures show the crowns and stats fully within the panel.
- No remaining actionable P0/P1/P2 findings.

## Fidelity surfaces

- Typography: retained the game's Cinzel headings and Inter data text, compact hierarchy and tracked gold labels inspired by the reference. Text is readable and item names wrap.
- Layout: framed portrait/equipment and left attributes above an eight-column slot grid. Two-cell weapons and single-cell charms; inventory grows and scrolls for more items. Inspection and equip controls sit below the grid.
- Colors: warm brown, muted crimson header, brass borders; blue rare, green uncommon, gold legendary equipment states.
- Images: generated full-body Warden and readable weapon/charm raster illustrations. Uses the game's two real equipment types; ornate reference frame and unsupported armor slots intentionally not replicated.
- Content: actual level, health, essence, damage, honing, draughts, crowns and owned items. No invented character statistics. Reference's full bag intentionally replaced with actual owned gear.

## Verification

- Opened inventory with I and the Belongings button; actual game renders correctly.
- Selected gear in the live game and populated temporary fixture.
- Equipped rare blade: cleave 30 → 41, equipment portrait slot and equipped marker updated.
- Equipped charm: maximum vitality 140 → 160, current vitality remained 140, charm slot updated.
- Inspected bonus comparison and disabled Equipped state.
- Browser console error check: none in the fixture.
- Build validation passed; all 34 existing tests passed.
- Desktop and narrow screen captures compared against reference after fixes.

## Art provenance

Built-in ImageGen created `dist/assets/inventory/warden.png`, `sword.png`, and `charm.png`.
Prompts: full-body front-facing hooded Warden in worn steel armor and muted crimson cloak; single diagonal worn steel longsword; single bronze oak-leaf protective pendant. Shared classic dark fantasy painterly style, dark brown backgrounds, no text or frames.

P3 follow-up: additional unique artwork per weapon template could further distinguish blades beyond rarity and item labels.

## Follow-up: uniform slots and game palette

User requested equal square satchel slots and colors consistent with the game. Every item now occupies one square, and empty slots use the same aspect ratio. Browser measurement confirmed all 24 cells were exactly 57.625 × 57.625 CSS pixels at the current viewport. Replaced warm brown/crimson panel colors with the game's dark teal, sage, muted gold, and shared gold/muted variables; retained semantic rarity colors. Browser visual check and build validation passed. This supersedes the earlier two-cell weapon and warm-palette descriptions above.
