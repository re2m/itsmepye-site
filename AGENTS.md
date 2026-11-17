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
- Background: the main color of the page the card links to (read it from that page's CSS, e.g. its accent or background color).
- Center: simple flat geometric shapes that visualize the page's topic, placed exactly in the middle of the canvas (center the shapes' combined bounding box on 600,400), leaving at least ~130px of background above and below.
- Use only that page's own palette; no text, photos, gradients, or shadows.

Existing examples: `goal.svg` (orange `#F28C28`, target rings) and `diary.svg` (warm gray `#F1F1EF`, bound notebook).
