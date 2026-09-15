# Social previews

The game includes two share images in the deployed `dist/` directory:

| Asset | Dimensions | Use |
| --- | --- | --- |
| [og.png](../dist/og.png) | 1731 × 909 | Primary Open Graph image and Twitter large-image card |
| [gameplay.jpg](../dist/assets/social/gameplay.jpg) | 1280 × 720 | Alternate Open Graph image; unedited copy of `screenshots/gameplay.jpg` |

The branded card was created with built-in ImageGen using the existing [app icon](assets/app-icon.png), [Warden portrait](../dist/assets/inventory/warden.png), and [gameplay screenshot](../screenshots/gameplay.jpg) as references. It retains the icon's Warden, weathered steel, pale gothic lettering, and cold village atmosphere. It is promotional artwork; the alternate image shows the actual game.

The generated PNG is opaque and retains its original 1731 × 909 dimensions, close to the requested 1.91:1 landscape ratio. Its exact dimensions are declared in the metadata. No image-generation dependency is required to build or serve the game, and `npm run generate` does not overwrite these images.

## Metadata and hosting

`dist/index.html` contains the canonical URL, Open Graph title/description/site name/type/locale, both image URLs with their own dimensions, MIME types and alt text, and the Twitter large-image card metadata. These tags are in the initial HTML so crawlers can read them without JavaScript, WebGL, or a multiplayer connection. The branded card appears first; consumers that support choosing alternate Open Graph images can also offer the gameplay screenshot.

The canonical and social image URLs use the public deployment documented in the README: `https://miguelsolorio.github.io/hallowmere/`. If the public domain or repository path changes, update `link[rel="canonical"]`, `og:url`, both `og:image` values, and `twitter:image` together. Local game assets remain relative. The images become available to public crawlers after the next requested deployment; local validation does not publish them.

When replacing a preview, verify the image's actual dimensions, update its alt text if the composition changes, and update the corresponding metadata. Refresh the alternate by copying `screenshots/gameplay.jpg` to `dist/assets/social/gameplay.jpg`. Social services may cache previews; use a new image filename and update its metadata URL when a refresh must bypass an existing cache.

Metadata follows the [Open Graph protocol](https://ogp.me/), including the ordering of each image's structured properties.

## Generation prompt

Generated once with built-in ImageGen; no retries or post-generation artwork edits.

```text
Use case: compositing.
Asset type: finished Hallowmere social preview card, opaque landscape image, exactly 1200 × 630 pixels (1.91:1).

Input images and roles:
Image 1 app-icon.png is the PRIMARY identity reference and compositing input: preserve its recognizable hooded, closed-helmet Warden, weathered cold steel armor, silver gothic title treatment, and blue-green mist palette.
Image 2 warden.png is a supporting game character reference for the Warden's battered armor, cloak, and solemn silhouette.
Image 3 gameplay.jpg is a supporting environment reference ONLY: its actual village's steep blue slate roofs, timber-framed cottages, bare trees, cobbled ground, darkness and tiny warm window lights. Remove all interface elements, labels, characters and game HUD from this environmental reference.

Compose polished dark fantasy key art using the existing references. Place one large recognizable Warden prominently on the RIGHT, waist-up, face hidden by the dark hood and closed helmet, cold weathered steel catching subtle silver-blue light, hand on sword. Maintain the helmet, layered hood, armor and cloak identity from Image 1. The same village atmosphere extends naturally behind the figure: clustered steep slate rooftops, bare trees, tiny warm window highlights and cold drifting mist. Ink-black and muted blue-green dominate. Keep the left side dark and calm behind the lettering, with enough faint village detail to feel inhabited.

Text must be rendered verbatim, entirely on the LEFT, with generous safe margins at least 64 pixels from all edges:
"HALLOWMERE"
"THE ASHEN VIGIL"
"A DARK FANTASY ACTION RPG"

The first line is the large, highly legible primary title in pale bone/silver gothic serif lettering matching the first reference; spell it H A L L O W M E R E, all letters present in that order, one word on one line. Under it put the smaller widely spaced subtitle THE ASHEN VIGIL; below that, the small supporting line A DARK FANTASY ACTION RPG. Keep all text clearly readable at link-card size and separated from the Warden. Refined hierarchy, atmospheric illustration, full rectangular bleed. This is branded key art, not a gameplay screenshot.

Constraints: preserve the existing game's visual identity and exact text. No unrelated characters, no extra copy, no logo symbol, no watermark, no HUD, no UI chrome, no icon container, no border, no rounded corners, no transparency.
```
