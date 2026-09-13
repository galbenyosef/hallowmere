# Hallowmere inventory design QA

final result: passed

## Target and evidence

The accepted target is a redesign using the supplied gameplay image for art direction, with a wider desktop composition and a static portrait made from the gameplay model. The original inventory screenshot is the before-state, not a pixel-identical layout target.

- Gameplay reference: `/var/folders/8g/q2nyzsqj1k71cfv1_s0tds140000gn/T/codex-clipboard-c784f10c-94d4-479d-9910-15f9cba5ba92.png` (2874 × 2442 pixels).
- Original inventory: `/var/folders/8g/q2nyzsqj1k71cfv1_s0tds140000gn/T/codex-clipboard-6b10bca2-ff45-47cc-b048-fe6716a0b71e.png` (1352 × 2016 pixels; cropped source, CSS viewport/density unknown).
- Source references and the implementation screenshots were opened together in the same comparison inputs, reviewing palette, typography, equipment presentation, character silhouette, and the entire composition. Different source crops and the accepted recomposition preclude a pixel-error metric.
- Implementation screenshots are native browser captures at the stated CSS viewports, one output pixel per CSS pixel. No image resampling was used in the saved evidence. Portraits render at 840 × 880 pixels and scale with object-fit: contain.

| Evidence | Viewport / pixels | State |
| --- | --- | --- |
| `screenshots/inventory-redesign/desktop.jpg` | 1440 × 1000 | Sorcerer, representative six-item fixture, original class weapon selected |
| `screenshots/inventory-redesign/laptop.jpg` | 1280 × 720 | Compact layout, two visible satchel rows, comparison and return control visible |
| `screenshots/inventory-redesign/mobile-character.jpg` | 390 × 844 | Character, equipment, and attributes at the start of the scroll area |
| `screenshots/inventory-redesign/mobile-satchel.jpg` | 390 × 844 | Satchel and comparison after scrolling; fixed header and footer remain visible |
| `screenshots/inventory-redesign/character-gallery.jpg` | 1440 × 1440 | All nine class/appearance combinations rendered with the production portrait module |
| `screenshots/inventory-redesign/live-game.jpg` | 1440 × 1000 | Live multiplayer client in Ashwick, Storm Hermit with matching lightning staff and orb |

The fixture captures use real inventory, equipment, class, and portrait modules with controlled data. They do not claim the fixture gold/items were earned in the live game. Temporary fixture routes were removed after testing. The live-game capture verifies the actual modal integration separately.

## Findings and comparison history

No unresolved P0, P1, or P2 findings.

1. **P2: Initial portrait too small.** Camera fitting used the combined world bounding box, including empty corners. Replaced it with projection of every mesh vertex to camera space. The second desktop comparison and the nine-character gallery show larger portraits with complete hats, staffs, bows, offhands, and pedestals. Automated checks confirm every visible vertex remains inside the camera frame.
2. **P2: Short laptop windows required unnecessary content scrolling.** Added a compact desktop treatment below 820px viewport height: shorter character stage, tighter outer spacing, and two complete scrollable satchel rows. `laptop.jpg` shows both comparison rows and the return control at 1280 × 720. The content has approximately 5px of extra bottom padding to scroll; no data is hidden behind the footer.
3. **P2: Footer repaint after mobile scrolling.** Gave the footer its own stacking position and an opaque blue-black surface. The recaptured `mobile-satchel.jpg` shows the controls remaining legible after scrolling.
4. **P2: Incorrect fallback equipment representation.** A Sorcerer without prepared artwork inherited a generic sword thumbnail, and an empty weapon slot used the charm label. A missing class-weapon thumbnail now shows its class weapon type; empty slots name the correct slot. Rechecked the failure and empty fixtures, including the absence of unrelated character imagery.

## Required fidelity surfaces

- **Typography:** Existing Cinzel/Inter font assets retained. Main labels are 14px, item descriptions 16px, secondary metadata 12px. Larger headings establish class and item hierarchy. Long descriptions wrap without clipping in the 390px layout; the 320px layout also has no horizontal overflow.
- **Spacing and layout:** Two desktop columns separate character/attributes from satchel/comparison. Equipment sits below the portrait. Mobile uses one scroll area beneath the fixed title and above the fixed return action. Grid columns are 8/6/4; the mobile 390px tiles measure about 50 × 50px including borders.
- **Colors and tokens:** Cold blue-black surfaces replace the original flat green fills; thin aged-gold framing follows the game's HUD. Warm character lighting and the original cloth/trim/skin colors remain visible. Vitality and essence use restrained red/cyan values, while rarity and signed comparison labels retain distinct states.
- **Image fidelity:** All nine portraits use `createPlayableCharacter` with the same materials, scale, and hand attachments as gameplay. No AI-generated replacement characters or custom image approximations were introduced. Full gallery inspection provides the focused silhouette/material check; the mobile captures make text, slots, and comparison values readable at native scale.
- **Copy and content:** Existing item names, descriptions, bonuses, and comparison calculations remain data-driven. Appearance names match the selected character. Loading/failure and empty-slot text are explicit and class-correct. Screenshot stat differences from the supplied before-state reflect the committed class system in baseline `8e8f610`, not changed balancing.

## Interaction and runtime validation

- Live game: enter selected class, open with I, Tab from return action to equipment, Shift+Tab back to return action, close with Escape, reopen repeatedly, return using the button, and open the normal pause menu afterward. Focus wrapping and non-inventory modal styling were preserved.
- Fixture: keyboard focus previews an upgrade without equipping; Enter equips it; the subsequent downgrade shows the correct signed percentage. Clicking the charm updates maximum vitality from 110 to 130. A 70-item satchel permits keyboard access and equipping from its final row while retaining scroll position.
- All six classes and all four Sorcerer appearances were visually inspected. Tests also compare geometry/material signatures and project every mesh vertex for all nine combinations.
- Loading, rendering-unavailable, empty inventory, equipped gear, all rarities, upgrade/downgrade, and overflowing inventory states checked.
- Desktop/laptop: 1440 × 1000, 1280 × 800, and 1280 × 720. Mobile: 390 × 844 and 320 × 740. Mobile layout, scrolling, click targets, and keyboard behavior were exercised in the desktop browser's viewport override; physical touch hardware was not used.
- Reduced motion: the inventory portrait is a cached still image (computed animation-name: none), and inventory has an explicit reduced-motion override disabling animation and transitions. OS-level reduced-motion emulation was not available through this browser interface; existing reduced-motion tests also pass.
- Browser console: no errors or warnings in the live game or character gallery. Representative inventory images were checked for complete loads and nonzero natural dimensions. Build validation resolves local imports and asset URLs.
- Final `npm run build`: passed.
- Final `npm test`: 86 passed, 0 failed. The initial sandboxed test run could not bind localhost sockets; the complete suite passed with localhost access.
- `git diff --check`: passed.

## Implementation and handoff

Branch: `codex/inventory-game-aesthetic`.
Worktree: `/private/tmp/hallowmere-inventory-ui`.
Base: `8e8f6105a3d0b46e50034ca8d5a024aaa3be4020`.
Preview: `http://127.0.0.1:5186/` (I opens inventory).

Implementation and visual validation were completed in the requested isolated worktree. No deployment was performed. No remaining visual follow-up is required for the accepted scope.
