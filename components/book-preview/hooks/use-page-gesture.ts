'use client'

import { useCallback, useEffect, useRef } from 'react'
import {
  BOOK_PREVIEW_BOUNDARY_RESISTANCE,
  BOOK_PREVIEW_COMMIT_RATIO,
  BOOK_PREVIEW_EASE_OUT,
  BOOK_PREVIEW_GESTURE_INTENT_PX,
  BOOK_PREVIEW_SETTLE_MS,
  BOOK_PREVIEW_VELOCITY_COMMIT,
  BOOK_PREVIEW_MOMENTUM_MS,
} from '../motion'

type GestureOptions = {
  enabled: boolean
  reducedMotion: boolean
  canGoPrev: boolean
  canGoNext: boolean
  onCommitPrev: () => void
  onCommitNext: () => void
}

type GestureState = {
  pointerId: number | null
  startX: number
  startY: number
  lastX: number
  lastT: number
  velocity: number
  tracking: boolean
  offset: number
  width: number
}

function rubberband(distance: number, limit: number): number {
  if (limit <= 0) return 0
  const resisted = distance * BOOK_PREVIEW_BOUNDARY_RESISTANCE
  return Math.max(-limit, Math.min(limit, resisted))
}

function readOffsetX(node: HTMLElement): number {
  const transform = getComputedStyle(node).transform
  if (!transform || transform === 'none') return 0
  try {
    return new DOMMatrixReadOnly(transform).m41
  } catch {
    return 0
  }
}

export function usePageGesture(options: GestureOptions) {
  const surfaceRef = useRef<HTMLDivElement | null>(null)
  const settleTimerRef = useRef<number | null>(null)
  const settleListenerRef = useRef<{
    node: HTMLElement
    listener: (event: TransitionEvent) => void
  } | null>(null)
  const optionsRef = useRef(options)
  useEffect(() => {
    optionsRef.current = options
  })
  const stateRef = useRef<GestureState>({
    pointerId: null,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastT: 0,
    velocity: 0,
    tracking: false,
    offset: 0,
    width: 1,
  })

  const clearSettle = useCallback(() => {
    if (settleTimerRef.current !== null) {
      window.clearTimeout(settleTimerRef.current)
      settleTimerRef.current = null
    }
    // A cancelled settle must also drop its transitionend listener, or a
    // later unrelated transition can fire the stale commit.
    const pending = settleListenerRef.current
    if (pending) {
      pending.node.removeEventListener('transitionend', pending.listener)
      settleListenerRef.current = null
    }
  }, [])

  const setOffset = useCallback((value: number, immediate = false) => {
    const node = surfaceRef.current
    if (!node) return
    node.style.transform = `translate3d(${value}px, 0, 0)`
    node.style.transition = immediate
      ? 'none'
      : `transform ${BOOK_PREVIEW_SETTLE_MS}ms ${BOOK_PREVIEW_EASE_OUT}`
    stateRef.current.offset = value
  }, [])

  const settleTo = useCallback(
    (target: number, onSettled?: () => void) => {
      clearSettle()
      const node = surfaceRef.current
      if (!node) {
        onSettled?.()
        return
      }
      if (optionsRef.current.reducedMotion) {
        setOffset(0, true)
        onSettled?.()
        return
      }
      setOffset(target, false)

      let finished = false
      const finish = () => {
        if (finished) return
        finished = true
        settleListenerRef.current = null
        node.removeEventListener('transitionend', onTransitionEnd)
        clearSettle()
        if (target !== 0) {
          // Commit the page change first, then re-enter from the opposite
          // edge so the incoming spread keeps traveling in the flick's
          // direction instead of snapping back to center.
          onSettled?.()
          setOffset(-target, true)
          requestAnimationFrame(() => setOffset(0, false))
          return
        }
        onSettled?.()
      }
      const onTransitionEnd = (event: TransitionEvent) => {
        if (event.propertyName === 'transform' && event.target === node)
          finish()
      }
      node.addEventListener('transitionend', onTransitionEnd)
      settleListenerRef.current = { node, listener: onTransitionEnd }
      // transitionend is not guaranteed (hidden tab, detached node, display
      // changes), so the commit must not depend on it alone.
      settleTimerRef.current = window.setTimeout(
        finish,
        BOOK_PREVIEW_SETTLE_MS + 80,
      )
    },
    [clearSettle, setOffset],
  )

  useEffect(() => {
    const node = surfaceRef.current
    if (!node || !options.enabled) return

    const onPointerDown = (event: PointerEvent) => {
      // A second finger must not hijack an in-flight drag.
      if (event.button !== 0 || stateRef.current.pointerId !== null) return
      clearSettle()
      // If a settle transition is still in flight, pick up the live painted
      // position so the page stays glued to the finger instead of jumping.
      const liveOffset = readOffsetX(node)
      if (Math.abs(liveOffset) > 0.5) setOffset(liveOffset, true)
      const bounds = node.getBoundingClientRect()
      stateRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX - liveOffset,
        startY: event.clientY,
        lastX: event.clientX,
        lastT: event.timeStamp,
        velocity: 0,
        tracking: Math.abs(liveOffset) > 0.5,
        offset: liveOffset,
        width: bounds.width,
      }
      node.setPointerCapture(event.pointerId)
    }

    const onPointerMove = (event: PointerEvent) => {
      const state = stateRef.current
      const current = optionsRef.current
      if (state.pointerId !== event.pointerId) return
      const dx = event.clientX - state.startX
      const dy = event.clientY - state.startY
      if (!state.tracking) {
        if (Math.abs(dx) < BOOK_PREVIEW_GESTURE_INTENT_PX) return
        if (Math.abs(dy) > Math.abs(dx)) {
          state.pointerId = null
          return
        }
        state.tracking = true
      }
      event.preventDefault()
      const dt = Math.max(1, event.timeStamp - state.lastT)
      const instant = (event.clientX - state.lastX) / dt
      state.velocity = state.velocity * 0.55 + instant * 0.45
      state.lastX = event.clientX
      state.lastT = event.timeStamp

      let next = dx
      if (dx > 0 && !current.canGoPrev) next = rubberband(dx, state.width * 0.4)
      if (dx < 0 && !current.canGoNext) next = rubberband(dx, state.width * 0.4)
      setOffset(next, true)
    }

    const finish = (event: PointerEvent) => {
      const state = stateRef.current
      const current = optionsRef.current
      if (state.pointerId !== event.pointerId) return
      if (node.hasPointerCapture(event.pointerId)) {
        node.releasePointerCapture(event.pointerId)
      }
      state.pointerId = null
      if (!state.tracking) {
        setOffset(0, true)
        return
      }

      // Project where the flick is heading so the page commits to where the
      // gesture was going, not where the finger happened to stop.
      const projected = state.offset + state.velocity * BOOK_PREVIEW_MOMENTUM_MS
      const shouldNext =
        current.canGoNext &&
        (projected < -state.width * BOOK_PREVIEW_COMMIT_RATIO ||
          state.velocity < -BOOK_PREVIEW_VELOCITY_COMMIT)
      const shouldPrev =
        current.canGoPrev &&
        (projected > state.width * BOOK_PREVIEW_COMMIT_RATIO ||
          state.velocity > BOOK_PREVIEW_VELOCITY_COMMIT)

      if (shouldNext) {
        settleTo(-state.width, current.onCommitNext)
        return
      }
      if (shouldPrev) {
        settleTo(state.width, current.onCommitPrev)
        return
      }
      settleTo(0)
    }

    node.addEventListener('pointerdown', onPointerDown)
    node.addEventListener('pointermove', onPointerMove)
    node.addEventListener('pointerup', finish)
    node.addEventListener('pointercancel', finish)

    return () => {
      node.removeEventListener('pointerdown', onPointerDown)
      node.removeEventListener('pointermove', onPointerMove)
      node.removeEventListener('pointerup', finish)
      node.removeEventListener('pointercancel', finish)
      clearSettle()
    }
  }, [options.enabled, clearSettle, setOffset, settleTo])

  useEffect(() => () => clearSettle(), [clearSettle])

  return { surfaceRef, reset: () => setOffset(0, true) }
}
