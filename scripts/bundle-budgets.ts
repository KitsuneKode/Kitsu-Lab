/**
 * Bundle cost of every registry item, gzipped, as a buyer pays it.
 *
 *   own      the item's own files, minified; everything else is external
 *   initial  the item plus its npm and shadcn dependencies, loaded up front
 *   lazy     chunks it loads on demand (optional engines, pdf.js, three)
 *
 * React, React DOM and Next are the host's and never counted.
 *
 *   bun scripts/bundle-budgets.ts            print the table
 *   bun scripts/bundle-budgets.ts --check    fail if an item is over budget
 *   bun scripts/bundle-budgets.ts --update   set budgets to measured + 10%,
 *                                            and publish sizes in each
 *                                            item's registry docs
 *
 * Budgets live in bundle-budgets.json (kB, gzipped). After --update, run
 * the formatter and registry:build.
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'

type Item = { name: string; files?: { path: string }[] }
type Sizes = { own: number; initial: number; lazy: number }
type Budgets = Record<string, { own: number; initial: number }>

const ROOT = resolve(import.meta.dir, '..')
const BUDGETS = join(ROOT, 'bundle-budgets.json')
const HOST = /^(react|react-dom|next)(\/|$)/
const CODE = /\.(tsx?|css)$/

const REGISTRIES = ['registry.json', 'registry-pro.json']
const items: Item[] = REGISTRIES.flatMap(
  (file) => JSON.parse(readFileSync(join(ROOT, file), 'utf8')).items,
)

const gz = (text: string | Uint8Array) => gzipSync(text, { level: 9 }).length

async function measure(
  item: Item,
  own: boolean,
): Promise<Omit<Sizes, 'own'> & { total: number }> {
  const files = (item.files ?? [])
    .map((file) => resolve(ROOT, file.path))
    .filter((path) => CODE.test(path))
  const dir = mkdtempSync(join(tmpdir(), 'kitsu-budget-'))
  const entry = join(dir, 'entry.ts')
  writeFileSync(
    entry,
    files
      .map((path) =>
        path.endsWith('.css')
          ? `import ${JSON.stringify(path)}`
          : `export * from ${JSON.stringify(path)}`,
      )
      .join('\n'),
  )
  const mine = new Set(files)
  try {
    const result = await Bun.build({
      entrypoints: [entry],
      outdir: join(dir, 'out'),
      target: 'browser',
      format: 'esm',
      minify: true,
      splitting: true,
      define: { 'process.env.NODE_ENV': '"production"' },
      plugins: [
        {
          name: 'boundary',
          setup(build) {
            build.onResolve({ filter: /.*/ }, (args) => {
              if (HOST.test(args.path))
                return { path: args.path, external: true }
              if (!own || args.importer === entry || args.importer === '')
                return undefined
              // Own cost: anything outside the item's files is someone else's.
              const target = Bun.resolveSync(args.path, dirname(args.importer))
              return mine.has(target)
                ? undefined
                : { path: args.path, external: true }
            })
          },
        },
      ],
    })
    if (!result.success)
      throw new AggregateError(result.logs, `${item.name} failed to bundle`)
    const outputs = new Map<string, string>()
    for (const output of result.outputs)
      outputs.set(output.path, await output.text())
    // Initial: the entry and every chunk it reaches by static import.
    const start = result.outputs.find(
      (output) => output.kind === 'entry-point',
    )!.path
    const initial = new Set<string>()
    const visit = (path: string) => {
      if (initial.has(path)) return
      initial.add(path)
      const text = outputs.get(path) ?? ''
      for (const match of text.matchAll(/(?:from|import)\s*"(\.\/[^"]+\.js)"/g))
        visit(resolve(path, '..', match[1]!))
    }
    visit(start)
    let first = 0
    let rest = 0
    for (const [path, text] of outputs) {
      if (initial.has(path) || path.endsWith('.css')) first += gz(text)
      else rest += gz(text)
    }
    return { initial: first, lazy: rest, total: first + rest }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const kb = (bytes: number) => Math.round((bytes / 1024) * 10) / 10

const rows: (Sizes & { name: string })[] = []
for (const item of items) {
  if (!(item.files ?? []).some((file) => CODE.test(file.path))) continue
  const own = await measure(item, true)
  const all = await measure(item, false)
  rows.push({
    name: item.name,
    own: kb(own.total),
    initial: kb(all.initial),
    lazy: kb(all.lazy),
  })
}

const mode = process.argv[2]
const budgets: Budgets = (() => {
  try {
    return JSON.parse(readFileSync(BUDGETS, 'utf8'))
  } catch {
    return {}
  }
})()

if (mode === '--update') {
  const next: Budgets = {}
  for (const row of rows)
    next[row.name] = {
      own: Math.ceil(row.own * 1.1 + 0.5),
      initial: Math.ceil(row.initial * 1.1 + 0.5),
    }
  writeFileSync(BUDGETS, `${JSON.stringify(next, null, 2)}\n`)
  publishSizes(rows)
}

/** One sentence per item's docs, so `shadcn add` tells buyers the cost. */
function publishSizes(measured: typeof rows) {
  const bySize = new Map(measured.map((row) => [row.name, row]))
  const SENTENCE = / ?Size: [^.]*\./
  for (const file of REGISTRIES) {
    const path = join(ROOT, file)
    const registry = JSON.parse(readFileSync(path, 'utf8'))
    for (const item of registry.items as (Item & { docs?: string })[]) {
      const row = bySize.get(item.name)
      if (!row) continue
      const whole = (value: number) =>
        value < 1 ? '<1' : String(Math.round(value))
      const lazy =
        row.lazy >= 1 ? `, plus ${whole(row.lazy)} kB loaded on demand` : ''
      const sentence = `Size: about ${whole(row.own)} kB gzipped of its own, ${whole(row.initial)} kB with its dependencies${lazy} (React and Next not counted).`
      const docs = (item.docs ?? '').replace(SENTENCE, '').trim()
      item.docs = docs ? `${docs} ${sentence}` : sentence
    }
    writeFileSync(path, `${JSON.stringify(registry, null, 2)}\n`)
  }
}

const pad = (value: string | number, width: number) =>
  String(value).padStart(width)
console.log(
  `${'item'.padEnd(28)}${pad('own', 9)}${pad('initial', 10)}${pad('lazy', 9)}   kB gzipped`,
)
const over: string[] = []
for (const row of rows) {
  const budget = budgets[row.name]
  const flags: string[] = []
  if (budget && row.own > budget.own) flags.push(`own over ${budget.own}`)
  if (budget && row.initial > budget.initial)
    flags.push(`initial over ${budget.initial}`)
  if (!budget) flags.push('no budget')
  if (flags.length && mode === '--check')
    over.push(`${row.name}: ${flags.join(', ')}`)
  console.log(
    `${row.name.padEnd(28)}${pad(row.own, 9)}${pad(row.initial, 10)}${pad(row.lazy, 9)}${flags.length ? `   ${flags.join(', ')}` : ''}`,
  )
}
if (over.length) {
  console.error(
    `\nOver budget:\n  ${over.join('\n  ')}\nRaise a budget only on purpose: bun scripts/bundle-budgets.ts --update`,
  )
  process.exit(1)
}
