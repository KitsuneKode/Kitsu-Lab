import Link from 'next/link'

export default function ExhibitionLoading() {
  return (
    <div className="relative flex min-h-dvh w-full flex-col items-center">
      <div
        className="fixed top-5 left-5 z-50"
        style={{ viewTransitionName: 'exhibit-back' }}
      >
        <Link
          href="/"
          prefetch
          transitionTypes={['nav-back']}
          className="flex items-center gap-2 rounded-full border border-white/10 bg-neutral-900/80 px-4 py-2 text-xs font-medium text-neutral-300 backdrop-blur-xl transition-[background-color,color,scale] hover:scale-105 hover:bg-neutral-800 hover:text-white"
        >
          <span>←</span>
          <span>Back to Lab</span>
        </Link>
      </div>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pt-24 pb-24 sm:pt-20">
        <div className="bg-muted/60 mx-auto h-9 w-56 animate-pulse rounded-lg" />
        <div className="bg-card/60 min-h-[min(22rem,68svh)] w-full animate-pulse rounded-xl border sm:min-h-[min(32rem,74svh)] lg:min-h-[min(40rem,80svh)]" />
        <div className="bg-muted/50 mx-auto h-10 w-72 animate-pulse rounded-lg" />
      </div>
    </div>
  )
}
