import { LazyMotion, domAnimation } from 'motion/react'
import * as m from 'motion/react-m'
import { ViewTransition } from 'react'

const Intro = ({ name, slug }: { name: string; slug: string }) => {
  return (
    <LazyMotion features={domAnimation}>
      <m.div
        initial={{ opacity: 0, y: -24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -24 }}
        transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
        className="absolute top-15 flex h-[15vh] w-[min(90vw,25rem)] items-center justify-center rounded-lg bg-stone-700"
      >
        <m.h2
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="font-display text-2xl font-bold tracking-wide text-white"
        >
          <ViewTransition name={`exhibit-${slug}`} share="exhibit-share">
            <span>{name}</span>
          </ViewTransition>
        </m.h2>
      </m.div>
    </LazyMotion>
  )
}

export default Intro
