/**
 * Synthesised sound cues. Nothing ships as an audio file, which keeps the repo
 * asset-free and means the pack works fully offline with no downloads.
 */

export type Cue = 'tick' | 'urgent' | 'correct' | 'wrong' | 'reveal' | 'fanfare' | 'move' | 'buzz'

interface Tone {
  freq: number
  duration: number
  type: OscillatorType
  gain?: number
  /** Sequential notes, each delayed by the previous note's duration. */
  next?: Tone
}

const CUES: Record<Cue, Tone> = {
  tick: { freq: 880, duration: 0.04, type: 'square', gain: 0.18 },
  urgent: { freq: 1320, duration: 0.07, type: 'square', gain: 0.3 },
  move: { freq: 520, duration: 0.05, type: 'triangle', gain: 0.2 },
  correct: {
    freq: 660, duration: 0.11, type: 'sine',
    next: { freq: 990, duration: 0.16, type: 'sine' },
  },
  wrong: {
    freq: 200, duration: 0.18, type: 'sawtooth', gain: 0.25,
    next: { freq: 140, duration: 0.26, type: 'sawtooth', gain: 0.25 },
  },
  buzz: { freq: 110, duration: 0.35, type: 'square', gain: 0.3 },
  reveal: {
    freq: 523, duration: 0.09, type: 'triangle',
    next: { freq: 784, duration: 0.09, type: 'triangle' },
  },
  fanfare: {
    freq: 523, duration: 0.12, type: 'square',
    next: {
      freq: 659, duration: 0.12, type: 'square',
      next: {
        freq: 784, duration: 0.12, type: 'square',
        next: { freq: 1047, duration: 0.3, type: 'square' },
      },
    },
  },
}

let context: AudioContext | null = null
let masterVolume = 0.6
let enabled = true

export function configureAudio(options: { enabled: boolean; volume: number }): void {
  enabled = options.enabled
  masterVolume = options.volume
}

/** Browsers require a gesture before audio; the menu's first keypress supplies it. */
export function unlockAudio(): void {
  if (!enabled || context) return
  try {
    context = new AudioContext()
    void context.resume()
  } catch {
    context = null
  }
}

function playTone(tone: Tone, startAt: number): number {
  if (!context) return 0
  const oscillator = context.createOscillator()
  const amp = context.createGain()
  const peak = (tone.gain ?? 0.25) * masterVolume

  oscillator.type = tone.type
  oscillator.frequency.setValueAtTime(tone.freq, startAt)

  // A short attack/decay envelope; a raw gate would click.
  amp.gain.setValueAtTime(0.0001, startAt)
  amp.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), startAt + 0.012)
  amp.gain.exponentialRampToValueAtTime(0.0001, startAt + tone.duration)

  oscillator.connect(amp).connect(context.destination)
  oscillator.start(startAt)
  oscillator.stop(startAt + tone.duration + 0.02)

  return tone.next ? playTone(tone.next, startAt + tone.duration) : startAt + tone.duration
}

export function play(cue: Cue): void {
  if (!enabled) return
  unlockAudio()
  if (!context) return
  if (context.state === 'suspended') void context.resume()
  playTone(CUES[cue], context.currentTime)
}
