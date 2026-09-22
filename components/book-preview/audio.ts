let sharedContext: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AudioContextClass =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  if (!AudioContextClass) return null
  if (!sharedContext || sharedContext.state === 'closed') {
    try {
      sharedContext = new AudioContextClass()
    } catch {
      return null
    }
  }
  // Browsers suspend contexts created before a user gesture; resume on play.
  if (sharedContext.state === 'suspended') void sharedContext.resume()
  return sharedContext
}

const PAGE_TURN_DURATION = 0.22
let cachedNoise: AudioBuffer | null = null

// The noise burst is identical every turn, so synthesising ~10k samples per
// page flip is pure main-thread waste. Build it once per context instead.
function getPageTurnBuffer(context: AudioContext): AudioBuffer {
  if (cachedNoise && cachedNoise.sampleRate === context.sampleRate) {
    return cachedNoise
  }
  const bufferSize = Math.floor(context.sampleRate * PAGE_TURN_DURATION)
  const buffer = context.createBuffer(1, bufferSize, context.sampleRate)
  const output = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i += 1) {
    output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.4))
  }
  cachedNoise = buffer
  return buffer
}

export function playPageTurnSound(): void {
  const context = getAudioContext()
  if (!context) return

  const duration = PAGE_TURN_DURATION
  const buffer = getPageTurnBuffer(context)

  const whiteNoise = context.createBufferSource()
  whiteNoise.buffer = buffer

  const filter = context.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.setValueAtTime(650, context.currentTime)
  filter.frequency.exponentialRampToValueAtTime(
    250,
    context.currentTime + duration,
  )
  filter.Q.setValueAtTime(1.5, context.currentTime)

  const gainNode = context.createGain()
  gainNode.gain.setValueAtTime(0.18, context.currentTime)
  gainNode.gain.exponentialRampToValueAtTime(
    0.001,
    context.currentTime + duration,
  )

  whiteNoise.connect(filter)
  filter.connect(gainNode)
  gainNode.connect(context.destination)

  try {
    whiteNoise.start()
    whiteNoise.stop(context.currentTime + duration)
    whiteNoise.onended = () => {
      whiteNoise.disconnect()
      filter.disconnect()
      gainNode.disconnect()
    }
  } catch {
    // A suspended or closing context can reject start; the sound is optional.
  }
}

export function stopPageTurnSounds(): void {
  if (!sharedContext) return
  void sharedContext.close()
  sharedContext = null
  cachedNoise = null
}
