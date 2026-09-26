/**
 * The social card shared by the site and every exhibit: a plain dark card
 * with the page name, one line of description and the site mark. Kept
 * free of web fonts so it renders the same everywhere.
 */
export const OG_SIZE = { width: 1200, height: 630 }

export function OgCard({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string
  title: string
  description: string
}) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 72,
        background: '#18181b',
        color: '#fafafa',
        fontFamily: 'sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          fontSize: 26,
          letterSpacing: 8,
          textTransform: 'uppercase',
          color: '#a1a1aa',
        }}
      >
        {eyebrow}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div
          style={{
            display: 'flex',
            fontSize: 76,
            fontWeight: 700,
            lineHeight: 1.05,
          }}
        >
          {title}
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 32,
            color: '#d4d4d8',
            lineHeight: 1.35,
          }}
        >
          {description}
        </div>
      </div>
      <div style={{ display: 'flex', fontSize: 26, color: '#a1a1aa' }}>
        kitsu-lab · npx shadcn add @kitsu/…
      </div>
    </div>
  )
}
