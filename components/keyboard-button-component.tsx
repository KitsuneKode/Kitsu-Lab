'use client'
import { LucideArrowDown } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'

const KeyBoardButtonComponent = () => {
  const [isPressed, setIsPressed] = useState(false)
  // const [isBroken, setIsBroken] = useState(false)
  const [idle, setIdle] = useState(true)
  const audio = useRef<HTMLAudioElement>(null)

  const pressTimeout = useRef<NodeJS.Timeout>(null)
  const idleTimeout = useRef<NodeJS.Timeout>(null)

  const clearTimeouts = useCallback(() => {
    if (pressTimeout.current) {
      clearTimeout(pressTimeout.current)
      pressTimeout.current = null
    }
    if (idleTimeout.current) {
      clearTimeout(idleTimeout.current)
      idleTimeout.current = null
    }
  }, [])

  const handleMouseDown = useCallback(() => {
    clearTimeouts()

    // pressTimeout.current = setTimeout(() => {
    //   // setIsBroken(true)
    // }, 1000) // long press threshold 1s
    setIdle(false)
    setIsPressed(true)
    audio.current?.play()
    idleTimeout.current = setTimeout(() => setIdle(true), 3000)
  }, [clearTimeouts])

  const handleMouseUp = () => {
    //   clearTimeout(pressTimeout.current)
    //   pressTimeout.current = null
    // }
    setIsPressed(false)
  }

  useEffect(() => {
    return () => {
      clearTimeouts()
    }
  }, [clearTimeouts])

  return (
    <AnimatePresence>
      <div
        className="relative mt-20 flex h-40 w-40 translate-y-25 scale-200 items-center justify-center"
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleMouseDown}
        onTouchEnd={handleMouseUp}
      >
        <motion.img
          src="/key_press/base.svg"
          alt="key base"
          initial={{ y: '100vh' }}
          animate={{ y: 0 }}
          exit={{ y: '100vh' }}
          transition={{
            type: 'spring',
            stiffness: 100,
            damping: 20,
          }}
          className="absolute h-full w-full"
        />

        <>
          <motion.img
            src="/key_press/cover.svg"
            alt="key cover"
            initial={{ x: '-100vw' }}
            animate={{ x: 0 }}
            exit={{ x: '-100vw' }}
            transition={{
              type: 'spring',
              stiffness: 100,
              damping: 20,
            }}
            className="absolute z-50 h-full w-full"
          />

          <motion.img
            src="/key_press/button.svg"
            alt="key"
            initial={{ y: '-100vh' }}
            animate={{ y: isPressed ? 14 : 0 }}
            exit={{ y: '-100vh' }}
            transition={{
              type: 'spring',
              stiffness: isPressed ? 300 : 100,
              damping: isPressed ? 10 : 20,
            }}
            className="absolute h-full w-full"
          ></motion.img>
          <motion.p
            initial={{
              y: '-100vh',
              rotateX: 0,
              rotateZ: 0,
            }}
            animate={{
              y: isPressed ? 14 : 0,
              rotateX: 52.3,
              rotateZ: 29,
              translateY: -32,
              translateX: -1,
            }}
            exit={{
              y: '-100vh',
              rotateX: 0,
              rotateZ: 0,
            }}
            transition={{
              type: 'spring',
              stiffness: isPressed ? 300 : 100,
              damping: isPressed ? 10 : 20,
            }}
            className="absolute top-1/2 left-1/2 z-50 flex h-full w-full -translate-x-1/2 -translate-y-1/2 transform items-center justify-center text-center text-xl"
          >
            ALT
          </motion.p>
          <motion.audio
            ref={audio}
            src="/key_press/click.mp3"
            layoutId="button"
          />
          <AnimatePresence>
            {idle && (
              <motion.div
                initial={{ opacity: 0, x: 0, y: 0 }}
                animate={{ opacity: 1, x: -5, y: -110 }}
                transition={{ duration: 1, ease: 'easeInOut' }}
                exit={{ opacity: 0, x: 0, y: 0 }}
                className="absolute top-1/2 left-1/2 z-50 flex h-full w-full -translate-x-1/2 -translate-y-1/2 transform flex-col items-center justify-center text-center text-xl"
              >
                Press{' '}
                <motion.span
                  initial={{ y: 0 }}
                  animate={{ y: 10 }}
                  exit={{ y: 0 }}
                  transition={{
                    type: 'spring',
                    stiffness: 80,
                    damping: 0,
                    velocity: 8,
                  }}
                >
                  <LucideArrowDown />
                </motion.span>
              </motion.div>
            )}
          </AnimatePresence>
          {/* 
          {isBroken && (
            <motion.img
              src="/key_press/broken.svg"
              alt="broken key"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 120, damping: 15 }}
              className="absolute h-full w-full"
            />
          )} */}
        </>
      </div>
    </AnimatePresence>
  )
}

export default KeyBoardButtonComponent
