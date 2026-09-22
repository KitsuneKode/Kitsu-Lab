'use client'

import * as m from 'motion/react-m'
import { IconArrowDown } from '@tabler/icons-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AnimatePresence,
  LazyMotion,
  domAnimation,
  useReducedMotion,
} from 'motion/react'

const SPRING_PRESS = { type: 'spring', stiffness: 300, damping: 10 } as const
const SPRING_RELEASE = { type: 'spring', stiffness: 100, damping: 20 } as const

/** A tactile keycap — flies in on mount, depresses on press with a click
    sound, and shows a "Press" hint that returns after a few idle seconds. */
export function KeyboardButton() {
  const [isPressed, setIsPressed] = useState(false)
  const [idle, setIdle] = useState(true)
  const audio = useRef<HTMLAudioElement>(null)
  const idleTimeout = useRef<ReturnType<typeof setTimeout>>(null)
  const reducedMotion = useReducedMotion()

  // `false` initial mounts in place — no 100vh entrance flight under
  // reduced-motion.
  const mount = reducedMotion ? false : undefined

  const clearIdle = useCallback(() => {
    if (idleTimeout.current) {
      clearTimeout(idleTimeout.current)
      idleTimeout.current = null
    }
  }, [])

  const handlePress = useCallback(() => {
    clearIdle()
    setIdle(false)
    setIsPressed(true)
    // Lazily created inside the press so autoplay policy is satisfied by the
    // gesture; rewinding lets rapid presses retrigger the click.
    audio.current ??= new Audio('/key_press/click.mp3')
    audio.current.currentTime = 0
    void audio.current.play().catch(() => {})
    idleTimeout.current = setTimeout(() => setIdle(true), 3000)
  }, [clearIdle])

  const handleRelease = useCallback(() => setIsPressed(false), [])

  useEffect(() => clearIdle, [clearIdle])

  return (
    <LazyMotion features={domAnimation}>
      <button
        type="button"
        className="focus-visible:ring-ring/60 relative flex size-40 scale-125 items-center justify-center outline-none select-none focus-visible:ring-2 sm:scale-200"
        aria-label="Press the ALT key"
        onPointerDown={handlePress}
        onPointerUp={handleRelease}
        onPointerCancel={handleRelease}
        onPointerLeave={handleRelease}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            if (!event.repeat) handlePress()
          }
        }}
        onKeyUp={(event) => {
          if (event.key === 'Enter' || event.key === ' ') handleRelease()
        }}
      >
        <m.img
          src="/key_press/base.svg"
          alt=""
          initial={mount ?? { y: '100vh' }}
          animate={{ y: 0 }}
          transition={SPRING_RELEASE}
          className="absolute h-full w-full"
        />
        <m.img
          src="/key_press/cover.svg"
          alt=""
          initial={mount ?? { x: '-100vw' }}
          animate={{ x: 0 }}
          transition={SPRING_RELEASE}
          className="absolute z-50 h-full w-full"
        />
        <m.img
          src="/key_press/button.svg"
          alt=""
          initial={mount ?? { y: '-100vh' }}
          animate={{ y: isPressed ? 14 : 0 }}
          transition={isPressed ? SPRING_PRESS : SPRING_RELEASE}
          className="absolute h-full w-full"
        />
        <m.p
          initial={mount ?? { y: '-100vh', rotateX: 0, rotateZ: 0 }}
          animate={{
            y: isPressed ? 14 : 0,
            rotateX: 52.3,
            rotateZ: 29,
            translateY: -32,
            translateX: -1,
          }}
          transition={isPressed ? SPRING_PRESS : SPRING_RELEASE}
          className="absolute top-1/2 left-1/2 z-50 flex h-full w-full -translate-x-1/2 -translate-y-1/2 transform items-center justify-center text-center text-xl"
        >
          ALT
        </m.p>
        <AnimatePresence>
          {idle && (
            <m.div
              aria-hidden
              initial={{ opacity: 0, x: 0, y: 0 }}
              animate={{ opacity: 1, x: -5, y: -110 }}
              transition={{ duration: 1, ease: 'easeInOut' }}
              exit={{ opacity: 0, x: 0, y: 0 }}
              className="absolute top-1/2 left-1/2 z-50 flex h-full w-full -translate-x-1/2 -translate-y-1/2 transform flex-col items-center justify-center text-center text-xl"
            >
              Press{' '}
              <m.span
                initial={{ y: 0 }}
                animate={reducedMotion ? { y: 10 } : { y: [0, 10] }}
                exit={{ y: 0 }}
                transition={
                  reducedMotion
                    ? { duration: 0.3 }
                    : { repeat: Infinity, repeatType: 'mirror', duration: 0.8 }
                }
              >
                <IconArrowDown />
              </m.span>
            </m.div>
          )}
        </AnimatePresence>
      </button>
    </LazyMotion>
  )
}
