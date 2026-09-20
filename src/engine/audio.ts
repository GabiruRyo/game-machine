/**
 * A tiny synth. Nothing ships as an audio file, so the pack stays asset-free and
 * works offline, but the cues are built rather than beeped: notes are stacked
 * into chords, run through a filter and a short reverb, and given real envelopes.
 */

export type Cue =
  | 'tick' | 'urgent' | 'move' | 'select'
  | 'correct' | 'wrong' | 'reveal' | 'buzz' | 'fanfare' | 'whoosh'

interface Voice {
  /** Semitones above the note's root. A chord is several voices at once. */
  offset?: number
  type?: OscillatorType
  /** Cents of detune; a little makes a voice sound thicker. */
  detune?: number
  gain?: number
}

interface Note {
  freq: number
  duration: number
  /** Seconds after the cue starts. */
  at?: number
  voices?: Voice[]
  /** Low-pass cutoff in Hz; lower is darker. */
  cutoff?: number
  /** Slide to this frequency over the note's duration. */
  glideTo?: number
  gain?: number
  attack?: number
}

interface CueSpec {
  notes: Note[]
  /** Wet level of the short room reverb, 0-1. */
  reverb?: number
  /** Filtered noise burst layered under the note, for percussive cues. */
  noise?: { duration: number; gain: number; cutoff: number; at?: number }
}

const semitone = (freq: number, offset: number) => freq * Math.pow(2, offset / 12)

/** Major triad plus octave — the "something good happened" shape. */
const TRIAD: Voice[] = [
  { offset: 0, type: 'triangle', gain: 0.5 },
  { offset: 4, type: 'triangle', gain: 0.32 },
  { offset: 7, type: 'triangle', gain: 0.26 },
  { offset: 12, type: 'sine', gain: 0.2 },
]

const CUES: Record<Cue, CueSpec> = {
  // Short, soft and high so a per-second tick never becomes fatiguing.
  tick: { notes: [{ freq: 1180, duration: 0.035, gain: 0.1, cutoff: 3000, voices: [{ type: 'sine' }] }] },

  urgent: {
    notes: [{ freq: 1560, duration: 0.07, gain: 0.22, cutoff: 5000, voices: [{ type: 'square', gain: 0.5 }, { offset: 12, type: 'sine', gain: 0.3 }] }],
  },

  move: { notes: [{ freq: 520, duration: 0.05, gain: 0.14, cutoff: 2600, glideTo: 610, voices: [{ type: 'triangle' }] }] },

  select: { notes: [{ freq: 700, duration: 0.06, gain: 0.16, cutoff: 3200, glideTo: 880, voices: [{ type: 'triangle' }, { offset: 7, type: 'sine', gain: 0.4 }] }] },

  // Rising arpeggio landing on the octave.
  correct: {
    reverb: 0.3,
    notes: [
      { freq: 523.25, duration: 0.1, at: 0, gain: 0.3, cutoff: 4200, voices: TRIAD },
      { freq: 659.25, duration: 0.1, at: 0.075, gain: 0.3, cutoff: 4600, voices: TRIAD },
      { freq: 1046.5, duration: 0.34, at: 0.15, gain: 0.34, cutoff: 5200, voices: TRIAD },
    ],
  },

  // Two detuned sawtooths sagging downwards behind a dark filter.
  wrong: {
    reverb: 0.15,
    notes: [
      {
        freq: 233, duration: 0.2, gain: 0.22, cutoff: 900, glideTo: 208,
        voices: [{ type: 'sawtooth', gain: 0.5 }, { type: 'sawtooth', detune: -18, gain: 0.45 }],
      },
      {
        freq: 175, duration: 0.34, at: 0.16, gain: 0.24, cutoff: 700, glideTo: 138,
        voices: [{ type: 'sawtooth', gain: 0.5 }, { type: 'sawtooth', detune: -22, gain: 0.45 }],
      },
    ],
  },

  reveal: {
    reverb: 0.35,
    notes: [
      { freq: 392, duration: 0.11, at: 0, gain: 0.22, cutoff: 3400, voices: [{ type: 'triangle' }, { offset: 7, type: 'sine', gain: 0.35 }] },
      { freq: 587.33, duration: 0.3, at: 0.085, gain: 0.24, cutoff: 4200, voices: [{ type: 'triangle' }, { offset: 12, type: 'sine', gain: 0.3 }] },
    ],
  },

  // End of round: a low thud with a noise transient on top.
  buzz: {
    reverb: 0.2,
    noise: { duration: 0.16, gain: 0.12, cutoff: 1600 },
    notes: [
      {
        freq: 116, duration: 0.42, gain: 0.3, cutoff: 800, glideTo: 92,
        voices: [{ type: 'square', gain: 0.45 }, { offset: 12, type: 'triangle', gain: 0.25 }],
      },
    ],
  },

  whoosh: { noise: { duration: 0.26, gain: 0.09, cutoff: 1100 }, notes: [], reverb: 0.3 },

  // Full major arpeggio into a held chord.
  fanfare: {
    reverb: 0.45,
    notes: [
      { freq: 523.25, duration: 0.13, at: 0, gain: 0.26, cutoff: 4200, voices: TRIAD },
      { freq: 659.25, duration: 0.13, at: 0.11, gain: 0.26, cutoff: 4400, voices: TRIAD },
      { freq: 783.99, duration: 0.13, at: 0.22, gain: 0.26, cutoff: 4600, voices: TRIAD },
      { freq: 1046.5, duration: 0.62, at: 0.33, gain: 0.34, cutoff: 5400, attack: 0.02, voices: TRIAD },
    ],
  },
}

let context: AudioContext | null = null
let master: GainNode | null = null
let reverb: ConvolverNode | null = null
let reverbSend: GainNode | null = null
let masterVolume = 0.6
let enabled = true

export function configureAudio(options: { enabled: boolean; volume: number }): void {
  enabled = options.enabled
  masterVolume = options.volume
  if (master && context) master.gain.setValueAtTime(masterVolume, context.currentTime)
}

/** A short decaying-noise impulse: enough room to stop cues sounding bone dry. */
function buildImpulse(ctx: AudioContext, seconds = 1.1, decay = 3.2): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds)
  const impulse = ctx.createBuffer(2, length, ctx.sampleRate)
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel)
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay)
    }
  }
  return impulse
}

/** Browsers require a gesture before audio; the menu's first keypress supplies it. */
export function unlockAudio(): void {
  if (!enabled || context) return
  try {
    context = new AudioContext()

    master = context.createGain()
    master.gain.setValueAtTime(masterVolume, context.currentTime)

    // A gentle limiter keeps stacked chords from clipping on cheap speakers.
    const limiter = context.createDynamicsCompressor()
    limiter.threshold.setValueAtTime(-10, context.currentTime)
    limiter.ratio.setValueAtTime(12, context.currentTime)
    limiter.attack.setValueAtTime(0.003, context.currentTime)

    reverb = context.createConvolver()
    reverb.buffer = buildImpulse(context)
    reverbSend = context.createGain()
    reverbSend.gain.setValueAtTime(0, context.currentTime)

    master.connect(limiter).connect(context.destination)
    master.connect(reverbSend).connect(reverb).connect(limiter)

    void context.resume()
  } catch {
    context = null
    master = null
  }
}

function playNote(ctx: AudioContext, out: GainNode, note: Note, startAt: number): void {
  const begin = startAt + (note.at ?? 0)
  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(note.cutoff ?? 4000, begin)

  const amp = ctx.createGain()
  const peak = (note.gain ?? 0.2) * masterVolume
  const attack = note.attack ?? 0.008

  amp.gain.setValueAtTime(0.0001, begin)
  amp.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), begin + attack)
  amp.gain.exponentialRampToValueAtTime(0.0001, begin + note.duration)

  filter.connect(amp).connect(out)

  for (const voice of note.voices ?? [{ type: 'sine' }]) {
    const osc = ctx.createOscillator()
    const voiceGain = ctx.createGain()
    osc.type = voice.type ?? 'sine'
    osc.detune.setValueAtTime(voice.detune ?? 0, begin)
    voiceGain.gain.setValueAtTime(voice.gain ?? 1, begin)

    const freq = semitone(note.freq, voice.offset ?? 0)
    osc.frequency.setValueAtTime(freq, begin)
    if (note.glideTo) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(semitone(note.glideTo, voice.offset ?? 0), 20),
        begin + note.duration,
      )
    }

    osc.connect(voiceGain).connect(filter)
    osc.start(begin)
    osc.stop(begin + note.duration + 0.05)
  }
}

function playNoise(ctx: AudioContext, out: GainNode, spec: NonNullable<CueSpec['noise']>, startAt: number): void {
  const begin = startAt + (spec.at ?? 0)
  const frames = Math.floor(ctx.sampleRate * spec.duration)
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames)

  const source = ctx.createBufferSource()
  source.buffer = buffer

  const filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(spec.cutoff, begin)

  const amp = ctx.createGain()
  amp.gain.setValueAtTime(spec.gain * masterVolume, begin)
  amp.gain.exponentialRampToValueAtTime(0.0001, begin + spec.duration)

  source.connect(filter).connect(amp).connect(out)
  source.start(begin)
  source.stop(begin + spec.duration + 0.02)
}

export function play(cue: Cue): void {
  if (!enabled) return
  unlockAudio()
  if (!context || !master || !reverbSend) return
  if (context.state === 'suspended') void context.resume()

  const spec = CUES[cue]
  const now = context.currentTime + 0.001

  // Per-cue reverb amount, set just for the length of this cue.
  reverbSend.gain.setValueAtTime(spec.reverb ?? 0.08, now)

  for (const note of spec.notes) playNote(context, master, note, now)
  if (spec.noise) playNoise(context, master, spec.noise, now)
}
