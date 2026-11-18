## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)

## Card thumbnails (Things / Notes)

Cards on `/things` and `/notes` (`src/components/SectionPage.astro`) use thumbnails that Claude makes, not screenshots or photos. For every new card, create one with these rules:

- File: SVG, 1200×800 (3:2), saved as `public/images/thumbs/<slug>.svg`, then set as the item's `image` in `src/pages/things.astro` or `src/pages/notes.astro`.
- Background: the main color of the page the card links to (read it from that page's CSS, e.g. its accent or background color). For notes built with `src/components/NoteArticle.astro`, use the page's `accent` prop as background and a dark ink that reads on it.
- Center: one figure that visualizes the page's topic, with the shapes' combined bounding box centered on 600,400 and at least ~130px of background above and below.
- Style (reference: two cut-paper people sharing a heart): a single solid silhouette in the page's dark ink color, chunky and playful like hand-cut paper. Build it from thick round-capped strokes (limbs ~50-60px, torso ~100px) and a round head, plus one object tied to the topic. Show one detail as negative space cut out in the background color (e.g. a heart or a target), and add one small separate dot near the bottom right. Apply the shared wobble filter so edges look hand-cut: `<feTurbulence type="fractalNoise" baseFrequency="0.016" numOctaves="2"/>` into `<feDisplacementMap scale="16"/>`.
- Use only that page's own palette (background color + ink color); no text, photos, gradients, or shadows.

Existing examples: `goal.svg` (orange `#F28C28`, figure planting a flag with a target cut-out) and `diary.svg` (warm gray `#F1F1EF`, figure hugging a ring-bound diary with a heart cut-out).
