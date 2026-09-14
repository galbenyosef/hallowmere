# Expanded exploration

Every map has six times its previous bounding area. Character speed, the original
villages, quest objectives, and passage destinations retain their coordinates.

- The overworld grows from 107 × 54 to 214 × 162 world units. Sixteen named
  locations surround the original route, including two hamlets with four enterable
  houses, five rest checkpoints, eleven guarded caches, and sixteen forage patches.
- Each surface region grows from 60 × 60 to 120 × 180, with eight peripheral
  locations, connected trails, three rest checkpoints, and five guarded caches.
- Each of the five caves gains ten connected chambers and five guarded caches.
  Cave width triples and depth doubles; the original entrances remain in place.
- The Underways grow from 60 × 36 to 120 × 108. Six new treasure areas stay inside
  the existing three gated sections. Their partitions extend to the new boundaries.

Optional surface enemies do not advance the twelve afflicted required to awaken
the Bellkeeper. New overworld areas can be reached before opening the chapel.
Ashwick's sanctuary is bounded so enemies in the surrounding wilderness can fight.

The minimap and expanded map reveal a radius of eleven world units around the
authoritative player position, respecting walls. Terrain and stationary landmarks
remain charted, while enemy markers require nearby line of sight. Unexplored
terrain, labels, and markers remain hidden. Exploration is personal, keyed to the
world and player, retained across travel and death, and cleared for a new world.
Session storage also retains the chart for a reconnect to that same world/player.

For an optional review tour, open `/?preview=exploration`, choose single player,
and select a character. The tour offers map and location selectors and a safe
mode. Ordinary play at `/` has no tour controls. The existing `/?preview=caves`
tour remains available.

Validation during implementation is limited to visual review and lightweight
layout inspection. Automated tests and build validation are deferred until an
explicitly authorized merge, as required by this repository.
