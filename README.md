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

### Pro items

Pro items (`promotions-pro`, `promo-side-card`, `promo-spotlight`, kits and
more) come from an authenticated registry. Add it next to `@kitsu` and keep the
key in `.env.local`:

```json
"@kitsu-pro": {
  "url": "https://kitsu-lab.vercel.app/pro/r/{name}.json",
  "headers": { "Authorization": "Bearer ${KITSU_PRO_KEY}" }
}
```

```bash
npx shadcn@latest add @kitsu-pro/promotions-pro
```

The route serves `registry-pro/r/` to keys listed in the `KITSU_PRO_KEYS`
environment variable (comma separated); without it the pro registry is closed.

## Items

| Item                                    | What it is                                                                                     |
| --------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `book-preview` (+ `book-preview-*`)     | Accessible book and PDF reader with optional page, spread, scroll, curl, PDF and WebGL engines |
| `promotions` (+ `promotion`, `promo-*`) | Scheduled bar, card, toast and dialog with targeting, frequency rules, event triggers and i18n |
| `keyboard-button`                       | Tactile keycap with spring press physics                                                       |
| `email-domain-input`                    | Email input restricted to approved domains                                                     |

## Develop

```bash
bun install
bun dev
```

Before committing run `bun run check`, `bun run build` and
`bun run registry:build` (see `AGENTS.md`). `public/r/` and `registry-pro/r/`
are generated; commit them with the source that produced them.

## License

MIT
