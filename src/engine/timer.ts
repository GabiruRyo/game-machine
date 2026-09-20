import { useCallback, useEffect, useRef, useState } from 'react'
import { play } from './audio'

export interface CountdownOptions {
  seconds: number
  running: boolean
  onExpire?: () => void
  /** Beep each second, switching to an urgent beep for the last few. */
  ticking?: boolean
  urgentBelow?: number
}

export interface Countdown {
  msRemaining: number
  secondsRemaining: number
  /** 1 at the start, 0 when spent -- drives the timer bar width. */
  ratio: number
  expired: boolean
  reset: (seconds?: number) => void
}

export function useCountdown(options: CountdownOptions): Countdown {
  const { seconds, running, onExpire, ticking = true, urgentBelow = 5 } = options
  const totalMs = Math.max(0, seconds * 1000)
  const [msRemaining, setMsRemaining] = useState(totalMs)

  const deadlineRef = useRef<number>(0)
  const remainingRef = useRef<number>(totalMs)
  const expiredRef = useRef(false)
  const lastWholeSecondRef = useRef<number>(Math.ceil(totalMs / 1000))
  const onExpireRef = useRef(onExpire)
  onExpireRef.current = onExpire

  const reset = useCallback(
    (nextSeconds?: number) => {
      const ms = Math.max(0, (nextSeconds ?? seconds) * 1000)
      remainingRef.current = ms
      deadlineRef.current = performance.now() + ms
      expiredRef.current = false
      lastWholeSecondRef.current = Math.ceil(ms / 1000)
      setMsRemaining(ms)
    },
    [seconds],
  )

  // A change of duration (a different game, or a re-tuned config) restarts it.
  useEffect(() => {
    reset(seconds)
  }, [seconds, reset])

  useEffect(() => {
    if (!running) return
    deadlineRef.current = performance.now() + remainingRef.current
    let frame = 0

    const step = () => {
      const left = Math.max(0, deadlineRef.current - performance.now())
      remainingRef.current = left
      setMsRemaining(left)

      if (ticking) {
        const whole = Math.ceil(left / 1000)
        if (whole !== lastWholeSecondRef.current && whole > 0) {
          lastWholeSecondRef.current = whole
          play(whole <= urgentBelow ? 'urgent' : 'tick')
        }
      }

      if (left <= 0) {
        if (!expiredRef.current) {
          expiredRef.current = true
          play('buzz')
          onExpireRef.current?.()
        }
        return
      }
      frame = requestAnimationFrame(step)
    }

    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [running, ticking, urgentBelow])

  return {
    msRemaining,
    secondsRemaining: Math.ceil(msRemaining / 1000),
    ratio: totalMs > 0 ? msRemaining / totalMs : 0,
    expired: msRemaining <= 0,
    reset,
  }
}
