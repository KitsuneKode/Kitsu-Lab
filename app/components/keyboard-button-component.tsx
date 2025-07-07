'use client'
import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'

const KeyBoardButtonComponent = () => {
  const [isPressed, setIsPressed] = useState(false)
  // const [isBroken, setIsBroken] = useState(false)

  const audio = useRef<HTMLAudioElement>(null)

  let pressTimeout: NodeJS.Timeout

  const handleMouseDown = () => {
    pressTimeout = setTimeout(() => {
      // setIsBroken(true)
    }, 1000) // long press threshold 1s
    setIsPressed(true)
    audio.current?.play()
  }

  const handleMouseUp = () => {
    clearTimeout(pressTimeout)
    setIsPressed(false)
  }

  return (
    <AnimatePresence>
      <div
        className="relative flex h-40 w-40 scale-200 items-center justify-center"
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
