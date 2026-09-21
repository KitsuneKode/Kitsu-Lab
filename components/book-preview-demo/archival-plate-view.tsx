"use client"

import type { Ref } from "react"
import type { ArchivalPlate } from "./archival-bird-data"
import type { ArchivalFilterMode } from "./archival-filter-mode"

type ArchivalPlateViewProps = {
  plate: ArchivalPlate
  isLeftPage?: boolean
  filterMode?: ArchivalFilterMode
  className?: string
  style?: React.CSSProperties
  ref?: Ref<HTMLDivElement>
}

type ArchivalStyle = {
  paperBg: string
  textColor: string
  subTextColor: string
  headingColor: string
  accentColor: string
  /** Literal class -- Tailwind only emits utilities it can see as plain text,
      so this cannot be composed from accentColor at runtime. */
  dropCap: string
  ruleBorder: string
  metricSurface: string
  plateBorder: string
  plateGlow: string
  spineGutter: string
  halftone: string
}

// The plate owns its own colour completely. It must never use Tailwind `dark:`
// variants: the paper is a hardcoded cream, so a `dark:` text colour would win
// from the app theme and paint near-white type onto near-white paper.
const FILTER_STYLES: Record<ArchivalFilterMode, (isLeftPage: boolean) => ArchivalStyle> = {
  aged: (isLeftPage) => ({
    paperBg: "bg-[#F5EBD7]",
    textColor: "text-[#2D231E]",
    subTextColor: "text-[#6E5D4F]",
    headingColor: "text-[#1F1813]",
    accentColor: "text-[#8A4B0F]",
    dropCap: "first-letter:text-[#8A4B0F]",
    ruleBorder: "border-[#C3AE8C]",
    metricSurface: "bg-[#EADFC6] border-[#D3C2A2]",
    plateBorder: "border-[#C8B896]",
    plateGlow: "bg-[#F9F3E5]",
    spineGutter: isLeftPage
      ? "bg-gradient-to-l from-transparent via-[rgba(60,40,25,0.08)] to-[rgba(40,25,15,0.22)]"
      : "bg-gradient-to-r from-[rgba(40,25,15,0.22)] via-[rgba(60,40,25,0.08)] to-transparent",
    halftone: "radial-gradient(circle, rgba(0,0,0,0.03) 1px, transparent 1px)",
  }),
  museum: (isLeftPage) => ({
    paperBg: "bg-[#FCFCFA]",
    textColor: "text-[#18181B]",
    subTextColor: "text-[#52525B]",
    headingColor: "text-[#09090B]",
    accentColor: "text-[#9A5B08]",
    dropCap: "first-letter:text-[#9A5B08]",
    ruleBorder: "border-[#DCDCD8]",
    metricSurface: "bg-[#F4F4F2] border-[#E2E2DE]",
    plateBorder: "border-[#D4D4D8]",
    plateGlow: "bg-white",
    spineGutter: isLeftPage
      ? "bg-gradient-to-l from-transparent to-[rgba(0,0,0,0.12)]"
      : "bg-gradient-to-r from-[rgba(0,0,0,0.12)] to-transparent",
    halftone: "radial-gradient(circle, rgba(0,0,0,0.03) 1px, transparent 1px)",
  }),
  night: (isLeftPage) => ({
    paperBg: "bg-[#151518]",
    textColor: "text-[#E4E4E7]",
    subTextColor: "text-[#A1A1AA]",
    headingColor: "text-[#FAFAFA]",
    accentColor: "text-[#FBBF24]",
    dropCap: "first-letter:text-[#FBBF24]",
    ruleBorder: "border-[#33333B]",
    metricSurface: "bg-[#1E1E24] border-[#33333B]",
    plateBorder: "border-[#3F3F46]",
    plateGlow: "bg-[#1C1C22]",
    spineGutter: isLeftPage
      ? "bg-gradient-to-l from-transparent to-[rgba(0,0,0,0.4)]"
      : "bg-gradient-to-r from-[rgba(0,0,0,0.4)] to-transparent",
    halftone: "radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)",
  }),
}

const PLATE_SURFACE_STYLE: React.CSSProperties = {
  fontFamily: 'Charter, "New York", Georgia, serif',
  backfaceVisibility: "hidden",
  WebkitBackfaceVisibility: "hidden",
  transform: "translateZ(0)",
}

export function ArchivalPlateView({
  plate,
  isLeftPage = false,
  filterMode = "aged",
  className = "",
  style,
  ref,
}: ArchivalPlateViewProps) {
  const theme = FILTER_STYLES[filterMode](isLeftPage)

  if (plate.isCover) {
    return (
      <ArchivalCoverPlate plate={plate} className={className} style={style} ref={ref} />
    )
  }
  if (plate.plateType === "plate") {
    return (
      <ArchivalArtPlate
        plate={plate}
        isLeftPage={isLeftPage}
        theme={theme}
        className={className}
        style={style}
        ref={ref}
      />
    )
  }
  return (
    <ArchivalTextPlate
      plate={plate}
      isLeftPage={isLeftPage}
      theme={theme}
      className={className}
      style={style}
      ref={ref}
    />
  )
}

type ArchivalCoverPlateProps = {
  plate: ArchivalPlate
  className: string
  style?: React.CSSProperties
  ref?: Ref<HTMLDivElement>
}

function ArchivalCoverPlate({ plate, className, style, ref }: ArchivalCoverPlateProps) {
  return (
    <div
      ref={ref}
      data-density="hard"
      className={`relative flex h-full w-full flex-col justify-between overflow-hidden border-4 border-[#142419] bg-[#1B3022] p-6 text-[#F3E5AB] shadow-2xl select-none sm:p-8 ${className}`}
      style={{
        ...PLATE_SURFACE_STYLE,
        ...style,
        backgroundImage:
          "radial-gradient(circle at 50% 30%, rgba(255,255,255,0.07) 0%, transparent 70%), linear-gradient(135deg, rgba(0,0,0,0.3) 0%, transparent 100%)",
      }}
    >
      {/* Ornate gold stamped foil frame */}
      <div className="relative flex h-full w-full flex-col items-center justify-between rounded border-2 border-[#D4AF37] p-5 text-center shadow-[inset_0_0_15px_rgba(0,0,0,0.5)]">
        <div className="mt-1 font-sans text-[10px] font-semibold tracking-[0.35em] text-[#D4AF37] uppercase opacity-90">
          Standard Edition • Anno 1915
        </div>

        <div className="my-auto flex flex-col items-center gap-y-3">
          {/* Embossed eagle and bough motif */}
          <div className="my-2 h-24 w-24 text-[#D4AF37] drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] sm:h-28 sm:w-28">
            <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" className="h-full w-full stroke-[1.4]">
              <circle cx="50" cy="50" r="46" strokeDasharray="3 2" />
              <circle cx="50" cy="50" r="41" />
              <path
                d="M30,62 C34,50 42,42 52,38 C58,35 68,36 74,40 C70,44 65,46 62,48 C55,52 48,58 40,65 Z"
                fill="#D4AF37"
                fillOpacity="0.4"
              />
              <path d="M52,38 C54,32 60,26 68,26 C64,30 62,34 62,38" />
              <line x1="20" y1="68" x2="80" y2="68" strokeWidth="2" />
              <ellipse cx="28" cy="65" rx="5" ry="2" transform="rotate(-20 28 65)" fill="#D4AF37" fillOpacity="0.6" />
              <ellipse cx="38" cy="71" rx="6" ry="2.5" transform="rotate(15 38 71)" fill="#D4AF37" fillOpacity="0.6" />
              <ellipse cx="70" cy="65" rx="6" ry="2.5" transform="rotate(25 70 65)" fill="#D4AF37" fillOpacity="0.6" />
            </svg>
          </div>

          <h1 className="max-w-[280px] font-serif text-2xl leading-tight font-bold tracking-wider text-[#F9E8B2] uppercase drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)] sm:text-3xl md:text-4xl">
            {plate.commonName}
          </h1>

          <div className="my-1 h-[1.5px] w-20 bg-[#D4AF37] opacity-80" />

          <p className="max-w-[260px] font-serif text-xs leading-snug text-[#E5D298] italic sm:text-sm">
            {plate.scientificName}
          </p>

          <p className="pt-2 font-sans text-[11px] tracking-widest text-[#C8B27A] uppercase">
            By Chester A. Reed, B.S.
          </p>
        </div>

        <div className="mb-1 font-mono text-[9px] tracking-[0.25em] text-[#D4AF37] uppercase opacity-80">
          Doubleday, Page & Company • New York
        </div>
      </div>
    </div>
  )
}

type ArchivalThemePlateProps = ArchivalCoverPlateProps & {
  isLeftPage: boolean
  theme: ArchivalStyle
}

const PLATE_ILLUSTRATIONS: Partial<
  Record<ArchivalPlate["svgType"], () => React.JSX.Element>
> = {
  "scarlet-tanager": ScarletTanagerSvg,
  bluebird: EasternBluebirdSvg,
  "snowy-owl": SnowyOwlSvg,
  hummingbird: HummingbirdSvg,
}

function PlateIllustration({ type }: { type: ArchivalPlate["svgType"] }) {
  const Illustration = PLATE_ILLUSTRATIONS[type]
  return Illustration ? <Illustration /> : null
}

function ArchivalArtPlate({
  plate,
  isLeftPage,
  theme,
  className,
  style,
  ref,
}: ArchivalThemePlateProps) {
  return (
    <div
      ref={ref}
      data-density="soft"
      className={`relative flex h-full w-full flex-col justify-between overflow-hidden p-5 shadow-xl transition-colors duration-200 ease-out select-none sm:p-7 ${theme.paperBg} ${theme.textColor} ${className}`}
      style={{ ...PLATE_SURFACE_STYLE, ...style }}
    >
      {/* Spine gutter crease shadow */}
      <div
        className={`pointer-events-none absolute inset-y-0 z-20 ${isLeftPage ? "right-0 w-8" : "left-0 w-8"} ${theme.spineGutter}`}
      />

      {/* Top folio header */}
      <div
        className={`flex items-center justify-between border-b pb-1.5 font-sans text-[11px] font-medium tracking-widest uppercase ${theme.ruleBorder} ${theme.subTextColor}`}
      >
        <span>{isLeftPage ? `Page ${plate.pageNumber}` : plate.order || "Plate Specimen"}</span>
        <span className="font-serif tracking-normal normal-case italic">{plate.family}</span>
        <span>{isLeftPage ? plate.order : `Page ${plate.pageNumber}`}</span>
      </div>

      {/* Tipped-in colour lithograph */}
      <div
        className={`relative my-auto flex flex-col items-center justify-center overflow-hidden rounded border p-3 shadow-md ${theme.plateBorder} ${theme.plateGlow}`}
      >
        <div
          className="relative flex h-[260px] w-full items-center justify-center overflow-hidden rounded sm:h-[300px]"
          style={{ backgroundImage: theme.halftone, backgroundSize: "8px 8px" }}
        >
          <PlateIllustration type={plate.svgType} />
        </div>

        {/* Plate title caption */}
        <div className="mt-3 space-y-1 text-center">
          <h3 className={`font-serif text-sm font-bold tracking-wide sm:text-base ${theme.headingColor}`}>
            {plate.commonName}
          </h3>
          <p className={`font-serif text-xs italic ${theme.subTextColor}`}>
            {plate.scientificName}
          </p>
        </div>
      </div>

      {/* Plate legend / sub-figures */}
      <div className={`border-t pt-2 font-sans text-[10px] leading-relaxed ${theme.ruleBorder} ${theme.subTextColor}`}>
        <div className="flex flex-col gap-0.5">
          {plate.description.map((item) => (
            <span key={item} className="line-clamp-1">
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function ArchivalTextPlate({
  plate,
  isLeftPage,
  theme,
  className,
  style,
  ref,
}: ArchivalThemePlateProps) {
  return (
    <div
      ref={ref}
      data-density="soft"
      className={`relative flex h-full w-full flex-col justify-between overflow-hidden p-6 shadow-xl transition-colors duration-200 ease-out select-none sm:p-8 ${theme.paperBg} ${theme.textColor} ${className}`}
      style={{ ...PLATE_SURFACE_STYLE, ...style }}
    >
      {/* Spine gutter crease shadow */}
      <div
        className={`pointer-events-none absolute inset-y-0 z-20 ${isLeftPage ? "right-0 w-8" : "left-0 w-8"} ${theme.spineGutter}`}
      />

      {/* Top folio header */}
      <div
        className={`flex items-center justify-between border-b pb-1.5 font-sans text-[11px] font-medium tracking-widest uppercase ${theme.ruleBorder} ${theme.subTextColor}`}
      >
        <span>{isLeftPage ? `Page ${plate.pageNumber}` : plate.order || "Field Notes"}</span>
        <span className="font-serif tracking-normal normal-case italic">{plate.family}</span>
        <span>{isLeftPage ? plate.order : `Page ${plate.pageNumber}`}</span>
      </div>

      {/* Article body */}
      <div className="my-auto space-y-3">
        {plate.isIndex ? (
          <div className="space-y-4 py-4 text-center">
            <div className={`font-sans text-xs tracking-[0.25em] uppercase ${theme.subTextColor}`}>
              Archive.org Edition Facsimile
            </div>
            <h2 className={`font-serif text-xl font-bold ${theme.headingColor}`}>
              {plate.commonName}
            </h2>
            <div className={`mx-auto h-px w-12 border-t ${theme.ruleBorder}`} />
            <div className={`mx-auto max-w-sm space-y-2 text-left text-xs leading-relaxed ${theme.textColor}`}>
              {plate.description.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Headings */}
            <div className={`border-b pb-2 ${theme.ruleBorder}`}>
              <span className={`block font-sans text-[10px] font-semibold tracking-widest uppercase ${theme.accentColor}`}>
                {plate.order}
              </span>
              <h2 className={`font-serif text-lg leading-tight font-bold sm:text-xl ${theme.headingColor}`}>
                {plate.commonName}
              </h2>
              <div className={`mt-0.5 font-serif text-xs italic ${theme.subTextColor}`}>
                {plate.scientificName}
              </div>
            </div>

            {/* Natural history vital metrics */}
            {(plate.length || plate.nestNotes || plate.eggCount) && (
              <div className={`space-y-1 rounded border p-2.5 font-sans text-[11px] ${theme.metricSurface}`}>
                {plate.length ? (
                  <div>
                    <span className={`font-semibold ${theme.headingColor}`}>Length: </span>
                    <span className={theme.subTextColor}>{plate.length}</span>
                  </div>
                ) : null}
                {plate.nestNotes ? (
                  <div>
                    <span className={`font-semibold ${theme.headingColor}`}>Nest: </span>
                    <span className={theme.subTextColor}>{plate.nestNotes}</span>
                  </div>
                ) : null}
                {plate.eggCount ? (
                  <div>
                    <span className={`font-semibold ${theme.headingColor}`}>Eggs: </span>
                    <span className={theme.subTextColor}>{plate.eggCount}</span>
                  </div>
                ) : null}
              </div>
            )}

            {/* Body text with drop cap on the first paragraph */}
            <div className={`space-y-2 text-justify text-xs leading-relaxed sm:text-[13px] ${theme.textColor}`}>
              {plate.description.map((paragraph, index) => (
                <p
                  key={paragraph}
                  className={
                    index === 0
                      ? `font-serif first-letter:float-left first-letter:mr-2 first-letter:text-3xl first-letter:leading-none first-letter:font-bold ${theme.dropCap}`
                      : "indent-3 font-serif"
                  }
                >
                  {paragraph}
                </p>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Bottom folio footer */}
      <div className={`flex items-center justify-between border-t pt-1.5 font-mono text-[10px] ${theme.ruleBorder} ${theme.subTextColor}`}>
        <span>Chester A. Reed (1915)</span>
        <span>Folio {plate.pageNumber}</span>
      </div>
    </div>
  )
}

// ==========================================
// VINTAGE HAND-CRAFTED BIRD LITHOGRAPH SVGS
// ==========================================

function ScarletTanagerSvg() {
  return (
    <svg viewBox="0 0 320 280" className="w-full h-full max-w-[280px] drop-shadow-md">
      <defs>
        <radialGradient id="tanagerBody" cx="45%" cy="40%" r="55%">
          <stop offset="0%" stopColor="#FF3823" />
          <stop offset="60%" stopColor="#D92010" />
          <stop offset="100%" stopColor="#8A0C00" />
        </radialGradient>
        <linearGradient id="tanagerWing" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#222" />
          <stop offset="70%" stopColor="#111" />
          <stop offset="100%" stopColor="#050505" />
        </linearGradient>
        <linearGradient id="barkGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#6E543C" />
          <stop offset="100%" stopColor="#3E2B1E" />
        </linearGradient>
      </defs>

      {/* Oak Branch with moss & bark texture */}
      <path
        d="M20,210 C70,205 130,208 190,195 C250,182 290,170 310,165"
        stroke="url(#barkGrad)"
        strokeWidth="14"
        strokeLinecap="round"
      />
      <path
        d="M140,205 C160,225 180,245 195,260"
        stroke="url(#barkGrad)"
        strokeWidth="6"
        strokeLinecap="round"
      />
      {/* Oak Leaves with spring olive tones */}
      <path d="M70,195 C60,175 75,160 90,170 C100,165 110,180 100,195 Z" fill="#607038" opacity="0.85" />
      <path d="M220,175 C235,155 255,160 250,180 C265,185 250,200 235,190 Z" fill="#506228" opacity="0.85" />

      {/* Bird Legs & Talons gripping the branch */}
      <path d="M152,185 L148,206 M148,206 L140,208 M148,206 L155,208" stroke="#4A3B32" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M168,183 L166,204 M166,204 L160,206 M166,204 L172,206" stroke="#4A3B32" strokeWidth="2.5" strokeLinecap="round" />

      {/* Scarlet Tanager Torso & Breast */}
      <path
        d="M130,115 C135,80 165,65 185,80 C205,95 210,140 190,185 C175,195 140,190 130,160 Z"
        fill="url(#tanagerBody)"
      />

      {/* Jet Black Primary Wing */}
      <path
        d="M148,110 C140,130 135,170 120,225 C130,222 150,190 165,165 C170,140 170,115 148,110 Z"
        fill="url(#tanagerWing)"
      />

      {/* Jet Black Forked Tail */}
      <path
        d="M125,190 L95,245 L108,248 L135,200 Z"
        fill="#111"
      />

      {/* Head, Beak, and Bright Eye */}
      <circle cx="180" cy="85" r="3.5" fill="#111" />
      <circle cx="181" cy="84" r="1" fill="#FFF" />
      {/* Ivory Finch-like conical bill */}
      <path d="M192,85 L210,90 L192,96 Z" fill="#D9C9A5" stroke="#9E8D6B" strokeWidth="1" />

      {/* Egg Inset Miniature */}
      <g transform="translate(230, 40) scale(0.7)">
        <rect x="-10" y="-10" width="70" height="90" rx="4" fill="#FAF6ED" stroke="#D1C2A5" strokeWidth="1" />
        <ellipse cx="25" cy="35" rx="18" ry="24" fill="#88B89E" stroke="#5D856F" strokeWidth="1" />
        {/* Rufous freckling on egg */}
        <circle cx="20" cy="25" r="1.5" fill="#8B4513" opacity="0.6" />
        <circle cx="28" cy="22" r="2" fill="#8B4513" opacity="0.7" />
        <circle cx="32" cy="30" r="1" fill="#8B4513" opacity="0.5" />
        <circle cx="24" cy="38" r="1.5" fill="#8B4513" opacity="0.6" />
        <text x="25" y="72" textAnchor="middle" fontSize="9" fontFamily="serif" fill="#5D4B3E">Egg (Natural)</text>
      </g>
    </svg>
  );
}

function EasternBluebirdSvg() {
  return (
    <svg viewBox="0 0 320 280" className="w-full h-full max-w-[280px] drop-shadow-md">
      <defs>
        <radialGradient id="bluebirdUpper" cx="45%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#3B82F6" />
          <stop offset="55%" stopColor="#1D4ED8" />
          <stop offset="100%" stopColor="#1E3A8A" />
        </radialGradient>
        <linearGradient id="cinnamonChest" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#EA580C" />
          <stop offset="60%" stopColor="#C2410C" />
          <stop offset="100%" stopColor="#9A3412" />
        </linearGradient>
      </defs>

      {/* Lichen-covered Fence Post */}
      <path d="M120,240 L120,170 C120,165 140,160 160,160 C180,160 200,165 200,170 L200,240 Z" fill="#6B7280" opacity="0.7" stroke="#4B5563" strokeWidth="2" />
      <ellipse cx="160" cy="165" rx="38" ry="10" fill="#9CA3AF" />

      {/* Apple Blossom sprigs */}
      <circle cx="85" cy="140" r="8" fill="#FCE7F3" stroke="#F472B6" strokeWidth="0.8" />
      <circle cx="95" cy="150" r="7" fill="#FCE7F3" stroke="#F472B6" strokeWidth="0.8" />
      <circle cx="75" cy="152" r="7" fill="#FCE7F3" stroke="#F472B6" strokeWidth="0.8" />
      <circle cx="85" cy="147" r="3" fill="#F59E0B" />

      {/* Legs on post */}
      <path d="M150,165 L150,175 M150,175 L144,177 M150,175 L156,177" stroke="#374151" strokeWidth="2.5" />
      <path d="M165,165 L165,175 M165,175 L159,177 M165,175 L171,177" stroke="#374151" strokeWidth="2.5" />

      {/* Bluebird Back & Wings (Cobalt Blue) */}
      <path
        d="M135,90 C145,65 175,65 185,85 C195,110 185,155 170,168 C150,172 130,140 135,90 Z"
        fill="url(#bluebirdUpper)"
      />

      {/* Rich Cinnamon-Chestnut Breast */}
      <path
        d="M165,100 C178,115 180,140 172,158 C160,165 152,160 152,145 C152,125 160,105 165,100 Z"
        fill="url(#cinnamonChest)"
      />

      {/* White Belly */}
      <path d="M155,152 C162,154 165,162 158,168 C152,166 150,158 155,152 Z" fill="#F9FAFB" />

      {/* Slender Bill & Dark Eye */}
      <circle cx="178" cy="80" r="3" fill="#111" />
      <circle cx="179" cy="79" r="0.8" fill="#FFF" />
      <path d="M186,81 L200,85 L186,88 Z" fill="#1F2937" />

      {/* Sky Blue Egg Inset */}
      <g transform="translate(230, 40) scale(0.7)">
        <rect x="-10" y="-10" width="70" height="90" rx="4" fill="#FAF6ED" stroke="#D1C2A5" strokeWidth="1" />
        <ellipse cx="25" cy="35" rx="17" ry="23" fill="#93C5FD" stroke="#60A5FA" strokeWidth="1" />
        <text x="25" y="72" textAnchor="middle" fontSize="9" fontFamily="serif" fill="#5D4B3E">Egg (Sky-blue)</text>
      </g>
    </svg>
  );
}

function SnowyOwlSvg() {
  return (
    <svg viewBox="0 0 320 280" className="w-full h-full max-w-[280px] drop-shadow-md">
      <defs>
        <radialGradient id="owlIvory" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="70%" stopColor="#F3F4F6" />
          <stop offset="100%" stopColor="#E5E7EB" />
        </radialGradient>
      </defs>

      {/* Coastal Tundra Driftwood */}
      <path d="M40,225 C120,215 200,220 280,230 L275,250 C195,240 115,245 45,255 Z" fill="#52525B" stroke="#3F3F46" strokeWidth="2" />

      {/* Snowy Owl Grand Body Silhouette */}
      <path
        d="M125,95 C125,50 195,50 195,95 C205,150 195,215 160,225 C125,215 115,150 125,95 Z"
        fill="url(#owlIvory)"
        stroke="#D1D5DB"
        strokeWidth="1.5"
      />

      {/* Characteristic Dark Brown Barring of Female Plumage */}
      <path d="M135,130 Q160,135 185,130 M132,145 Q160,150 188,145 M136,160 Q160,165 184,160 M140,175 Q160,180 180,175 M144,190 Q160,195 176,190" stroke="#4A3E38" strokeWidth="2.5" strokeLinecap="round" fill="none" />

      {/* Deep Amber Cat-like Eyes */}
      <circle cx="146" cy="88" r="8" fill="#F59E0B" stroke="#B45309" strokeWidth="1" />
      <circle cx="146" cy="88" r="4.5" fill="#111" />
      <circle cx="148" cy="86" r="1.5" fill="#FFF" />

      <circle cx="174" cy="88" r="8" fill="#F59E0B" stroke="#B45309" strokeWidth="1" />
      <circle cx="174" cy="88" r="4.5" fill="#111" />
      <circle cx="176" cy="86" r="1.5" fill="#FFF" />

      {/* Hooked Black Beak partially veiled by white facial ruff */}
      <path d="M157,92 L163,92 L160,105 Z" fill="#18181B" />

      {/* Feathered Downy Talons */}
      <ellipse cx="145" cy="225" rx="12" ry="6" fill="#F9FAFB" stroke="#D1D5DB" />
      <ellipse cx="175" cy="225" rx="12" ry="6" fill="#F9FAFB" stroke="#D1D5DB" />

      {/* Pure White Egg Inset */}
      <g transform="translate(230, 40) scale(0.7)">
        <rect x="-10" y="-10" width="70" height="90" rx="4" fill="#FAF6ED" stroke="#D1C2A5" strokeWidth="1" />
        <ellipse cx="25" cy="35" rx="20" ry="25" fill="#FFFFFF" stroke="#D1D5DB" strokeWidth="1.2" />
        <text x="25" y="72" textAnchor="middle" fontSize="9" fontFamily="serif" fill="#5D4B3E">Egg (Chalky)</text>
      </g>
    </svg>
  );
}

function HummingbirdSvg() {
  return (
    <svg viewBox="0 0 320 280" className="w-full h-full max-w-[280px] drop-shadow-md">
      <defs>
        <linearGradient id="emeraldIridescent" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#34D399" />
          <stop offset="50%" stopColor="#059669" />
          <stop offset="100%" stopColor="#065F46" />
        </linearGradient>
        <radialGradient id="rubyGorget" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FF0055" />
          <stop offset="70%" stopColor="#DC2626" />
          <stop offset="100%" stopColor="#7F1D1D" />
        </radialGradient>
      </defs>

      {/* Trumpet Vine (Campsis radicans) Blossom */}
      <path d="M50,70 Q100,100 130,135 Q100,140 70,110 Z" fill="#EA580C" stroke="#C2410C" strokeWidth="1.5" />
      <path d="M30,55 Q50,70 70,80" stroke="#65A30D" strokeWidth="4" strokeLinecap="round" />

      {/* Blurred Wings in 70Hz Motion (Semi-transparent fan) */}
      <ellipse cx="195" cy="115" rx="45" ry="12" transform="rotate(-35 195 115)" fill="#94A3B8" opacity="0.35" />
      <ellipse cx="185" cy="105" rx="48" ry="10" transform="rotate(-45 185 105)" fill="#64748B" opacity="0.5" />

      {/* Emerald Green Hummingbird Body */}
      <path
        d="M170,120 C185,115 215,130 220,150 C210,165 180,160 165,145 Z"
        fill="url(#emeraldIridescent)"
      />

      {/* Flaming Ruby Gorget on Throat */}
      <path
        d="M155,130 C160,126 168,128 170,136 C165,142 155,140 155,130 Z"
        fill="url(#rubyGorget)"
      />

      {/* Needle-like Long Black Bill sipping flower nectar */}
      <line x1="125" y1="135" x2="155" y2="131" stroke="#111" strokeWidth="2" strokeLinecap="round" />

      {/* Miniature Nest Inset */}
      <g transform="translate(230, 40) scale(0.7)">
        <rect x="-10" y="-10" width="70" height="90" rx="4" fill="#FAF6ED" stroke="#D1C2A5" strokeWidth="1" />
        {/* Lichen cup */}
        <path d="M10,42 Q25,60 40,42 Z" fill="#6B7280" stroke="#4B5563" strokeWidth="1" />
        {/* 2 tiny white eggs */}
        <ellipse cx="21" cy="38" rx="4.5" ry="6" fill="#FFF" stroke="#E5E7EB" />
        <ellipse cx="29" cy="39" rx="4.5" ry="6" fill="#FFF" stroke="#E5E7EB" />
        <text x="25" y="72" textAnchor="middle" fontSize="9" fontFamily="serif" fill="#5D4B3E">Lichen Nest</text>
      </g>
    </svg>
  );
}
