# Kitsu-Lab

A shadcn registry of production components, each with a live exhibit.

**Live:** https://kitsu-lab.vercel.app

## Install a component

Register the namespace once in your project's `components.json`:

```json
{
  "registries": {
    "@kitsu": "https://kitsu-lab.vercel.app/r/{name}.json"
  }
}
```

Then add items by name:

```bash
npx shadcn@latest add @kitsu/book-preview
npx shadcn@latest add @kitsu/promotions
```

Items target shadcn's Base UI styles (`base-*`). Each item's `docs` field notes
anything else it needs.

## Items

| Item                                    | What it is                                                                                                                               |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `book-preview` (+ `book-preview-*`)     | Accessible book and PDF reader with optional page, spread, scroll, curl, PDF and WebGL engines                                           |
| `promotions` (+ `promotion`, `promo-*`) | Campaign system: bar, inline card, corner card, side panel and dialog, with offers and codes, a device preview, a timeline and an editor |
| `keyboard-button`                       | Tactile keycap with spring press physics                                                                                                 |
| `email-domain-input`                    | Email input restricted to approved domains                                                                                               |

## Develop

```bash
bun install
bun dev
```

Before committing run `bun run check`, `bun run build` and
`bun run registry:build` (see `AGENTS.md`). `public/r/` is generated; commit it
with the source that produced it.

## License

MIT
