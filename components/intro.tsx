'use client'
import React from 'react'
import { LazyMotion, domAnimation } from 'motion/react'
import * as m from 'motion/react-m'

const Intro = ({ name }: { name: string }) => {
  return (
    <LazyMotion features={domAnimation}>
      <m.div
        initial={{ opacity: 0, y: -100 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -100 }}
        transition={{ duration: 1 }}
        className="absolute top-15 flex h-[15vh] w-[min(90vw,25rem)] items-center justify-center rounded-lg bg-stone-700"
      >
        <m.h2
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1 }}
          className="text-2xl font-bold text-white"
        >
          {name}
        </m.h2>
      </m.div>
    </LazyMotion>
  )
}

export default Intro
