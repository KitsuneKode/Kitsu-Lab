'use client'
import React from 'react'
import { motion } from 'motion/react'

const Intro = ({ name }: { name: string }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: -100 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -100 }}
      transition={{ duration: 1 }}
      className="absolute top-15 flex h-[15vh] w-[25vw] items-center justify-center rounded-lg bg-stone-700"
    >
      <motion.h2
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 1 }}
        className="text-2xl font-bold text-white"
      >
        {name}
      </motion.h2>
    </motion.div>
  )
}

export default Intro
