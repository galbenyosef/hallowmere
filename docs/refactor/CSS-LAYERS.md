# CSS layering map for the game page

`dist/index.html` loads eight stylesheets. Together they are 1,273 style rules holding 1,369
`(rule, selector)` definitions over 744 distinct selectors, and they overlap heavily: 96 selectors are
declared in two or more of the eight, and `chronicle.css` — "Open Chronicle — shared game-menu
composition" — redeclares most of the roster, inventory and dialogue surfaces from scratch.

This document says, for every one of those overlaps, which file's value actually reaches the screen,
and which rules could be deleted without moving a pixel. It is input for **T2-5** (collapse the
`#connection-overlay` triplicate) and **T2-6** (delete provably dead rules). It changes no CSS.

Captured from `eb359f9` (`main`), the eight sheets in `index.html` load order:

| # | Sheet | Bytes | Style rules | Role |
| --: | --- | --: | --: | --- |
| 1 | `style.css` | 36,456 | 464 | World HUD, modals, connection overlay, restart vote |
| 2 | `title-screen.css` | 13,130 | 130 | Title / mode chooser, and a second skin for the connection overlay |
| 3 | `roster.css` | 7,567 | 94 | Character chooser |
| 4 | `inventory.css` | 13,633 | 131 | Inventory modal |
| 5 | `dialogue.css` | 5,091 | 50 | NPC conversation modal |
| 6 | `chronicle.css` | 24,779 | 278 | Shared game-menu composition, re-skinning 1-5 |
| 7 | `journeys.css` | 8,460 | 97 | Journeys menu |
| 8 | `predator-world-preview.css` | 2,631 | 29 | Predator preview canvas |

`style.css` also carries one `@import` (the Google Fonts request) and three `@keyframes`
(`arrival`, `liquid`, `connection-spin`). No sheet uses `@supports` or `@layer`.

## 1. Method

### Parsing

A scratch parser (`/tmp/csslayers/parse.mjs`, deliberately not added to the repo) reads the eight files
in `index.html` order and walks them character by character, so it survives the fact that these sheets
are minified onto very few lines (`style.css` is 36 KB on 83 lines). It:

- strips comments, honouring quoted strings, so the `;` inside
  `@import url('…css2?family=Cinzel:wght@400;500…')` does not end a statement early;
- recurses into `@media` / `@supports` / `@layer` / `@container` blocks in place and carries the
  condition stack down to every rule inside, so a rule's media context is always known;
- splits comma-separated selector lists at the top level only, respecting `(`…`)` and `[`…`]`, so
  `:not(:has(button:hover))` and `[data-screen="loading"]` stay intact;
- records for every `(rule, selector)` pair: **file**, **order index** (a single global counter across
  all eight sheets, so "later" is unambiguous), **media query**, **selector**, **specificity `(a,b,c)`**,
  and the ordered **declaration list** with an `!important` flag per declaration;
- normalises selector spelling before anything is compared — whitespace collapsed, combinators
  tightened (`.a > .b` → `.a>.b`), legacy pseudo-elements promoted (`.x:before` → `.x::before`, which
  matters because `inventory.css` and `chronicle.css` mix both spellings), attribute values unquoted
  (`[aria-pressed="true"]` → `[aria-pressed=true]`, which `roster.css` and `journeys.css` disagree on).

Rules are cited throughout as `file#N`, where `N` is that global order index, assigned as the parser walks
the eight sheets in `index.html` order. Selector text is not an identifier here (`style.css`
declares `.ability kbd` nine times and `.combat-guide` twelve times), so the index is how a rule is
pinned down; within a file the indices run in source order. The counter also advances over the one
`@import` and the three `@keyframes`, so it orders rules reliably but is not a line number or a
rule count. Each sheet's range: `style.css` 0-467, `title-screen.css` 468-597, `roster.css` 598-691,
`inventory.css` 692-822, `dialogue.css` 823-872, `chronicle.css` 873-1150, `journeys.css` 1151-1247,
`predator-world-preview.css` 1248-1276.

Specificity follows the spec: `:where()` contributes nothing, `:is()` / `:not()` / `:has()` contribute
their most specific argument, pseudo-elements count as elements, everything else as a class.

### What "wins" means

Two declarations of the same property compete only when they can apply to the same element at the same
time. For a definition `D` under media condition `m(D)`, the competitors are the definitions of the
**same normalised selector** whose condition is either `m(D)` itself or the base (no media) — a base
rule applies wherever a media rule applies, so a *later base rule beats an earlier media rule*, which is
how most of `style.css`'s own duplicates resolve. Among competitors, per property:

1. `!important` beats normal, whatever the specificity or order;
2. then higher specificity `(a,b,c)` wins;
3. then the later declaration wins — later file, later rule, and **later declaration inside the same
   rule** (this last tie-break matters: `.connection-spinner{border:2px solid …;border-top-color:…}`
   would otherwise look as if the shorthand erased the longhand that follows it).

Shorthands are expanded to longhands before the comparison, so `background` in one file and
`background-color` in another are compared on the property they actually share, `margin` does not look
like it survives a later `margin-top`, and `padding-block` is folded onto `padding-top`/`padding-bottom`.
A declaration **survives** if it wins at least one longhand.

Each earlier definition is then classified:

- **fully shadowed** — every longhand it sets is won by some other definition, so deleting the
  definition changes nothing;
- **partially shadowed** — some longhands survive (they are listed);
- **not shadowed** — nothing else in its group contests it, or it wins outright.

`@media` rules are only compared under their own query; two different queries that happen to overlap
(`max-width:760px` and `max-width:520px`) are treated as non-competing. That is deliberately
conservative — it can only under-report shadowing, never over-report it.

### Validation

Three independent checks, because T2-5 and T2-6 must both be pixel-identical.

1. **Against Chrome's own CSSOM.** The page is loaded in headless Chrome and every
   `document.styleSheets` rule is dumped. Rule counts match per file exactly (464 / 130 / 94 / 131 / 50
   / 278 / 97 / 29 = 1,273), and every selector and media condition matches position for position.
2. **Against Chrome's own shorthand expansion.** The whole shadowing analysis is replayed using
   Chrome's longhand lists (`[...rule.style]`) instead of the hand-written shorthand table. The set of
   fully-shadowed rules is **identical** — 120 rules either way, with zero rules in one set and not the
   other. The shorthand table is therefore not a source of risk.
3. **Against the live document.** Each of the 120 rules is neutralised one at a time in the loaded
   page (addressed by its flattened position in its own sheet — selector text is *not* unique here;
   `style.css` declares `.ability kbd` nine times) and `getComputedStyle` plus
   `getBoundingClientRect` are re-read for every element and every `::before`/`::after`. At 1440x900,
   760x900 and 500x900, with animations paused: **0 of 120 rules move anything**, and a control pass
   with no change at all also reports 0, so the comparison is not just insensitive.

   This check only covers markup that exists in the freshly loaded document; 34 of the 76 distinct
   dead selectors describe screens that JavaScript builds later. Those are covered by the reachability
   notes in section 3 and by the screenshot scenarios named in section 5.

## 2. Every selector declared in two or more live sheets

96 selectors are declared in at least two of the eight sheets. Split by media context they form
**94 groups** holding **202 definitions**: **22 fully shadowed**, **71 partially shadowed**,
**109 not shadowed**.

Read the table one group at a time. The definitions are listed in load order; the last column is the
per-property verdict — a property appears exactly once across a group's rows, on the definition whose
value wins. A definition with an empty last column is fully shadowed: every property it sets is listed
against a different row, so deleting it changes nothing.

| # | Selector | @media | Load order | Spec | Decls | Verdict | Properties whose winning value comes from this definition |
| --: | --- | --- | --- | --- | --: | --- | --- |
| 1 | `.modal-shade` | base | style.css#127 | 0,1,0 | 8 | partially shadowed | `position` `inset` `display` `place-items` |
|  |  |  | chronicle.css#874 | 0,1,0 | 4 | not shadowed | `padding` `background` `backdrop-filter` `z-index` |
| 2 | `.journal-copy` | base | style.css#140 | 0,1,0 | 1 | not shadowed | `text-align` |
|  |  |  | chronicle.css#973 | 0,1,0 | 4 | not shadowed | `display` `grid-template-columns` `gap` `padding-top` |
| 3 | `.map-panel.expanded` | base | style.css#158 | 0,2,0 | 9 | **fully shadowed** | — (nothing) |
|  |  |  | chronicle.css#873 | 0,2,0 | 5 | not shadowed | `--chronicle-gold` `--chronicle-ivory` `--chronicle-muted` `--chronicle-line` `color` |
|  |  |  | chronicle.css#1003 | 0,2,0 | 15 | not shadowed | `position` `inset` `transform` `width` `max-height` `padding` `display` `grid-template-columns` `grid-template-rows` `gap` `overflow` `background` `border` `box-shadow` `z-index` |
|  |  |  | chronicle.css#1005 | 0,2,0 | 1 | not shadowed | `max-width` |
| 4 | `.map-panel.expanded .map-frame` | base | style.css#159 | 0,3,0 | 3 | **fully shadowed** | — (nothing) |
|  |  |  | chronicle.css#1008 | 0,3,0 | 9 | not shadowed | `grid-column` `grid-row` `align-self` `justify-self` `width` `height` `aspect-ratio` `border-color` `background` |
| 5 | `.map-panel.expanded .map-frame` | `@media(max-width:760px)` | style.css#234 | 0,3,0 | 1 | **fully shadowed** | — (nothing) |
|  |  |  | chronicle.css#1084 | 0,3,0 | 3 | not shadowed | `grid-column` `grid-row` `width` |
| 6 | `#loading[hidden]` | base | style.css#267 | 1,1,0 | 1 | **fully shadowed** | — (nothing) |
|  |  |  | title-screen.css#469 | 1,1,0 | 1 | not shadowed | `display` |
| 7 | `.map-panel.expanded::after` | base | style.css#351 | 0,2,1 | 6 | partially shadowed | `content` `text-align` `font-size` `color` `margin-top` |
|  |  |  | chronicle.css#1024 | 0,2,1 | 1 | not shadowed | `display` |
| 8 | `#connection-overlay` | base | style.css#441 | 1,0,0 | 7 | partially shadowed | `position` `inset` `z-index` `display` `place-items` |
|  |  |  | title-screen.css#528 | 1,0,0 | 3 | partially shadowed | `backdrop-filter` `isolation` |
|  |  |  | chronicle.css#1025 | 1,0,0 | 1 | not shadowed | `background` |
| 9 | `.connection-card` | base | style.css#443 | 0,1,0 | 7 | **fully shadowed** | — (nothing) |
|  |  |  | title-screen.css#530 | 0,1,0 | 12 | partially shadowed | `display` `flex-direction` `align-items` `justify-content` |
|  |  |  | chronicle.css#873 | 0,1,0 | 5 | not shadowed | `--chronicle-gold` `--chronicle-ivory` `--chronicle-muted` `--chronicle-line` `color` |
|  |  |  | chronicle.css#1026 | 0,1,0 | 8 | not shadowed | `position` `width` `padding` `min-height` `border` `border-radius` `background` `text-align` |
| 10 | `.connection-card h2` | base | style.css#444 | 0,1,1 | 2 | **fully shadowed** | — (nothing) |
|  |  |  | title-screen.css#534 | 0,1,1 | 3 | **fully shadowed** | — (nothing) |
|  |  |  | chronicle.css#1030 | 0,1,1 | 3 | not shadowed | `font` `color` `margin` |
| 11 | `.connection-card p` | base | style.css#445 | 0,1,1 | 3 | partially shadowed | `font` `margin` |
|  |  |  | title-screen.css#535 | 0,1,1 | 2 | not shadowed | `max-width` `text-wrap` |
|  |  |  | chronicle.css#1031 | 0,1,1 | 2 | not shadowed | `font-size` `color` |
| 12 | `.connection-spinner` | base | style.css#446 | 0,1,0 | 8 | partially shadowed | `display` `border` `border-top-color` `border-radius` `animation` |
|  |  |  | title-screen.css#533 | 0,1,0 | 3 | partially shadowed | `width` `height` |
|  |  |  | chronicle.css#1032 | 0,1,0 | 1 | not shadowed | `margin` |
| 13 | `#connection-retry` | base | style.css#447 | 1,0,0 | 7 | partially shadowed | `min-height` `margin-top` `font` `color` `text-decoration` `text-underline-offset` |
|  |  |  | title-screen.css#539 | 1,0,0 | 1 | not shadowed | `padding` |
| 14 | `.connection-spinner` | `@media(prefers-reduced-motion:reduce)` | style.css#452 | 0,1,0 | 1 | **fully shadowed** | — (nothing) |
|  |  |  | title-screen.css#597 | 0,1,0 | 1 | not shadowed | `animation` |
| 15 | `#restart-vote` | base | style.css#453 | 1,0,0 | 13 | partially shadowed | `position` `z-index` `top` `left` `transform` `width` `font` |
|  |  |  | chronicle.css#873 | 1,0,0 | 5 | not shadowed | `--chronicle-gold` `--chronicle-ivory` `--chronicle-muted` `--chronicle-line` `color` |
|  |  |  | chronicle.css#1034 | 1,0,0 | 6 | not shadowed | `text-align` `background` `border` `border-radius` `padding` `box-shadow` |
| 16 | `#restart-vote p` | base | style.css#454 | 1,0,1 | 1 | not shadowed | `margin` |
|  |  |  | chronicle.css#1035 | 1,0,1 | 4 | not shadowed | `margin-bottom` `color` `font-size` `line-height` |
| 17 | `#restart-vote button` | base | style.css#455 | 1,0,1 | 7 | partially shadowed | `font` `padding` `border` |
|  |  |  | chronicle.css#1036 | 1,0,1 | 7 | not shadowed | `border-radius` `border-color` `background` `color` `margin` `min-height` `font-size` |
| 18 | `.connection-brand>span` | base | title-screen.css#474 | 0,1,1 | 3 | partially shadowed | `font` `color` |
|  |  |  | chronicle.css#1029 | 0,1,1 | 5 | not shadowed | `display` `text-align` `font-size` `letter-spacing` `margin-top` |
| 19 | `.connection-brand` | base | title-screen.css#531 | 0,1,0 | 7 | partially shadowed | `display` `flex-direction` `align-items` `gap` |
|  |  |  | chronicle.css#1027 | 0,1,0 | 4 | not shadowed | `position` `left` `top` `width` |
| 20 | `.connection-brand img` | base | title-screen.css#532 | 0,1,1 | 5 | **fully shadowed** | — (nothing) |
|  |  |  | chronicle.css#1028 | 0,1,1 | 5 | not shadowed | `width` `height` `aspect-ratio` `object-fit` `mix-blend-mode` |
| 21 | `.roster-dialog::backdrop` | base | roster.css#599 | 0,1,1 | 2 | **fully shadowed** | — (nothing) |
|  |  |  | chronicle.css#950 | 0,1,1 | 2 | not shadowed | `background` `backdrop-filter` |
| 22 | `.roster-header` | base | roster.css#600 | 0,1,0 | 3 | **fully shadowed** | — (nothing) |
|  |  |  | chronicle.css#891 | 0,1,0 | 5 | not shadowed | `position` `flex` `margin` `padding` `text-align` |
|  |  |  | chronicle.css#952 | 0,1,0 | 1 | not shadowed | `padding-right` |
| 23 | `.roster-header h2` | base | roster.css#602 | 0,1,1 | 4 | **fully shadowed** | — (nothing) |
|  |  |  | chronicle.css#893 | 0,1,1 | 7 | not shadowed | `padding` `border` `background` `margin` `font` `letter-spacing` `color` |
| 24 | `.roster-close` | base | roster.css#604 | 0,1,0 | 9 | partially shadowed | `position` `width` `height` `background` `border` `font-size` `color` |
|  |  |  | chronicle.css#953 | 0,1,0 | 2 | not shadowed | `right` `top` |
| 25 | `.roster-layout` | base | roster.css#605 | 0,1,0 | 5 | partially shadowed | `display` |
|  |  |  | chronicle.css#954 | 0,1,0 | 5 | not shadowed | `grid-template-columns` `gap` `margin-top` `align-items` `flex` |
| 26 | `.roster-appearance-name` | base | roster.css#610 | 0,1,0 | 9 | partially shadowed | `position` `bottom` `left` `right` `text-align` `font-size` `letter-spacing` `text-transform` |
|  |  |  | chronicle.css#955 | 0,1,0 | 1 | not shadowed | `color` |
| 27 | `.roster-medallion` | base | roster.css#613 | 0,1,0 | 10 | partially shadowed | `display` `position` `width` `height` `margin` `overflow` `border` `border-radius` `transition` |
|  |  |  | chronicle.css#956 | 0,1,0 | 2 | not shadowed | `background` `border-color` |
| 28 | `.roster-class-label` | base | roster.css#615 | 0,1,0 | 4 | not shadowed | `display` `margin` `font` `max-width` |
|  |  |  | chronicle.css#957 | 0,1,0 | 1 | not shadowed | `color` |
| 29 | `.roster-classes button[aria-pressed=true] .roster-medallion` | base | roster.css#617 | 0,3,1 | 3 | **fully shadowed** | — (nothing) |
|  |  |  | chronicle.css#958 | 0,3,1 | 3 | not shadowed | `border-color` `background` `box-shadow` |
| 30 | `.roster-description` | base | roster.css#627 | 0,1,0 | 2 | partially shadowed | `min-width` |
|  |  |  | chronicle.css#959 | 0,1,0 | 1 | not shadowed | `padding` |
| 31 | `.roster-description .eyebrow` | base | roster.css#628 | 0,2,0 | 5 | partially shadowed | `letter-spacing` `text-transform` `line-height` `margin` |
|  |  |  | chronicle.css#961 | 0,2,0 | 1 | not shadowed | `font-size` |
| 32 | `.roster-name` | base | roster.css#629 | 0,1,0 | 3 | not shadowed | `font` `color` `margin` |
|  |  |  | chronicle.css#960 | 0,1,0 | 1 | not shadowed | `font-size` |
| 33 | `.roster-story` | base | roster.css#630 | 0,1,0 | 5 | partially shadowed | `margin` |
|  |  |  | chronicle.css#962 | 0,1,0 | 4 | not shadowed | `font-size` `color` `line-height` `min-height` |
| 34 | `.roster-stats` | base | roster.css#631 | 0,1,0 | 6 | partially shadowed | `display` `gap` `border-top` `border-bottom` |
|  |  |  | chronicle.css#963 | 0,1,0 | 3 | not shadowed | `margin` `padding` `border-color` |
| 35 | `.roster-stats>span` | base | roster.css#632 | 0,1,1 | 7 | partially shadowed | `display` `flex-direction` `gap` `text-transform` `letter-spacing` |
|  |  |  | chronicle.css#964 | 0,1,1 | 2 | not shadowed | `font-size` `color` |
| 36 | `.roster-stats strong` | base | roster.css#633 | 0,1,1 | 3 | partially shadowed | `font` `letter-spacing` |
|  |  |  | chronicle.css#965 | 0,1,1 | 1 | not shadowed | `color` |
| 37 | `.roster-skills` | base | roster.css#634 | 0,1,0 | 5 | partially shadowed | `display` `grid-template-columns` `margin` `align-items` |
|  |  |  | chronicle.css#966 | 0,1,0 | 1 | not shadowed | `gap` |
| 38 | `.roster-skills strong` | base | roster.css#640 | 0,1,1 | 4 | partially shadowed | `font-weight` `line-height` `color` |
|  |  |  | chronicle.css#967 | 0,1,1 | 1 | not shadowed | `font-size` |
| 39 | `.roster-skills p` | base | roster.css#641 | 0,1,1 | 4 | partially shadowed | `font-size` `line-height` `margin` |
|  |  |  | chronicle.css#968 | 0,1,1 | 1 | not shadowed | `color` |
| 40 | `.roster-loadout` | base | roster.css#642 | 0,1,0 | 3 | partially shadowed | `color` |
|  |  |  | chronicle.css#969 | 0,1,0 | 2 | not shadowed | `margin` `font-size` |
| 41 | `.roster-equipment` | base | roster.css#645 | 0,1,0 | 2 | partially shadowed | `margin` |
|  |  |  | chronicle.css#970 | 0,1,0 | 1 | not shadowed | `font-size` |
| 42 | `.roster-confirm` | base | roster.css#649 | 0,1,0 | 12 | partially shadowed | `display` `min-height` `margin` `padding` `font` `letter-spacing` `white-space` `border` `background` `box-shadow` `color` |
|  |  |  | chronicle.css#971 | 0,1,0 | 1 | not shadowed | `width` |
| 43 | `.roster-note` | base | roster.css#652 | 0,1,0 | 4 | partially shadowed | `line-height` `margin` |
|  |  |  | chronicle.css#972 | 0,1,0 | 2 | not shadowed | `font-size` `color` |
| 44 | `.modal.inventory-modal` | base | inventory.css#692 | 0,2,0 | 18 | partially shadowed | `--inventory-surface` `--inventory-deep` `position` `display` `flex-direction` `width` `min-width` `max-height` `padding` `overflow` `text-align` `color` `background` `border` `box-shadow` |
|  |  |  | chronicle.css#903 | 0,2,0 | 3 | not shadowed | `--inventory-line` `--inventory-text` `--inventory-muted` |
| 45 | `.inventory-modal .inventory-crowns` | base | inventory.css#698 | 0,2,0 | 9 | partially shadowed | `position` `display` `flex-direction` `align-items` `gap` `max-width` `font-variant-numeric` |
|  |  |  | chronicle.css#905 | 0,2,0 | 2 | not shadowed | `right` `top` |
| 46 | `.inventory-crowns strong` | base | inventory.css#700 | 0,1,1 | 3 | partially shadowed | `font` `overflow-wrap` |
|  |  |  | chronicle.css#906 | 0,1,1 | 2 | not shadowed | `font-size` `color` |
| 47 | `.inventory-crowns span` | base | inventory.css#701 | 0,1,1 | 4 | partially shadowed | `color` `text-transform` |
|  |  |  | chronicle.css#907 | 0,1,1 | 2 | not shadowed | `font-size` `letter-spacing` |
| 48 | `.inventory-layout` | base | inventory.css#703 | 0,1,0 | 3 | partially shadowed | `display` |
|  |  |  | chronicle.css#908 | 0,1,0 | 2 | not shadowed | `grid-template-columns` `gap` |
| 49 | `.inventory-modal h3` | base | inventory.css#705 | 0,1,1 | 4 | partially shadowed | `margin` `font` `letter-spacing` |
|  |  |  | chronicle.css#923 | 0,1,1 | 2 | not shadowed | `color` `font-size` |
| 50 | `.inventory-modal .equipment-view` | base | inventory.css#706 | 0,2,0 | 4 | partially shadowed | `overflow` |
|  |  |  | chronicle.css#909 | 0,2,0 | 4 | not shadowed | `padding` `background` `border` `box-shadow` |
| 51 | `.inventory-identity` | base | inventory.css#707 | 0,1,0 | 2 | **fully shadowed** | — (nothing) |
|  |  |  | chronicle.css#910 | 0,1,0 | 2 | not shadowed | `padding` `text-align` |
| 52 | `.inventory-modal .inventory-identity h3` | base | inventory.css#708 | 0,2,1 | 3 | partially shadowed | `letter-spacing` |
|  |  |  | chronicle.css#911 | 0,2,1 | 2 | not shadowed | `color` `font-size` |
| 53 | `.inventory-modal .inventory-identity p` | base | inventory.css#709 | 0,2,1 | 4 | partially shadowed | `color` `margin` `line-height` |
|  |  |  | chronicle.css#912 | 0,2,1 | 2 | not shadowed | `font-size` `margin-top` |
| 54 | `.inventory-equipment` | base | inventory.css#713 | 0,1,0 | 6 | partially shadowed | `grid-template-columns` `gap` `padding` `border-top` `background` |
|  |  |  | chronicle.css#914 | 0,1,0 | 1 | not shadowed | `display` |
| 55 | `.inventory-modal .equipment-slot` | base | inventory.css#714 | 0,2,0 | 4 | partially shadowed | `display` `align-items` `min-width` |
|  |  |  | chronicle.css#916 | 0,2,0 | 4 | not shadowed | `flex-direction` `gap` `align-self` `text-align` |
| 56 | `.equipment-slot span` | base | inventory.css#716 | 0,1,1 | 5 | partially shadowed | `display` `color` `letter-spacing` `text-transform` |
|  |  |  | chronicle.css#920 | 0,1,1 | 1 | not shadowed | `font-size` |
| 57 | `.equipment-slot strong` | base | inventory.css#717 | 0,1,1 | 7 | partially shadowed | `display` `font-weight` `color` `overflow-wrap` |
|  |  |  | chronicle.css#921 | 0,1,1 | 3 | not shadowed | `font-size` `margin-top` `line-height` |
| 58 | `.inventory-modal .equipment-slot .gear-tile` | base | inventory.css#718 | 0,3,0 | 3 | **fully shadowed** | — (nothing) |
|  |  |  | chronicle.css#919 | 0,3,0 | 3 | not shadowed | `width` `height` `flex` |
| 59 | `.inventory-modal .empty-equipment` | base | inventory.css#718 | 0,2,0 | 3 | **fully shadowed** | — (nothing) |
|  |  |  | chronicle.css#919 | 0,2,0 | 3 | not shadowed | `width` `height` `flex` |
| 60 | `.inventory-attributes` | base | inventory.css#720 | 0,1,0 | 1 | **fully shadowed** | — (nothing) |
|  |  |  | chronicle.css#922 | 0,1,0 | 1 | not shadowed | `margin-top` |
| 61 | `.inventory-attributes h3` | base | inventory.css#721 | 0,1,1 | 2 | not shadowed | `padding-bottom` `border-bottom` |
|  |  |  | chronicle.css#924 | 0,1,1 | 1 | not shadowed | `display` |
| 62 | `.inventory-attributes dl` | base | inventory.css#722 | 0,1,1 | 4 | partially shadowed | `display` `grid-template-columns` |
|  |  |  | chronicle.css#925 | 0,1,1 | 2 | not shadowed | `margin` `column-gap` |
| 63 | `.inventory-attributes dl>div` | base | inventory.css#723 | 0,1,2 | 6 | partially shadowed | `display` `justify-content` `align-items` `gap` |
|  |  |  | chronicle.css#926 | 0,1,2 | 2 | not shadowed | `padding` `font-size` |
| 64 | `.inventory-attributes small` | base | inventory.css#726 | 0,1,1 | 2 | partially shadowed | `color` |
|  |  |  | chronicle.css#927 | 0,1,1 | 1 | not shadowed | `font-size` |
| 65 | `.inventory-pouch` | base | inventory.css#729 | 0,1,0 | 1 | **fully shadowed** | — (nothing) |
|  |  |  | inventory.css#737 | 0,1,0 | 1 | not shadowed | `container-type` |
|  |  |  | chronicle.css#934 | 0,1,0 | 1 | not shadowed | `margin-top` |
| 66 | `.inventory-modal .pouch-guidance` | base | inventory.css#733 | 0,2,0 | 4 | partially shadowed | `margin` `color` |
|  |  |  | chronicle.css#936 | 0,2,0 | 3 | not shadowed | `font-size` `line-height` `margin-top` |
| 67 | `.inventory-modal .pouch-regen` | base | inventory.css#733 | 0,2,0 | 4 | partially shadowed | `margin` |
|  |  |  | inventory.css#734 | 0,2,0 | 1 | not shadowed | `color` |
|  |  |  | chronicle.css#936 | 0,2,0 | 3 | not shadowed | `font-size` `line-height` `margin-top` |
| 68 | `.inventory-bag-heading` | base | inventory.css#735 | 0,1,0 | 4 | not shadowed | `display` `justify-content` `align-items` `padding` |
|  |  |  | chronicle.css#928 | 0,1,0 | 1 | not shadowed | `padding-bottom` |
| 69 | `.inventory-bag-heading>span` | base | inventory.css#736 | 0,1,1 | 2 | partially shadowed | `color` |
|  |  |  | chronicle.css#929 | 0,1,1 | 1 | not shadowed | `font-size` |
| 70 | `.inventory-grid` | base | inventory.css#738 | 0,1,0 | 11 | partially shadowed | `display` `overflow` `scrollbar-width` `scrollbar-color` |
|  |  |  | chronicle.css#930 | 0,1,0 | 7 | not shadowed | `grid-template-columns` `padding` `gap` `max-height` `border` `background` `box-shadow` |
| 71 | `.inventory-modal .gear-tile` | base | inventory.css#739 | 0,2,0 | 8 | partially shadowed | `position` `min-width` `padding` `overflow` |
|  |  |  | chronicle.css#931 | 0,2,0 | 4 | not shadowed | `background` `border` `border-radius` `box-shadow` |
| 72 | `.inventory-modal .empty-cell` | base | inventory.css#739 | 0,2,0 | 8 | partially shadowed | `position` `min-width` `padding` `overflow` |
|  |  |  | inventory.css#741 | 0,2,0 | 2 | **fully shadowed** | — (nothing) |
|  |  |  | chronicle.css#931 | 0,2,0 | 4 | partially shadowed | `border` `border-radius` `box-shadow` |
|  |  |  | chronicle.css#932 | 0,2,0 | 2 | not shadowed | `background` `border-color` |
| 73 | `.inventory-modal .gear-tile:hover` | base | inventory.css#748 | 0,3,0 | 3 | **fully shadowed** | — (nothing) |
|  |  |  | chronicle.css#933 | 0,3,0 | 3 | not shadowed | `border-color` `background-color` `box-shadow` |
| 74 | `.inventory-modal .gear-tile.selected` | base | inventory.css#748 | 0,3,0 | 3 | **fully shadowed** | — (nothing) |
|  |  |  | chronicle.css#933 | 0,3,0 | 3 | not shadowed | `border-color` `background-color` `box-shadow` |
| 75 | `.inventory-detail .item-rarity` | base | inventory.css#755 | 0,2,0 | 4 | partially shadowed | `color` `text-transform` |
|  |  |  | chronicle.css#938 | 0,2,0 | 2 | not shadowed | `font-size` `letter-spacing` |
| 76 | `.inventory-modal .inventory-detail h3` | base | inventory.css#757 | 0,2,1 | 5 | partially shadowed | `color` `line-height` `letter-spacing` |
|  |  |  | chronicle.css#939 | 0,2,1 | 2 | not shadowed | `margin` `font-size` |
| 77 | `.inventory-modal .inventory-detail p` | base | inventory.css#762 | 0,2,1 | 4 | partially shadowed | `color` |
|  |  |  | chronicle.css#940 | 0,2,1 | 3 | not shadowed | `font-size` `line-height` `margin` |
| 78 | `.inventory-detail .item-bonus` | base | inventory.css#763 | 0,2,0 | 3 | partially shadowed | `color` `line-height` |
|  |  |  | chronicle.css#941 | 0,2,0 | 1 | not shadowed | `font-size` |
| 79 | `.item-comparison h4` | base | inventory.css#765 | 0,1,1 | 5 | partially shadowed | `margin` `color` `line-height` `font-weight` |
|  |  |  | chronicle.css#943 | 0,1,1 | 1 | not shadowed | `font-size` |
| 80 | `.inventory-modal .item-comparison .item-compared-with` | base | inventory.css#766 | 0,3,0 | 2 | partially shadowed | `margin` |
|  |  |  | chronicle.css#946 | 0,3,0 | 1 | not shadowed | `font-size` |
| 81 | `.item-comparison dl` | base | inventory.css#767 | 0,1,1 | 3 | partially shadowed | `display` `margin` |
|  |  |  | chronicle.css#944 | 0,1,1 | 2 | not shadowed | `gap` `margin-top` |
| 82 | `.item-stat-change` | base | inventory.css#768 | 0,1,0 | 6 | partially shadowed | `display` `align-items` `justify-content` `gap` `line-height` |
|  |  |  | chronicle.css#945 | 0,1,0 | 1 | not shadowed | `font-size` |
| 83 | `.modal.inventory-modal .inventory-hint` | base | inventory.css#777 | 0,3,0 | 4 | **fully shadowed** | — (nothing) |
|  |  |  | chronicle.css#947 | 0,3,0 | 6 | not shadowed | `margin` `text-align` `width` `color` `font-size` `line-height` |
| 84 | `.modal.inventory-modal .primary-button` | base | inventory.css#780 | 0,3,0 | 11 | partially shadowed | `flex` `min-height` `margin` `letter-spacing` `color` `border` |
|  |  |  | chronicle.css#948 | 0,3,0 | 6 | not shadowed | `width` `background` `border-color` `box-shadow` `font` `padding` |
| 85 | `.modal-shade.npc-conversation` | base | dialogue.css#823 | 0,2,0 | 4 | partially shadowed | `grid-template-columns` `grid-template-rows` |
|  |  |  | chronicle.css#874 | 0,2,0 | 4 | not shadowed | `padding` `background` `backdrop-filter` `z-index` |
| 86 | `.dialogue-rule` | base | dialogue.css#828 | 0,1,0 | 5 | partially shadowed | `height` `opacity` |
|  |  |  | chronicle.css#989 | 0,1,0 | 3 | not shadowed | `margin` `width` `background` |
| 87 | `.npc-modal .npc-speech` | base | dialogue.css#829 | 0,2,0 | 8 | partially shadowed | `max-width` `margin` |
|  |  |  | chronicle.css#988 | 0,2,0 | 3 | not shadowed | `text-align` `font` `color` |
| 88 | `.npc-modal .dialogue-choices` | base | dialogue.css#830 | 0,2,0 | 2 | not shadowed | `margin` `gap` |
|  |  |  | chronicle.css#990 | 0,2,0 | 1 | not shadowed | `margin-top` |
| 89 | `.npc-modal .dialogue-response` | base | dialogue.css#831 | 0,2,0 | 11 | partially shadowed | `display` `align-items` `width` `gap` `padding` `border` `border-left` `background` `text-align` `color` |
|  |  |  | chronicle.css#991 | 0,2,0 | 1 | not shadowed | `min-height` |
| 90 | `.dialogue-reply` | base | dialogue.css#834 | 0,1,0 | 3 | partially shadowed | `font-family` `line-height` |
|  |  |  | chronicle.css#992 | 0,1,0 | 1 | not shadowed | `font-size` |
| 91 | `.dialogue-copy small` | base | dialogue.css#835 | 0,1,1 | 5 | partially shadowed | `display` `font-size` `line-height` `margin` |
|  |  |  | chronicle.css#993 | 0,1,1 | 1 | not shadowed | `color` |
| 92 | `.npc-modal .dialogue-farewell` | base | dialogue.css#840 | 0,2,0 | 11 | partially shadowed | `display` `align-items` `align-self` `gap` `min-height` `padding` `border` `background` `color` `font-size` |
|  |  |  | chronicle.css#995 | 0,2,0 | 1 | not shadowed | `margin-left` |
| 93 | `.modal.npc-modal.has-npc-portrait` | base | dialogue.css#847 | 0,3,0 | 6 | partially shadowed | `display` |
|  |  |  | chronicle.css#984 | 0,3,0 | 5 | not shadowed | `width` `grid-template-columns` `grid-template-rows` `column-gap` `align-content` |
| 94 | `.npc-modal .dialogue-portrait` | base | dialogue.css#851 | 0,2,0 | 7 | partially shadowed | `align-self` `pointer-events` |
|  |  |  | chronicle.css#987 | 0,2,0 | 5 | not shadowed | `grid-column` `grid-row` `height` `width` `margin` |

### What the shape of that table says

- `chronicle.css` wins nearly every colour, border, background, padding and font-size on the roster,
  inventory and dialogue surfaces, while the original sheet keeps the *layout* — `display`,
  `flex-direction`, `grid-template-columns`, `position`, `gap`. The two halves are interleaved
  property by property on almost every shared selector, which is why the earlier definitions mostly
  come out **partially** shadowed rather than fully: 71 of 202.
- Only 22 cross-file definitions are fully shadowed. The other 106 fully-shadowed definitions in the
  tree are a *different* problem: sheets redeclaring their own selectors. `style.css` alone declares
  `.ability kbd` nine times, `.orb-label` nine times and `.combat-guide` twelve times, across five
  separate `@media(max-width:760px)` blocks and four separate `@media(max-width:520px)` blocks. Those
  are counted in section 5.
- Two rules are *mixed* — part of the comma list is dead, part is live — and so cannot be deleted
  whole:

| Rule | Dead selector | Live selector |
| --- | --- | --- |
| `style.css` #219, `@media(max-width:760px)` `.character-meta,.footer-right` | `.footer-right` | `.character-meta` |
| `style.css` #269, base `.ability-caption,.ability-caption span:last-child` | `.ability-caption` | `.ability-caption span:last-child` |

## 3. Reachability of the fully-shadowed set

A selector whose element can never appear is dead regardless of layering, so every class and id in the
120 fully-shadowed rules was grepped against `dist/index.html` and the markup-producing modules
(`pause-menu.js`, `menu-chrome.js`, `dialogue.js`, `inventory.js`, `roster-picker.js`,
`journeys-menu.js`, `title-screen.js`, `main.js`).

**Result: nothing in the fully-shadowed set is dead for lack of an element.** All 69 distinct class/id
tokens are produced somewhere:

- 42 of the 76 distinct dead selectors match an element in the freshly loaded document — the HUD, the
  quest panel, the orbs and ability bar, the map panel, the connection overlay, `#loading`. These are
  the ones the live-document check in section 1 exercised directly.
- The remaining 34 belong to screens JavaScript builds on demand, and were traced to their builder:
  `roster-*` → `roster-picker.js`; `inventory-*`, `gear-tile`, `equipment-slot`, `empty-cell`,
  `empty-equipment`, `item-comparison`, `item-stat-change` → `inventory.js` (`.inventory-pouch` comes
  from `pouch.js`, which is not in the list above but is reached from it); `dialogue-*`, `npc-speech`
  → `dialogue.js`; `.npc-modal`, `.has-npc-portrait`, `.npc-conversation`, `.inventory-modal`,
  `.map-panel.expanded` → `main.js`; `.rare` / `.uncommon` rarity classes → `campaign.js` and
  `loot-effects.js`.

So the deletions in section 5 rest on layering alone, and each needs the screenshot scenario that puts
its screen on the page.

One genuinely unreferenced thing did turn up, but it is not a selector: three custom properties are
declared and never read — `--muted` and `--ink` on `style.css`'s `:root`, and `--inventory-deep` on
`inventory.css`'s `.modal.inventory-modal`. No `var()` in any of the eight sheets reads them and no
module reads them via `getPropertyValue`. They are listed as unclassified in section 6 rather than
queued for deletion, because a declaration is cheap and a wrong guess about a JS reader is not.

## 4. The `#connection-overlay` triplicate — T2-5 spec

`style.css` dresses the overlay as a small dark card; `title-screen.css` re-dresses it as a full-bleed
title-screen panel; `chronicle.css` re-dresses it again as the Chronicle composition. All three are
live, at identical specificity, so the result is a three-way per-property interleave.

| Selector | style.css | title-screen.css | chronicle.css | Winner per property |
| --- | --- | --- | --- | --- |
| `#connection-overlay` | #441 `{position:fixed;inset:0;z-index:65;display:grid;place-items:center;background:#09121ca6;backdrop-filter:blur(3px)}` | #528 `{background:#081217 url('./assets/menu/twin-paths-solo.webp') center/cover;backdrop-filter:none;isolation:isolate}` | #1025 `{background:linear-gradient(90deg,#061016f7,#08151beb),url('./assets/menu/twin-paths-solo.webp') center/cover}` | position → style.css<br>inset → style.css<br>z-index → style.css<br>display → style.css<br>place-items → style.css<br>backdrop-filter → title-screen.css<br>isolation → title-screen.css<br>background → chronicle.css |
| `.connection-card` | #443 `{width:min(90vw,410px);padding:32px 28px 24px;border:1px solid #66756e;background:#111e26;text-align:center;color:#e4e5d6;border-radius:8px}` | #530 `{position:relative;width:100%;min-height:100dvh;padding:45vh 6vw 8vh;display:flex;flex-direction:column;align-items:flex-start;justify-content:flex-end;border:0;border-radius:0;background:none;text-align:left}` | #873 `{--chronicle-gold:#e0c989;--chronicle-ivory:#eee2c5;--chronicle-muted:#a8babd;--chronicle-line:#c6b58c35;color:#d5dddd}`<br>#1026 `{position:relative;width:min(720px,calc(100vw - 48px));padding:35px 35px 35px 225px;min-height:235px;border:0;border-radius:0;background:none;text-align:left}` | display → title-screen.css<br>flex-direction → title-screen.css<br>align-items → title-screen.css<br>justify-content → title-screen.css<br>--chronicle-gold → chronicle.css<br>--chronicle-ivory → chronicle.css<br>--chronicle-muted → chronicle.css<br>--chronicle-line → chronicle.css<br>color → chronicle.css<br>position → chronicle.css<br>width → chronicle.css<br>padding → chronicle.css<br>min-height → chronicle.css<br>border → chronicle.css<br>border-radius → chronicle.css<br>background → chronicle.css<br>text-align → chronicle.css |
| `.connection-spinner` | #446 `{display:block;width:24px;height:24px;margin:0 auto;border:2px solid #c6b58c30;border-top-color:#c6b58c;border-radius:50%;animation:connection-spin 1.2s linear infinite}` | #533 `{margin:0 0 12px;width:22px;height:22px}` | #1032 `{margin:0}` | display → style.css<br>border → style.css<br>border-top-color → style.css<br>border-radius → style.css<br>animation → style.css<br>width → title-screen.css<br>height → title-screen.css<br>margin → chronicle.css |
Note what actually survives from the first two: `style.css` still owns the overlay's *box*
(`position`, `inset`, `z-index`, `display:grid`, `place-items`) and the spinner's *ring*
(`border`, `border-top-color`, `border-radius`, `animation`); `title-screen.css` still owns
`backdrop-filter:none` + `isolation:isolate` on the overlay (which is what stops `style.css`'s
`blur(3px)` from ever applying) and the spinner's 22px size. Only `background` on the overlay and
`margin` on the spinner come from `chronicle.css`. `.connection-card` is the one case where the
original definition is completely gone: all seven of `style.css`'s declarations lose.

### The whole overlay family, definition by definition

| Selector | @media | Definition | Spec | Verdict | Survives |
| --- | --- | --- | --- | --- | --- |
| `#connection-overlay` | base | style.css#441 | 1,0,0 | partial | `position:fixed` `inset:0` `z-index:65` `display:grid` `place-items:center` |
|  |  | title-screen.css#528 | 1,0,0 | partial | `backdrop-filter:none` `isolation:isolate` |
|  |  | chronicle.css#1025 | 1,0,0 | kept | `background:linear-gradient(90deg,#061016f7,#08151beb),url('./assets/menu/twin-paths-solo.webp') center/cover` |
| `#connection-overlay[hidden]` | base | style.css#442 | 1,1,0 | kept | `display:none` |
| `.connection-card` | base | style.css#443 | 0,1,0 | **fully shadowed** | — (nothing) |
|  |  | title-screen.css#530 | 0,1,0 | partial | `display:flex` `flex-direction:column` `align-items:flex-start` `justify-content:flex-end` |
|  |  | chronicle.css#873 | 0,1,0 | kept | `--chronicle-gold:#e0c989` `--chronicle-ivory:#eee2c5` `--chronicle-muted:#a8babd` `--chronicle-line:#c6b58c35` `color:#d5dddd` |
|  |  | chronicle.css#1026 | 0,1,0 | kept | `position:relative` `width:min(720px,calc(100vw - 48px))` `padding:35px 35px 35px 225px` `min-height:235px` `border:0` `border-radius:0` `background:none` `text-align:left` |
| `.connection-card h2` | base | style.css#444 | 0,1,1 | **fully shadowed** | — (nothing) |
|  |  | title-screen.css#534 | 0,1,1 | **fully shadowed** | — (nothing) |
|  |  | chronicle.css#1030 | 0,1,1 | kept | `font:32px/1.3 var(--serif)` `color:#eee2c5` `margin:15px 0` |
| `.connection-card p` | base | style.css#445 | 0,1,1 | partial | `font:16px/1.5 Inter,sans-serif` `margin:0 0 8px` |
|  |  | title-screen.css#535 | 0,1,1 | kept | `max-width:620px` `text-wrap:balance` |
|  |  | chronicle.css#1031 | 0,1,1 | kept | `font-size:14px` `color:#a8babd` |
| `.connection-spinner` | base | style.css#446 | 0,1,0 | partial | `display:block` `border:2px solid #c6b58c30` `border-top-color:#c6b58c` `border-radius:50%` `animation:connection-spin 1.2s linear infinite` |
|  |  | title-screen.css#533 | 0,1,0 | partial | `width:22px` `height:22px` |
|  |  | chronicle.css#1032 | 0,1,0 | kept | `margin:0` |
| `#connection-retry` | base | style.css#447 | 1,0,0 | partial | `min-height:44px` `margin-top:12px` `font:14px/1.5 Inter,sans-serif` `color:#a6b4b1` `text-decoration:underline` `text-underline-offset:4px` |
|  |  | title-screen.css#539 | 1,0,0 | kept | `padding:12px 0` |
| `#connection-retry:hover` | base | style.css#448 | 1,1,0 | kept | `color:#e4e5d6` |
| `#connection-retry:focus-visible` | base | style.css#449 | 1,1,0 | kept | `outline:2px solid var(--gold-bright)` `outline-offset:2px` `border-radius:2px` |
| `#connection-retry[hidden]` | base | style.css#450 | 1,1,0 | kept | `display:none` |
| `#connection-spinner[hidden]` | base | style.css#450 | 1,1,0 | kept | `display:none` |
| `.connection-brand>span` | base | title-screen.css#474 | 0,1,1 | partial | `font:400 11px/1.5 var(--sans)` `color:#cbbf9e` |
|  |  | chronicle.css#1029 | 0,1,1 | kept | `display:block` `text-align:center` `font-size:9px` `letter-spacing:2px` `margin-top:10px` |
| `#connection-overlay::before` | base | title-screen.css#529 | 1,0,1 | kept | `content:''` `position:absolute` `inset:0` `background:#08121760` `z-index:-1` `box-shadow:inset 0 -200px 140px #081217` |
| `.connection-brand` | base | title-screen.css#531 | 0,1,0 | partial | `display:flex` `flex-direction:column` `align-items:center` `gap:10px` |
|  |  | chronicle.css#1027 | 0,1,0 | kept | `position:absolute` `left:0` `top:52px` `width:180px` |
| `.connection-brand img` | base | title-screen.css#532 | 0,1,1 | **fully shadowed** | — (nothing) |
|  |  | chronicle.css#1028 | 0,1,1 | kept | `width:100%` `height:auto` `aspect-ratio:4.4` `object-fit:cover` `mix-blend-mode:screen` |
| `#connection-back` | base | title-screen.css#536 | 1,0,0 | kept | `display:block` `min-height:44px` `font-size:14px` |
| `#connection-back[hidden]` | base | title-screen.css#537 | 1,1,0 | kept | `display:none` |
| `#connection-overlay #connection-back` | base | title-screen.css#538 | 2,0,0 | kept | `margin:16px 0 0` `padding:12px 0` `color:#e7d8b6` |
| `.connection-card .text-button` | base | chronicle.css#1033 | 0,2,0 | kept | `padding:12px 0` `color:#dfcc9c` `min-height:44px` |
| `.connection-card` | `@media(max-width:540px)` | chronicle.css#1113 | 0,1,0 | kept | `padding:20px 0` `width:calc(100vw - 48px)` |
| `.connection-brand` | `@media(max-width:540px)` | chronicle.css#1114 | 0,1,0 | kept | `position:static` `width:165px` `margin-bottom:45px` |
| `.connection-card h2` | `@media(max-width:540px)` | chronicle.css#1115 | 0,1,1 | kept | `font-size:28px` |
| `.connection-card` | `@media(max-width:760px)` | title-screen.css#563 | 0,1,0 | **fully shadowed** | — (nothing) |
| `.connection-brand` | `@media(max-width:760px)` | title-screen.css#564 | 0,1,0 | **fully shadowed** | — (nothing) |
| `.connection-brand img` | `@media(max-width:760px)` | title-screen.css#565 | 0,1,1 | **fully shadowed** | — (nothing) |
| `.connection-spinner` | `@media(prefers-reduced-motion:reduce)` | style.css#452 | 0,1,0 | **fully shadowed** | — (nothing) |
|  |  | title-screen.css#597 | 0,1,0 | kept | `animation:none` |
### The merged rule set

This is the whole `connection-*` family expressed once, in `index.html` load order, reproducing every
winning computed value. Every declaration below is one that wins today; every declaration *not* below
is one that loses today. Declaration order inside each rule is the original load order, which is what
keeps shorthand/longhand pairs (`font` then `font-size`, `border` then `border-top-color`) resolving
the way they do now.

```css
#connection-overlay{position:fixed;inset:0;z-index:65;display:grid;place-items:center;backdrop-filter:none;isolation:isolate;background:linear-gradient(90deg,#061016f7,#08151beb),url('./assets/menu/twin-paths-solo.webp') center/cover}
#connection-overlay[hidden]{display:none}
.connection-card{display:flex;flex-direction:column;align-items:flex-start;justify-content:flex-end;--chronicle-gold:#e0c989;--chronicle-ivory:#eee2c5;--chronicle-muted:#a8babd;--chronicle-line:#c6b58c35;color:#d5dddd;position:relative;width:min(720px,calc(100vw - 48px));padding:35px 35px 35px 225px;min-height:235px;border:0;border-radius:0;background:none;text-align:left}
.connection-card h2{font:32px/1.3 var(--serif);color:#eee2c5;margin:15px 0}
.connection-card p{font:16px/1.5 Inter,sans-serif;margin:0 0 8px;max-width:620px;text-wrap:balance;font-size:14px;color:#a8babd}
.connection-spinner{display:block;border:2px solid #c6b58c30;border-top-color:#c6b58c;border-radius:50%;animation:connection-spin 1.2s linear infinite;width:22px;height:22px;margin:0}
#connection-retry{min-height:44px;margin-top:12px;font:14px/1.5 Inter,sans-serif;color:#a6b4b1;text-decoration:underline;text-underline-offset:4px;padding:12px 0}
#connection-retry:hover{color:#e4e5d6}
#connection-retry:focus-visible{outline:2px solid var(--gold-bright);outline-offset:2px;border-radius:2px}
#connection-retry[hidden]{display:none}
#connection-spinner[hidden]{display:none}
.connection-brand>span{font:400 11px/1.5 var(--sans);color:#cbbf9e;display:block;text-align:center;font-size:9px;letter-spacing:2px;margin-top:10px}
#connection-overlay::before{content:'';position:absolute;inset:0;background:#08121760;z-index:-1;box-shadow:inset 0 -200px 140px #081217}
.connection-brand{display:flex;flex-direction:column;align-items:center;gap:10px;position:absolute;left:0;top:52px;width:180px}
.connection-brand img{width:100%;height:auto;aspect-ratio:4.4;object-fit:cover;mix-blend-mode:screen}
#connection-back{display:block;min-height:44px;font-size:14px}
#connection-back[hidden]{display:none}
#connection-overlay #connection-back{margin:16px 0 0;padding:12px 0;color:#e7d8b6}
.connection-card .text-button{padding:12px 0;color:#dfcc9c;min-height:44px}
@media(max-width:540px){
.connection-card{padding:20px 0;width:calc(100vw - 48px)}
.connection-brand{position:static;width:165px;margin-bottom:45px}
.connection-card h2{font-size:28px}
}
@media(prefers-reduced-motion:reduce){
.connection-spinner{animation:none}
}
```

Three source rules are multi-selector and must be **edited**, not deleted, because their other
selectors stay live:

| Rule | Becomes |
| --- | --- |
| `style.css` #442 `#connection-overlay[hidden],#restart-vote[hidden]` | `#restart-vote[hidden]` |
| `title-screen.css` #474 `.title-brand>span,.connection-brand>span` | `.title-brand>span` |
| `chronicle.css` #873 `.chronicle-shell,.map-panel.expanded,.connection-card,#restart-vote` | `.chronicle-shell,.map-panel.expanded,#restart-vote` — its four `--chronicle-*` custom properties and `color` move into the merged `.connection-card` above |

Everything else in the family (38 rules across the three sheets) is replaced wholesale by the block
above. Two consequences worth stating:

- **The `@media(max-width:760px)` connection rules disappear entirely.** `title-screen.css` #563/#564/#565
  set `.connection-card` padding and `.connection-brand` position/width under that query, but
  `chronicle.css`'s *base* rules come later in load order and beat them at every width. They are dead
  today; the merge simply does not carry them forward.
- **`@keyframes connection-spin` stays in `style.css`.** The merged `.connection-spinner` still
  references it by name. Keyframes are document-global, so the reference survives wherever the merged
  block lands, but the keyframes block itself must not be deleted along with the rules around it.

### The four states

The overlay's states are text and `hidden` attributes set by `connectionStatus()` in `dist/main.js`;
no state adds a class, so the CSS difference between them is entirely the `[hidden]` rules.

| State | `main.js` condition | DOM | Rules that differ |
| --- | --- | --- | --- |
| **hidden** | `connected` truthy → `#connection-overlay.hidden = true` | overlay `[hidden]` | `#connection-overlay[hidden]{display:none}` |
| **loading** | not connected, no `ctx.lastSnapshot` → title "Loading game" | spinner shown, `#connection-retry[hidden]` | `#connection-retry[hidden]{display:none}` |
| **reconnecting** | not connected, `ctx.lastSnapshot` set → title "Reconnecting to game"; `#connection-back` is hidden when a snapshot exists | spinner shown, retry hidden unless `retryable` | `#connection-retry[hidden]`, `#connection-back[hidden]` |
| **failed** | `failed:true` → title "Unable to connect", `#connection-spinner.hidden = true`, `#connection-retry.hidden = false` | spinner `[hidden]`, retry visible | `#connection-spinner[hidden]{display:none}` |

Hover and keyboard focus on the retry link are a fifth pair of states, and their only rules
(`#connection-retry:hover`, `#connection-retry:focus-visible`) live in `style.css` today — they are in
the merged block above and must not be lost with the rest of `style.css`'s overlay section.

### Verification of this spec

The merge was applied to the live page through the CSSOM — deleting the 38 rules, rewriting the 3
multi-selector ones, appending the merged block after the last sheet — and `getComputedStyle` was
compared for the whole overlay subtree plus its `::before`, in all four states, at 1440x900, 760x900
and 500x900: **39,200 property readings per viewport, 0 differences**. Layout boxes
(`getBoundingClientRect`) were compared too and are identical.

## 5. Execution list for T2-6

120 whole rules — 5,898 bytes, 5.3% of the 111,747 bytes the page loads — are fully shadowed and can be
deleted outright. They fall into seven batches by the screen that has to be re-shot, plus an eighth
batch that comes from a different argument. Do them in this order: the two that only need a screen the
harness can already reach cheaply, then the JS-built screens, then the `[hidden]` cleanup last.

| Order | Batch | What | Rules | Bytes | Files | Screenshot scenario that shows it |
| --: | --- | --- | --: | --: | --- | --- |
| 1 | **A** | `style.css` redeclaring its own HUD selectors — the append-only tail | 62 | 2,068 | `style.css` | `04-hud-spawn` |
| 2 | **B** | `style.css`'s expanded-map rules, beaten by `chronicle.css` | 3 | 315 | `style.css` | `13-map-expanded` |
| 3 | **C** | `style.css` `#loading[hidden]`, beaten by `title-screen.css`'s `!important` copy | 1 | 30 | `style.css` | `01-title` |
| 4 | **D** | connection-overlay leftovers | 8 | 645 | `style.css`, `title-screen.css` | `07-connection-overlay` — **skip if T2-5 has landed**, which removes all eight already |
| 5 | **E** | `roster.css` definitions beaten by `chronicle.css` | 15 | 823 | `roster.css` | `03-roster-picker` |
| 6 | **F** | `inventory.css` definitions beaten by `chronicle.css` | 22 | 1,467 | `inventory.css` | `08-inventory` |
| 7 | **G** | `dialogue.css` definitions beaten by `chronicle.css` | 9 | 550 | `dialogue.css` | `11-npc-dialogue` |
| 8 | **H** | `X[hidden]{display:none}` rules made redundant by `[hidden]{display:none!important}` | 7 | 358 | `style.css`, `title-screen.css`, `inventory.css`, `journeys.css` | `01-title`, `02-journeys-menu`, `07-connection-overlay`, `08-inventory` |
| | | **total** | **127** | **6,256** | | |

### Which batches need the three-viewport check, and which do not

Batches **A**, **B**, **C**, **D** and **H** were each verified in the live document at 1440x900,
760x900 and 500x900 with zero computed-style and zero layout-box differences (section 1, check 3), and
the connection overlay was additionally verified in all four of its states (section 4). They are as
safe as a static check can make them, but batch A is 62 rules spread over six media contexts — 15 base,
22 under `max-width:760px`, 20 under `max-width:520px`, 3 under `max-width:1100px`, and one each under
`min-width:1600px` and `pointer:coarse` — so still capture `04-hud-spawn` and diff it. Because A is
mostly responsive overrides, it is the batch that makes the capture worth running at all three widths
rather than at 1440 alone. Two of A's rules sit in contexts no scenario reaches — `style.css#262`
`@media(pointer:coarse) .ability-name{font-size:8px}` and `style.css#163`
`@media(min-width:1600px) .combat-guide{bottom:213px}` — and rest on the layering argument alone. Both
are beaten by a later *base* rule in the same sheet (`font-size:10px` at `style.css#403`,
`bottom:220px` at `style.css#348`), which is the strongest form of the argument: the base rule already
wins wherever the query matches.

Batches **E**, **F** and **G** touch screens that do not exist in the loaded document, so no live check
was possible; they rest on the layering argument plus the reachability trace in section 3.
**These three need the screenshot check, one batch at a time, not merged into one run:**
`03-roster-picker` for E, `08-inventory` for F, `11-npc-dialogue` for G. Do not batch them together —
if a diff appears, a combined run cannot say which sheet caused it.

Batch **H**'s argument is different from every other batch: it does not come from same-selector
layering but from `style.css` #306 `[hidden]{display:none!important}`, whose `!important` beats every
non-important `display` declaration on any hidden element regardless of specificity or order. No other
`!important display` declaration exists except `title-screen.css` #469, which also sets `none`. The
seven redundant rules are:

| File | Rule | Bytes |
| --- | --- | --: |
| `style.css` #128 | `.modal-shade[hidden]` | 34 |
| `style.css` #442 | `#connection-overlay[hidden],#restart-vote[hidden]` | 63 |
| `style.css` #450 | `#connection-retry[hidden],#connection-spinner[hidden]` | 67 |
| `title-screen.css` #537 | `#connection-back[hidden]` | 43 |
| `inventory.css` #699 | `.inventory-modal .inventory-crowns[hidden]` | 60 |
| `inventory.css` #752 | `.inventory-detail[hidden]` | 43 |
| `journeys.css` #1212 | `#journey-save-indicator[hidden]` | 48 |

(`style.css` #267 `#loading[hidden]` is redundant for the same reason but is already in batch C.)
All eight were neutralised in the live page with every target element forced `hidden`, individually
and all at once: 0 differences. Run this batch last anyway — it is the smallest payoff and it touches
four sheets at once, so it is the one where a mistake is hardest to attribute.

**H overlaps T2-5.** Three of H's rules — `style.css#442`, `style.css#450`, `title-screen.css#537`,
four selectors between them — are connection-overlay rules that the merged block in section 4 carries
forward verbatim. Carrying them forward is deliberate — the
merge's job is to reproduce the current sheet exactly, not to prune it — so if T2-5 has landed, H
deletes them from the merged block instead of from the original sheets, and `style.css#442`'s
surviving `#restart-vote[hidden]` half goes with it.

### Leave alone

- **The two mixed rules.** `style.css` #219 `@media(max-width:760px) .character-meta,.footer-right` and
  `style.css` #269 `.ability-caption,.ability-caption span:last-child` each have one dead selector and
  one live one. Edit the selector list; do not delete the rule. (Both are already counted inside
  batch A's 62.)
- **The three multi-selector rules listed in section 4** — they are T2-5's, and editing them from T2-6
  as well will collide.
- **Every partially-shadowed definition.** 71 of them across the shared groups, and they are the
  majority. Their surviving properties are listed in section 2 and each one is load-bearing; nothing
  in this map licenses touching them.
- **`@keyframes arrival`, `liquid`, `connection-spin`** in `style.css`. They are not selectors and are
  not analysed here; `connection-spin` in particular is referenced from a rule T2-5 moves.

### Per-file totals

| File | Dead rules | Bytes | Share of file |
| --- | --: | --: | --: |
| style.css | 69 | 2670 | 7.3% |
| title-screen.css | 5 | 388 | 3.0% |
| roster.css | 15 | 823 | 10.9% |
| inventory.css | 22 | 1467 | 10.8% |
| dialogue.css | 9 | 550 | 10.8% |
| chronicle.css | 0 | 0 | 0.0% |
| journeys.css | 0 | 0 | 0.0% |
| predator-world-preview.css | 0 | 0 | 0.0% |
| **total** | **120** | **5898** | **5.3%** |


(`chronicle.css`, `journeys.css` and `predator-world-preview.css` have no fully-shadowed rules at all:
nothing loads after `chronicle.css` that contests it, and the last two sheets overlap nothing.)

### The full list

Every rule in batches A-G, in the order they appear in their sheet.

| Scenario | File | # | Rule (selector list) | @media | Bytes | Declarations it sets | Overridden by |
| --- | --- | --: | --- | --- | --: | --- | --- |
| `04-hud-spawn` | style.css | 80 | `.orb-frame:before` | base | 28 | `left` | style.css |
| `04-hud-spawn` | style.css | 81 | `.orb-frame:after` | base | 28 | `right` | style.css |
| `04-hud-spawn` | style.css | 92 | `.abilities-wrap` | base | 46 | `width` `margin-bottom` | style.css |
| `04-hud-spawn` | style.css | 103 | `.steel` | base | 21 | `color` | style.css |
| `04-hud-spawn` | style.css | 104 | `.ember` | base | 21 | `color` | style.css |
| `04-hud-spawn` | style.css | 105 | `.pale` | base | 20 | `color` | style.css |
| `04-hud-spawn` | style.css | 106 | `.ruby` | base | 20 | `color` | style.css |
| `04-hud-spawn` | style.css | 163 | `.combat-guide` | `@media(min-width:1600px)` | 27 | `bottom` | style.css |
| `04-hud-spawn` | style.css | 177 | `.footer-right>span` | `@media(max-width:1100px)` | 32 | `display` | style.css |
| `04-hud-spawn` | style.css | 181 | `.combat-guide` | `@media(max-width:1100px)` | 27 | `bottom` | style.css |
| `04-hud-spawn` | style.css | 182 | `.footer-right` | `@media(max-width:1100px)` | 37 | `right` `bottom` | style.css |
| `04-hud-spawn` | style.css | 190 | `.quest-label` | `@media(max-width:760px)` | 27 | `font-size` | style.css |
| `04-hud-spawn` | style.css | 192 | `.quest-line` | `@media(max-width:760px)` | 27 | `font-size` | style.css |
| `04-hud-spawn` | style.css | 195 | `.quest .text-button` | `@media(max-width:760px)` | 34 | `font-size` | style.css |
| `04-hud-spawn` | style.css | 205 | `.orb-frame:before,.orb-frame:after` | `@media(max-width:760px)` | 66 | `top` `height` `width` | style.css |
| `04-hud-spawn` | style.css | 206 | `.orb-frame:before` | `@media(max-width:760px)` | 28 | `left` | style.css |
| `04-hud-spawn` | style.css | 207 | `.orb-frame:after` | `@media(max-width:760px)` | 28 | `right` | style.css |
| `04-hud-spawn` | style.css | 208 | `.orb-cap` | `@media(max-width:760px)` | 36 | `font-size` `bottom` | style.css |
| `04-hud-spawn` | style.css | 209 | `.orb-label` | `@media(max-width:760px)` | 61 | `font-size` `letter-spacing` `margin-top` | style.css |
| `04-hud-spawn` | style.css | 210 | `.abilities-wrap` | `@media(max-width:760px)` | 46 | `width` `margin-bottom` | style.css |
| `04-hud-spawn` | style.css | 211 | `.ability` | `@media(max-width:760px)` | 21 | `height` | style.css |
| `04-hud-spawn` | style.css | 212 | `.ability-icon` | `@media(max-width:760px)` | 37 | `width` `height` | style.css |
| `04-hud-spawn` | style.css | 213 | `.ability-name` | `@media(max-width:760px)` | 28 | `font-size` | style.css |
| `04-hud-spawn` | style.css | 214 | `.ability kbd` | `@media(max-width:760px)` | 27 | `font-size` | style.css |
| `04-hud-spawn` | style.css | 215 | `.abilities` | `@media(max-width:760px)` | 19 | `gap` | style.css |
| `04-hud-spawn` | style.css | 216 | `.ability-caption` | `@media(max-width:760px)` | 50 | `font-size` `padding-bottom` | style.css |
| `04-hud-spawn` | style.css | 217 | `.ability-caption span:last-child` | `@media(max-width:760px)` | 47 | `font-size` | style.css |
| `04-hud-spawn` | style.css | 218 | `.experience-track` | `@media(max-width:760px)` | 34 | `margin-top` | style.css |
| `04-hud-spawn` | style.css | 237 | `.orb-frame:before,.orb-frame:after` | `@media(max-width:520px)` | 44 | `top` | style.css |
| `04-hud-spawn` | style.css | 238 | `.orb-frame:before` | `@media(max-width:520px)` | 28 | `left` | style.css |
| `04-hud-spawn` | style.css | 239 | `.orb-frame:after` | `@media(max-width:520px)` | 28 | `right` | style.css |
| `04-hud-spawn` | style.css | 240 | `.orb-label` | `@media(max-width:520px)` | 44 | `font-size` `letter-spacing` | style.css |
| `04-hud-spawn` | style.css | 242 | `.ability` | `@media(max-width:520px)` | 37 | `height` `padding-top` | style.css |
| `04-hud-spawn` | style.css | 243 | `.ability-icon` | `@media(max-width:520px)` | 37 | `width` `height` | style.css |
| `04-hud-spawn` | style.css | 244 | `.ability-name` | `@media(max-width:520px)` | 28 | `font-size` | style.css |
| `04-hud-spawn` | style.css | 245 | `.abilities` | `@media(max-width:520px)` | 19 | `gap` | style.css |
| `04-hud-spawn` | style.css | 248 | `.potion-count` | `@media(max-width:520px)` | 38 | `font-size` `right` | style.css |
| `04-hud-spawn` | style.css | 250 | `.ability-caption span:last-child` | `@media(max-width:520px)` | 47 | `font-size` | style.css |
| `04-hud-spawn` | style.css | 251 | `.combat-guide` | `@media(max-width:520px)` | 41 | `font-size` `bottom` | style.css |
| `04-hud-spawn` | style.css | 252 | `.combat-guide em` | `@media(max-width:520px)` | 31 | `font-size` | style.css |
| `04-hud-spawn` | style.css | 253 | `.quest` | `@media(max-width:520px)` | 19 | `width` | style.css |
| `04-hud-spawn` | style.css | 254 | `.quest-line` | `@media(max-width:520px)` | 27 | `font-size` | style.css |
| `04-hud-spawn` | style.css | 255 | `.quest p` | `@media(max-width:520px)` | 25 | `max-width` | style.css |
| `04-hud-spawn` | style.css | 262 | `.ability-name` | `@media(pointer:coarse)` | 28 | `font-size` | style.css |
| `04-hud-spawn` | style.css | 268 | `.ability-name` | base | 29 | `font-size` | style.css |
| `04-hud-spawn` | style.css | 270 | `.ability kbd` | base | 28 | `font-size` | style.css |
| `04-hud-spawn` | style.css | 271 | `.orb-label` | base | 26 | `font-size` | style.css |
| `04-hud-spawn` | style.css | 285 | `.ability-icon` | base | 37 | `width` `height` | style.css |
| `04-hud-spawn` | style.css | 286 | `.ability-name` | base | 29 | `margin-top` | style.css |
| `04-hud-spawn` | style.css | 287 | `.ability-name` | `@media(max-width:760px)` | 28 | `font-size` | style.css |
| `04-hud-spawn` | style.css | 288 | `.ability kbd` | `@media(max-width:760px)` | 27 | `font-size` | style.css |
| `04-hud-spawn` | style.css | 289 | `.ability-caption,.ability-caption span:last-child` | `@media(max-width:760px)` | 64 | `font-size` | style.css |
| `04-hud-spawn` | style.css | 290 | `.orb-label` | `@media(max-width:760px)` | 25 | `font-size` | style.css |
| `04-hud-spawn` | style.css | 300 | `.ability-icon` | `@media(max-width:760px)` | 37 | `width` `height` | style.css |
| `04-hud-spawn` | style.css | 301 | `.ability-name` | `@media(max-width:520px)` | 28 | `font-size` | style.css |
| `04-hud-spawn` | style.css | 302 | `.ability kbd` | `@media(max-width:520px)` | 27 | `font-size` | style.css |
| `04-hud-spawn` | style.css | 303 | `.ability-caption,.ability-caption span:last-child` | `@media(max-width:520px)` | 64 | `font-size` | style.css |
| `04-hud-spawn` | style.css | 304 | `.orb-label` | `@media(max-width:520px)` | 25 | `font-size` | style.css |
| `04-hud-spawn` | style.css | 305 | `.ability-icon` | `@media(max-width:520px)` | 37 | `width` `height` | style.css |
| `04-hud-spawn` | style.css | 313 | `.loot-label.uncommon` | base | 35 | `color` | style.css |
| `04-hud-spawn` | style.css | 314 | `.loot-label.rare` | base | 31 | `color` | style.css |
| `04-hud-spawn` | style.css | 316 | `.loot-label.in-reach` | base | 47 | `border-color` | style.css |
| `13-map-expanded` | style.css | 158 | `.map-panel.expanded` | base | 203 | `inset` `transform` `width` `max-width` `padding` `background` `border` `box-shadow` `z-index` | chronicle.css |
| `13-map-expanded` | style.css | 159 | `.map-panel.expanded .map-frame` | base | 69 | `width` `height` `aspect-ratio` | chronicle.css |
| `13-map-expanded` | style.css | 234 | `.map-panel.expanded .map-frame` | `@media(max-width:760px)` | 43 | `height` | chronicle.css |
| `01-title` | style.css | 267 | `#loading[hidden]` | base | 30 | `display` | title-screen.css |
| `07-connection-overlay` | style.css | 443 | `.connection-card` | base | 156 | `width` `padding` `border` `background` `text-align` `color` `border-radius` | chronicle.css |
| `07-connection-overlay` | style.css | 444 | `.connection-card h2` | base | 66 | `font` `margin` | chronicle.css |
| `07-connection-overlay` | style.css | 452 | `.connection-spinner` | `@media(prefers-reduced-motion:reduce)` | 35 | `animation` | title-screen.css |
| `07-connection-overlay` | title-screen.css | 532 | `.connection-brand img` | base | 137 | `width` `height` `aspect-ratio` `object-fit` `mix-blend-mode` | chronicle.css |
| `07-connection-overlay` | title-screen.css | 534 | `.connection-card h2` | base | 108 | `font` `margin` `color` | chronicle.css |
| `07-connection-overlay` | title-screen.css | 563 | `.connection-card` | `@media(max-width:760px)` | 49 | `padding` | chronicle.css |
| `07-connection-overlay` | title-screen.css | 564 | `.connection-brand` | `@media(max-width:760px)` | 51 | `left` `top` | chronicle.css |
| `07-connection-overlay` | title-screen.css | 565 | `.connection-brand img` | `@media(max-width:760px)` | 43 | `width` | chronicle.css |
| `03-roster-picker` | roster.css | 599 | `.roster-dialog::backdrop` | base | 72 | `background` `backdrop-filter` | chronicle.css |
| `03-roster-picker` | roster.css | 600 | `.roster-header` | base | 66 | `position` `text-align` `padding` | chronicle.css |
| `03-roster-picker` | roster.css | 602 | `.roster-header h2` | base | 95 | `font` `color` `margin` `letter-spacing` | chronicle.css |
| `03-roster-picker` | roster.css | 617 | `.roster-classes button[aria-pressed=true] .roster-medallion` | base | 150 | `border-color` `box-shadow` `background` | chronicle.css |
| `03-roster-picker` | roster.css | 655 | `.roster-layout` | `@media(max-width:950px)` | 76 | `gap` `grid-template-columns` | chronicle.css |
| `03-roster-picker` | roster.css | 659 | `.roster-name` | `@media(max-width:950px)` | 28 | `font-size` | chronicle.css |
| `03-roster-picker` | roster.css | 660 | `.roster-skills` | `@media(max-width:950px)` | 28 | `gap` | chronicle.css |
| `03-roster-picker` | roster.css | 666 | `.roster-header` | `@media(max-width:740px)` | 30 | `padding` | chronicle.css |
| `03-roster-picker` | roster.css | 667 | `.roster-header h2` | `@media(max-width:740px)` | 33 | `font-size` | chronicle.css |
| `03-roster-picker` | roster.css | 669 | `.roster-close` | `@media(max-width:740px)` | 36 | `right` `top` | chronicle.css |
| `03-roster-picker` | roster.css | 670 | `.roster-layout` | `@media(max-width:740px)` | 66 | `grid-template-columns` `gap` `margin-top` | chronicle.css |
| `03-roster-picker` | roster.css | 677 | `.roster-description` | `@media(max-width:740px)` | 36 | `padding` | chronicle.css |
| `03-roster-picker` | roster.css | 679 | `.roster-story` | `@media(max-width:740px)` | 42 | `font-size` `min-height` | chronicle.css |
| `03-roster-picker` | roster.css | 681 | `.roster-skills strong` | `@media(max-width:740px)` | 37 | `font-size` | chronicle.css |
| `03-roster-picker` | roster.css | 684 | `.roster-note` | `@media(max-width:740px)` | 28 | `font-size` | chronicle.css |
| `08-inventory` | inventory.css | 707 | `.inventory-identity` | base | 64 | `padding` `text-align` | chronicle.css |
| `08-inventory` | inventory.css | 718 | `.inventory-modal .equipment-slot .gear-tile, .inventory-modal .empty-equipment` | base | 124 | `width` `height` `flex` | chronicle.css |
| `08-inventory` | inventory.css | 720 | `.inventory-attributes` | base | 42 | `margin-top` | chronicle.css |
| `08-inventory` | inventory.css | 729 | `.inventory-pouch` | base | 37 | `margin-top` | chronicle.css |
| `08-inventory` | inventory.css | 741 | `.inventory-modal .empty-cell` | base | 77 | `background` `border-color` | chronicle.css |
| `08-inventory` | inventory.css | 748 | `.inventory-modal .gear-tile:hover, .inventory-modal .gear-tile.selected` | base | 183 | `border-color` `box-shadow` `background-color` | chronicle.css |
| `08-inventory` | inventory.css | 777 | `.modal.inventory-modal .inventory-hint` | base | 103 | `margin` `color` `font-size` `line-height` | chronicle.css |
| `08-inventory` | inventory.css | 785 | `.inventory-modal .inventory-crowns` | `@media(min-width:900px)and(max-height:820px)` | 48 | `top` | chronicle.css |
| `08-inventory` | inventory.css | 787 | `.inventory-identity` | `@media(min-width:900px)and(max-height:820px)` | 41 | `padding-top` | chronicle.css |
| `08-inventory` | inventory.css | 790 | `.inventory-attributes dl > div` | `@media(min-width:900px)and(max-height:820px)` | 49 | `padding` | chronicle.css |
| `08-inventory` | inventory.css | 795 | `.modal-shade:has(.inventory-modal)` | `@media(max-width:899px)` | 52 | `padding` | chronicle.css |
| `08-inventory` | inventory.css | 796 | `.inventory-layout` | `@media(max-width:899px)` | 70 | `grid-template-columns` `gap` | chronicle.css |
| `08-inventory` | inventory.css | 798 | `.inventory-grid` | `@media(max-width:899px)` | 87 | `grid-template-columns` `max-height` | chronicle.css |
| `08-inventory` | inventory.css | 800 | `.inventory-attributes dl` | `@media(max-width:899px)` | 45 | `column-gap` | chronicle.css |
| `08-inventory` | inventory.css | 802 | `.modal.inventory-modal .primary-button` | `@media(max-width:899px)` | 54 | `width` | chronicle.css |
| `08-inventory` | inventory.css | 803 | `.modal.inventory-modal .inventory-hint` | `@media(max-width:899px)` | 74 | `width` `text-align` | chronicle.css |
| `08-inventory` | inventory.css | 806 | `.inventory-modal .inventory-crowns` | `@media(max-width:560px)` | 61 | `top` `right` | chronicle.css |
| `08-inventory` | inventory.css | 807 | `.inventory-crowns strong` | `@media(max-width:560px)` | 44 | `font-size` | chronicle.css |
| `08-inventory` | inventory.css | 811 | `.inventory-attributes dl` | `@media(max-width:560px)` | 45 | `column-gap` | chronicle.css |
| `08-inventory` | inventory.css | 812 | `.inventory-grid` | `@media(max-width:560px)` | 42 | `padding` `gap` | chronicle.css |
| `08-inventory` | inventory.css | 814 | `.inventory-modal .inventory-detail h3` | `@media(max-width:560px)` | 57 | `font-size` | chronicle.css |
| `08-inventory` | inventory.css | 818 | `.inventory-grid` | `@media(max-width:359px)` | 68 | `grid-template-columns` | chronicle.css |
| `11-npc-dialogue` | dialogue.css | 853 | `.modal.npc-modal.has-npc-portrait` | `@media(max-width:700px)` | 138 | `grid-template-columns` `column-gap` `width` | chronicle.css |
| `11-npc-dialogue` | dialogue.css | 854 | `.npc-modal .dialogue-portrait` | `@media(max-width:700px)` | 85 | `grid-row` `height` `margin-bottom` | chronicle.css |
| `11-npc-dialogue` | dialogue.css | 858 | `.modal-shade.npc-conversation` | `@media(max-width:600px)` | 52 | `padding` | chronicle.css |
| `11-npc-dialogue` | dialogue.css | 861 | `.npc-modal .npc-speech` | `@media(max-width:600px)` | 42 | `font-size` | chronicle.css |
| `11-npc-dialogue` | dialogue.css | 863 | `.dialogue-reply` | `@media(max-width:600px)` | 35 | `font-size` | chronicle.css |
| `11-npc-dialogue` | dialogue.css | 866 | `.npc-modal .dialogue-farewell` | `@media(max-width:600px)` | 50 | `margin-left` | chronicle.css |
| `11-npc-dialogue` | dialogue.css | 869 | `.dialogue-rule` | `@media(max-height:650px)` | 38 | `margin-bottom` | chronicle.css |
| `11-npc-dialogue` | dialogue.css | 870 | `.npc-modal .npc-speech` | `@media(max-height:650px)` | 61 | `font-size` `line-height` | chronicle.css |
| `11-npc-dialogue` | dialogue.css | 871 | `.npc-modal .dialogue-choices` | `@media(max-height:650px)` | 49 | `margin-top` | chronicle.css |

(The `Scenario` column is the batch: `04-hud-spawn` = A, `13-map-expanded` = B, `01-title` = C,
`07-connection-overlay` = D, `03-roster-picker` = E, `08-inventory` = F, `11-npc-dialogue` = G.)

## 6. Caveats — not classified; do not delete

Everything below was either outside what the method can decide, or decided conservatively. None of it
is licensed for deletion by this document.

**Selector relationships the engine does not model.** A definition is only ever compared with
definitions of the *same normalised selector*. A rule that loses to a *different, more specific*
selector — `.modal.inventory-modal` over `.modal`, `#connection-retry` over `.connection-card
.text-button` — is reported as live. This can only hide dead rules, never invent them, so the 120 are
a floor and not a ceiling. Batch H in section 5 is one instance of that gap that happened to be
provable by hand; there may be more.

**Overlapping media queries.** `@media(max-width:760px)` and `@media(max-width:520px)` both apply at
500px, but they are treated as separate contexts and never compete. Same for `(pointer:coarse)`,
`(hover:none)`, `(prefers-reduced-motion:reduce)` and the several `min-width`/`max-height` pairs.
Conservative in the safe direction; it is also why a handful of narrow-viewport rules that are probably
dead are reported live.

**Pseudo-elements whose box depends on `content`.** One dead rule is on a pseudo-element:
`roster.css` #599 `.roster-dialog::backdrop` (sets `background`, `backdrop-filter`, both beaten by
`chronicle.css` #950). It sets no `content`, and `::backdrop` needs none, so it is safe. But the
general pattern — a rule that styles `::before` while the `content` that creates the box comes from a
different rule — is not modelled: deleting the one with `content` would delete the box. The tree has
29 `:before`/`:after` rules in `style.css` alone, several of which are split this way
(`.orb-frame::before,.orb-frame::after` declares `content:''` at #79 and geometry at #378). None of
them are in the deletion list, and none should be added without checking where `content` comes from.

**Custom properties.** `--inventory-line`, `--inventory-text` and `--inventory-muted` are declared on
`.modal.inventory-modal` in *both* `inventory.css` and `chronicle.css`; `chronicle.css` wins, and
`inventory.css` rules read them through `var()`, so the values that reach the screen come from
`chronicle.css` while the consumers live in `inventory.css`. The map treats them as ordinary
properties, which is correct for the cascade, but any rule reshuffling has to keep the declaring
element an ancestor of the reading ones. Separately, `--muted`, `--ink` and `--inventory-deep` are
declared and never read (section 3) — **not classified; do not delete**, because nothing here proves
no future or non-CSS reader exists.

**`@keyframes`.** `arrival`, `liquid` and `connection-spin` in `style.css` are not selectors, carry no
specificity, and are not analysed. `connection-spin` is referenced by `.connection-spinner`, which
T2-5 moves — the reference is global so it will still resolve, but the keyframes block must not travel
with the deleted rules.

**Rules gated on JavaScript-added classes and attributes.** Nine dead rules only match once JS sets a
class or attribute: `.map-panel.expanded` (×3), `#loading[hidden]`, `.loot-label.in-reach`,
`.roster-classes button[aria-pressed=true] .roster-medallion`, `.inventory-modal .gear-tile:hover` /
`.gear-tile.selected`, `.modal-shade.npc-conversation`, `.modal.npc-modal.has-npc-portrait`. Their
layering verdict is sound — the class only decides *whether* the rule applies, not who wins when it
does — but the screenshot scenario for each has to actually reach that state, which is why they are
distributed across batches B, C, E, F and G rather than lumped with A.

**`:hover` / `:focus-visible` / `[hidden]` variants are different selectors.** `.gear-tile` and
`.gear-tile:hover` are compared independently and never against each other, which is correct. It does
mean a "dead" base rule and a live `:hover` rule can sit next to each other in the same sheet; check
the neighbourhood before deleting a block wholesale rather than a rule at a time.

**Logical properties.** `dialogue.css` #867 `padding-block:10px` and `chronicle.css` #1043
`padding-inline:7px` are folded onto their physical equivalents, which is right for this page
(`horizontal-tb`, `ltr`) and would stop being right under a different writing mode.

**`text-wrap` and `white-space`.** Chrome expands `white-space` into `text-wrap-mode` +
`white-space-collapse` and `text-wrap` into `text-wrap-mode` + `text-wrap-style`, so the two shorthands
overlap on `text-wrap-mode`. The hand-written table keeps them separate. The only place both appear on
one selector is `.connection-card p` (`text-wrap:balance` from `title-screen.css`, no `white-space`
anywhere in the family), so nothing in the deletion list is affected — but a future merge that brings
them together should check it.

**`:is()`, `:has()`, `:not()`.** Five selectors use them —
`inventory.css` and `chronicle.css` `.modal-shade:has(.inventory-modal)`,
`chronicle.css` `.modal-shade:has(.pause-modal)` and `.chronicle-shell :is(button,a,summary):focus-visible`,
`dialogue.css` `.npc-modal .dialogue-choices:not(:has(button:hover)):not(:has(button:focus-visible)) .is-suggested`.
Their specificity is computed per spec (most specific argument), and the first pair is a genuine
cross-file duplicate that appears in section 2. None are in the deletion list.

**`!important`.** Nine `!important` declarations exist across the eight sheets. They are honoured in
the winner computation. Three of them (`title-screen.css` `.mode-corners`, `.title-screen *`,
`chronicle.css` `.chronicle-main`) exist specifically to win against rules this document treats as
live, and are a hint that the sheets were layered by trial and error rather than by design.
