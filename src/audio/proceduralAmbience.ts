// Procedural AMBIENCE (v0.3.124, closing the audio north-star list): a soft
// wind bed — looping filtered noise with a slow swell — and an occasional
// three-note birdsong, all synthesized, all very quiet. Ambience is scenery,
// not information: it observes nothing, it just makes the world feel outdoors.

const WIND_GAIN = 0.035;
const BIRD_GAIN = 0.1;

export interface AmbienceHandle {
  /** Schedule any due birdsong; call once per animation frame. */
  tick(nowMs: number): void;
  setMuted(muted: boolean): void;
  dispose(): void;
}

/** Next-chirp scheduler: a tiny LCG over the previous time, so the birds are
 *  irregular but reproducible from the first tick — 6 to 14 seconds apart. */
export function nextBirdTimeMs(afterMs: number): number {
  const seed = (Math.imul((afterMs | 0) + 0x9e3779b9, 0x85ebca6b) >>> 0) % 8000;
  return afterMs + 6000 + seed;
}

export function startAmbience(context: AudioContext): AmbienceHandle {
  const master = context.createGain();
  master.gain.value = 1;
  master.connect(context.destination);

  // The wind: two seconds of white noise, looped through a low-pass filter,
  // swelling slowly under an LFO so it breathes instead of hissing.
  const noiseBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
  const channel = noiseBuffer.getChannelData(0);
  let noiseState = 22695477;
  for (let i = 0; i < channel.length; i += 1) {
    noiseState = (Math.imul(noiseState, 1103515245) + 12345) >>> 0;
    channel[i] = (noiseState / 0xffffffff) * 2 - 1;
  }
  const wind = context.createBufferSource();
  wind.buffer = noiseBuffer;
  wind.loop = true;
  const windFilter = context.createBiquadFilter();
  windFilter.type = 'lowpass';
  windFilter.frequency.value = 420;
  const windGain = context.createGain();
  windGain.gain.value = WIND_GAIN;
  const swell = context.createOscillator();
  swell.frequency.value = 0.07;
  const swellDepth = context.createGain();
  swellDepth.gain.value = WIND_GAIN * 0.5;
  swell.connect(swellDepth);
  swellDepth.connect(windGain.gain);
  wind.connect(windFilter);
  windFilter.connect(windGain);
  windGain.connect(master);
  wind.start();
  swell.start();

  let nextBirdAt = nextBirdTimeMs(0);
  function birdsong(): void {
    const base = 1800 + ((nextBirdAt | 0) % 5) * 220;
    const start = context.currentTime;
    for (const [offset, ratio, duration] of [
      [0, 1, 0.09], [0.12, 1.25, 0.07], [0.22, 1.1, 0.12],
    ] as const) {
      const osc = context.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = base * ratio;
      const envelope = context.createGain();
      envelope.gain.setValueAtTime(0, start + offset);
      envelope.gain.linearRampToValueAtTime(BIRD_GAIN, start + offset + 0.02);
      envelope.gain.exponentialRampToValueAtTime(0.001, start + offset + duration);
      osc.connect(envelope);
      envelope.connect(master);
      osc.start(start + offset);
      osc.stop(start + offset + duration + 0.05);
    }
  }

  return {
    tick(nowMs: number): void {
      if (nowMs >= nextBirdAt) {
        birdsong();
        nextBirdAt = nextBirdTimeMs(nowMs);
      }
    },
    setMuted(muted: boolean): void {
      master.gain.value = muted ? 0 : 1;
    },
    dispose(): void {
      wind.stop();
      swell.stop();
      master.disconnect();
    },
  };
}
