# Chosen character concepts

Selections submitted by the user on September 12, 2026. The source of these
choices is the Hallowmere character study gallery.

## Wizard directions

| ID | Direction | Weapon | Off-hand focus |
| --- | --- | --- | --- |
| W06 | Mire Witch | Gnarled root staff | Marsh lantern |
| W07 | Bone Oracle | Skull-topped staff | Spirit skull |
| W10 | Storm Hermit | Lightning fork staff | Storm orb |

## Character classes

| ID | Class | Weapon | Off-hand equipment |
| --- | --- | --- | --- |
| C01 | Sorcerer | Crystal-tipped staff | Spellbook |
| C02 | Ranger | Elven longbow | Quiver & twin fighting knives |
| C03 | Reaver | Two-handed war axe | Fury talisman |
| C04 | Nightblade | Paired hooked daggers | Throwing knives |
| C05 | Oathkeeper | Lantern mace | Kite shield |
| C09 | Plague Alchemist | Hand crossbow | Alchemical flask |

## Study organization

The gallery opens on these nine concepts, with the six classes together and the
three wizard directions in a separate Sorcerer appearance group. Treating the
wizard directions as Sorcerer appearances is the current working interpretation;
the original selection included all three without choosing a default. Bone Oracle
is now the gameplay default, while this gallery preserves the original studies.
The Sorcerer's original C01 study remains available as its class reference.

The recorded choices live in `dist/character-study-selection.js`. The editable
browser shortlist begins with these choices and can change independently.
All 20 original concepts remain available in the other gallery collections.

## Playable roster

Seven characters are integrated into the live game, including Geralt using the
existing character study model. The initial character screen shows their weapons,
equipment, stats, and abilities. Sorcerer defaults to **Bone Oracle (W07)**, with
the skull-topped staff and spirit skull. Skin selection is removed, and saved
picker preferences use Bone Oracle on the next selection. Older active sessions
can retain their Sorcerer appearance; the original studies remain archived.
All Sorcerer appearances share the same combat kit. Fireball restores the
large fireball, fiery trail, cast flash, and impact burst on right mouse
(18 essence, 1.2-second cooldown), replacing Frostbind.

| Class | Primary attack | Right mouse | 1 · Evade | 2 · Class skill |
| --- | --- | --- | --- | --- |
| Sorcerer | Arcane Bolt | Fireball | Miststep | Elemental Storm |
| Ranger | Elven Quickshot / Twin Blades | Piercing Shot | Elven Step | Threefold Volley |
| Reaver | Rend | War Cry | Rush | Blood Whirl |
| Nightblade | Twin Cut | Knife Fan | Shadowstep | Smoke Veil |
| Oathkeeper | Consecrated Strike | Aegis | Pilgrim’s Step | Sanctuary |
| Plague Alchemist | Virulent Bolt | Bitter Remedy | Quickstep | Miasma |
| Geralt | Steel Strike | Igni | Witcher’s Roll | Quen |

Press **C**, click the character name, or choose **Change class** from the game
menu while in a sanctuary. Switching retains quest progress, crowns, equipment
IDs, upgrades, and health/essence percentages. Weapons adapt to the chosen class;
cooldowns cannot be reset by switching. A per-tab reconnect retains the class,
and group world resets retain the class choice while resetting campaign progress.

The Ranger's Legolas-inspired kit keeps the existing `ranger` class and `C02`
appearance identity. Primary attacks automatically use two knife cuts against
visible enemies within 2.15 units in the forward cone, and bow shots otherwise.
Both modes share one cooldown. Elven Step follows movement input or retreats
opposite the aim when stationary. Threefold Volley fires three physical arrows;
each can pierce two enemies and is stopped by walls. Appearance work awaits the
user's visual references; the original Ranger model is still in place.

The authoritative server owns damage, projectiles, poison and bleed ticks,
roots, slows, shields, concealment, and cooperative healing. Class definitions
and live ability descriptions are in `dist/classes.js`; the gallery remains a
separate archive of the original concepts and their proposed skills.
