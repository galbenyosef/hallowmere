# Expanded exploration

Every map has six times its previous bounding area. Character speed, the original
villages, quest objectives, and passage destinations retain their coordinates.

- The overworld grows from 107 × 54 to 214 × 162 world units. Sixteen named
  locations surround the original route, including two hamlets with four enterable
  houses, five rest checkpoints, four guarded caches, and sixteen forage patches.
- Each surface region grows from 60 × 60 to 120 × 180, with eight peripheral
  locations, connected trails, three rest checkpoints, and one or two guarded caches.
- Each of the five caves gains ten connected chambers, with two or three guarded
  caches spread through each full cave.
  Cave width triples and depth doubles; the original entrances remain in place.
- The Underways grow from 60 × 36 to 120 × 108. Six new side areas stay inside
  the existing three gated sections, with one cache per section. Their partitions
  extend to the new boundaries.

Optional surface enemies do not advance the twelve afflicted required to awaken
the Bellkeeper. New overworld areas can be reached before opening the chapel.
Ashwick's sanctuary is bounded so enemies in the surrounding wilderness can fight.

Only one in every three authored treasure caches is retained: 25 across all maps,
down from 74 (66.2% fewer, rounded to whole chests). Their original IDs,
guard requirements, and rewards are preserved; positions follow the revised
level layouts. Removed caches have no chest,
map marker, interaction, or reward; scenery, encounters, forage, and routes remain.
Ordinary enemy drops already retain one third of their original rolls. Boss loot,
the first equipment drop, and quest rewards are unchanged.

Visual review confirmed that Lantern Fen and the Crystal Veil no longer show
their removed chests or cache markers, while their encounters and scenery remain.
Gloom Cavern's objective correctly reports three caches. Browser error logs were
clear. Captures are in `screenshots/expanded-exploration/reduced-loot-*.png`.

The minimap and expanded map reveal a radius of 22 world units around the
authoritative player position, respecting walls. This doubles the original
11-unit radius and reveals approximately four times the area in open terrain.
Terrain and stationary landmarks remain charted, while enemy markers require
line of sight within eleven world units. Unexplored terrain, labels, and markers
remain hidden beneath fog.

Exploration is saved in browser local storage. Solo discoveries use a stable
profile, so refreshing or reopening the game restores all charted areas despite
new runtime player/world IDs. Multiplayer charts remain personal to each world
and adventurer and restore on reconnect. Both retain discoveries across travel
and death. An explicit solo game restart clears that profile's chart.

New discoveries autosave within 750 ms, including the final footsteps before
stopping. Opening the map, hiding the tab, and leaving the page flush pending
changes. The expanded map reports whether discoveries are saved or browser
storage is unavailable. Saved grids include their bounds and cell size so a
changed map layout does not restore cells at incorrect coordinates. Saves merge
discoveries from other tabs, and malformed or unavailable storage cannot prevent
play. Saves are local to this browser and site address.

For an optional review tour, open `/?preview=exploration`, choose single player,
and select a character. The tour offers map and location selectors and a safe
mode. Preview charts stay in memory and do not alter normal saved discoveries.
Ordinary play at `/` has no tour controls. The existing `/?preview=caves` tour
remains available.

Validation during implementation is limited to visual review and lightweight
layout inspection. Automated tests and build validation are deferred until an
explicitly authorized merge, as required by this repository.

Persistence review: walked from Ashwick to Hearthstead in ordinary solo play,
charted 3.6%, reloaded, and entered solo play again. The character returned to
Ashwick while the full trail and Hearthstead label remained charted at 3.6%,
with untouched terrain still fogged. The map reported that discoveries were
saved on this device. No browser console errors appeared. Before/after captures
are in `screenshots/expanded-exploration/discoveries-{before,after}-return.png`.

Radius review: with the new 22-unit radius, retracing the Ashwick-to-Hearthstead
route expanded the saved chart from 3.6% to 8.6%. The surrounding terrain revealed
more broadly while distant areas stayed fogged, with no browser console errors.
Capture: `screenshots/expanded-exploration/larger-discovery-radius.png`.

## Distinct roads and passages

Every level has its own authored route layout. The surface regions no longer
share an outer loop with eight spokes, and caves no longer share a chamber ring.

| Level | Route layout |
| --- | --- |
| Hallowmere | Curved country lanes, a fork through Hearthstead, and a crescent below Alderbrook's houses |
| Drowned Wood | Winding bank trails, branching approaches, and timber crossings |
| Blackvein Quarry | Haul-road switchbacks, stepped shelves, gravel ruts, and mine rails |
| Crownfall Keep | Broad paved avenues, offset courts, and rampart streets |
| The Underways | A western root loop, central mine doglegs, and eastern crypt avenues within the existing seals |
| Moss Hollow | Split root galleries with secluded side pockets |
| Cellar Depths | Square vaults linked by offset service passages |
| Gloom Cavern | Broad, braided passages and alternate routes around the rift |
| Old Road Cellar | A long smuggling route with doglegs and a remote branch |
| Gravekeeper's Hollow | Burial wings branching into separate funerary galleries |

Road scenery, vegetation clearance, and map lines consume the same route data.
The old generic lane overlays are removed. Scenery frames the new roads without
blocking them. Original village buildings, objectives, entrances, progression
gates, and the reduced cache count remain in place. Charted cells remain saved;
the new layouts do not reveal unexplored terrain automatically.

Navigation searches the finite map grid with a priority queue. It no longer stops
after the old 16,000-entry limit, which could incorrectly report distant chambers
or forage as unreachable. Nearby clear routes use a direct segment; long routes
retain intermediate waypoints and all paths respect the shared collision geometry.

The read-only `/route-atlas.html` overview draws all ten layouts from the actual
map data and links to each gameplay tour. It shows full terrain for review only;
ordinary gameplay retains exploration fog. Screenshots are named
`screenshots/expanded-exploration/roads-*.png`.

Lightweight layout inspection found connected cave floor footprints and clear
encounter/cache positions. Road approaches were inspected around solid scenery
and buildings. Gameplay review covered Drowned Wood, Survey Camp, Crownfall Keep,
Alderbrook, and a square vault in Cellar Depths. Browser error logs were clear.
Automated tests and build validation remain deferred until an explicitly
authorized merge.

## Drifting gameplay fog

Sparse pockets of ground fog sit along selected village paths, outland clearings,
and cave chambers. Three low, transparent layers drift at different speeds while
animated cloud noise changes their shape. Most of each map remains clear; these
pockets belong to fixed locations rather than following the player.

The effect fades near the player to preserve combat visibility and clips to
walkable ground outside building interiors and rock. Distant pockets fade out
and are culled; the layers share geometry and materials within each pocket.
Region changes dispose of their fog resources. Reduced-motion preferences keep
the fog still. Exploration visibility and saved discoveries are unaffected.

Visual review covered Hearthstead Hamlet, the Crystal Veil encounter, and
Mosswatch Ruins. Two captures of the stationary hamlet scene show the wisps
changing shape over time. The fog remained localized and characters, treasure,
paths, and surrounding scenery stayed readable. Browser shader/error logs were
clear; automated tests and build validation remain deferred until an authorized
merge. Captures are named `screenshots/expanded-exploration/drifting-fog-*.png`.
