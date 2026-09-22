'use client'

import { useCallback, useEffect, useRef } from 'react'

export function useStableHandler<Args extends unknown[], Result>(
  handler: (...args: Args) => Result,
): (...args: Args) => Result {
  const handlerRef = useRef(handler)
  useEffect(() => {
    handlerRef.current = handler
  })
  return useCallback((...args: Args) => handlerRef.current(...args), [])
}
