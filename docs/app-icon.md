# Hallowmere app icon

Created with built-in ImageGen using the existing [Warden illustration](../dist/assets/inventory/warden.png) and village atmosphere as references. The icon was then edited with built-in ImageGen using the previous icon as the edit target and the gameplay screenshot available at the time as the color reference. The revision uses the game's ink-black and blue-green shadows, corroded steel, gray-green fog, skeletal antler motif, and haunted belfry for a colder, more ominous mood.

The final revision adds the **HALLOWMERE** title across the bottom in pale gothic serif lettering and rounded corners, using the user-provided app icon as a layout reference. The cold Warden artwork and game palette are preserved.

The square PNG exports below preserve the rounded silhouette and transparent outer corners.

| Asset | Dimensions | Use |
| --- | --- | --- |
| [app-icon.png](app-icon.png) | 1024 × 1024 | Main app artwork and README |
| [icon-192.png](../dist/assets/icons/icon-192.png) | 192 × 192 | High-resolution browser icon |
| [apple-touch-icon.png](../dist/assets/icons/apple-touch-icon.png) | 180 × 180 | Apple home-screen icon |
| [favicon-32.png](../dist/assets/icons/favicon-32.png) | 32 × 32 | Browser tab icon |

These image assets are separate from the procedural model/audio generator and are not overwritten by `npm run generate`.

## Revision prompt

```text
Use case: precise-object-edit
Asset type: Hallowmere game app icon, final 1024x1024 PNG with real transparent corners.
Primary request: edit Image 1 to add the game's name across the bottom and round the outer corners, following the layout of the app icon in Image 2.
Input images: Image 1 is the edit target, the existing cold dark Hallowmere Warden artwork. Image 2 is ONLY a reference for prominent bottom title typography and rounded-square silhouette. Do not copy its demon, warm palette, white page surround, Diablo wording, or trademark symbol.
Preserve exactly: the existing Warden's helmet, dark hood, steel armor, sword, pose, spectral village, antler arch and haunted belfry; retain the cold desaturated blue-green/black palette, eerie mist, moonlight and creepy mood. No warm recoloring.
Change only:
1. Add the exact title "HALLOWMERE" in one centered line across the lower part of the icon. Spell H A L L O W M E R E, exactly ten letters. Large, bold, highly legible uppercase dark-fantasy serif lettering with sharp carved serifs, inspired by the reference's hierarchy. Pale bone-white with a restrained aged-silver finish and subtle dark shadow, not glowing neon. A custom wordmark for Hallowmere, not the Diablo wordmark. Fit the complete title within about 88% of canvas width, baseline around 89% of canvas height, with sufficient lower and side breathing room. Darken the narrow area immediately behind the title as necessary for readability; the Warden remains the focal character above it. No subtitle or additional text.
2. Clip the entire artwork and title to a smoothly rounded square with a corner radius of about 22% of icon width, similar to the reference. Four corners outside that rounded silhouette must be genuinely transparent alpha, NOT white, black, checkerboard or painted background. The rounded square must occupy the entire square image bounds, touching the top, bottom, left and right edges at their midpoints, with no outer padding, border, frame, background card or shadow outside the icon.
Constraints: one finished square app icon only; actual PNG alpha transparency outside the rounded corners; opaque image inside; no other characters, no orange fire or red fabric, no extra logo, no watermark, no duplicated text. Keep subject and title readable at small sizes.
```

## Transparency repair prompt

Built-in ImageGen removed the initial export's simulated transparency. The final PNGs have an alpha channel with fully transparent outer corners.

```text
Use case: background-extraction
This is a precise transparency repair of the supplied finished Hallowmere icon. Keep the character, all artwork INSIDE the rounded square, and the exact HALLOWMERE title unchanged. Keep the identical composition, cold palette, square dimensions and rounded silhouette.
REMOVE ONLY the gray checkerboard visible OUTSIDE the rounded-square icon, in the four outer corners. The checkerboard is accidentally baked into the source image; it must be removed and replaced with actual transparent alpha pixels. This is a transparent PNG cutout request. Do not paint a checkerboard or solid color to simulate transparency. Return a genuine RGBA PNG whose corner alpha is 0, while the inner artwork and title remain opaque. Clean antialiased curved edges. No margins, no shadows outside the cutout, no new background, no redesign, no changed text. The title must remain spelled HALLOWMERE.
```

## Gameplay screenshot

[gameplay.jpg](../screenshots/gameplay.jpg) is an unedited 1280 × 720 browser capture of the running game in Ashwick Village, refreshed after the village asset update. It shows the actual environment, player, villagers, quest tracker, minimap, and combat HUD.
