// Procedural audio VOICES (v0.3.109): every cue is synthesized from
// oscillators and envelopes at play time — no samples, no audio assets, the
// sound equivalent of the repo's original/procedural art rule. Each voice is
// a small deterministic recipe over the Web Audio graph; the controller
// decides WHEN, these decide WHAT IT SOUNDS LIKE.

import type { GameAudioCue } from './gameAudioController';

// A modest master level: game cues sit under the player's attention, not on
// top of it.
const MASTER_GAIN = 0.22;

interface Note {
  frequency: number;
  startSeconds: number;
  durationSeconds: number;
  type: OscillatorType;
  peak: number;
}

function playNotes(context: AudioContext, notes: readonly Note[]): void {
  const master = context.createGain();
  master.gain.value = MASTER_GAIN;
  master.connect(context.destination);
  const now = context.currentTime;
  for (const note of notes) {
    const oscillator = context.createOscillator();
    oscillator.type = note.type;
    oscillator.frequency.value = note.frequency;
    const envelope = context.createGain();
    const start = now + note.startSeconds;
    const end = start + note.durationSeconds;
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(note.peak, start + 0.02);
    envelope.gain.exponentialRampToValueAtTime(0.001, end);
    oscillator.connect(envelope);
    envelope.connect(master);
    oscillator.start(start);
    oscillator.stop(end + 0.05);
  }
}

// The horn: two detuned saws a fifth apart, falling a tone — an alarm that
// reads as brass, not as a beep.
function horn(context: AudioContext): void {
  playNotes(context, [
    { frequency: 220, startSeconds: 0, durationSeconds: 0.55, type: 'sawtooth', peak: 0.8 },
    { frequency: 331, startSeconds: 0, durationSeconds: 0.55, type: 'sawtooth', peak: 0.5 },
    { frequency: 196, startSeconds: 0.45, durationSeconds: 0.7, type: 'sawtooth', peak: 0.8 },
    { frequency: 294, startSeconds: 0.45, durationSeconds: 0.7, type: 'sawtooth', peak: 0.5 },
  ]);
}

// Age-up: a rising major arpeggio with a held top — ceremony, not alarm.
function ageUp(context: AudioContext): void {
  playNotes(context, [
    { frequency: 262, startSeconds: 0, durationSeconds: 0.22, type: 'triangle', peak: 0.9 },
    { frequency: 330, startSeconds: 0.18, durationSeconds: 0.22, type: 'triangle', peak: 0.9 },
    { frequency: 392, startSeconds: 0.36, durationSeconds: 0.22, type: 'triangle', peak: 0.9 },
    { frequency: 523, startSeconds: 0.54, durationSeconds: 0.6, type: 'triangle', peak: 1.0 },
    { frequency: 262, startSeconds: 0.54, durationSeconds: 0.6, type: 'sine', peak: 0.5 },
  ]);
}

// Victory: the age-up gesture writ large, ending on a full chord.
function victory(context: AudioContext): void {
  playNotes(context, [
    { frequency: 392, startSeconds: 0, durationSeconds: 0.25, type: 'triangle', peak: 0.9 },
    { frequency: 523, startSeconds: 0.22, durationSeconds: 0.25, type: 'triangle', peak: 0.9 },
    { frequency: 659, startSeconds: 0.44, durationSeconds: 0.8, type: 'triangle', peak: 1.0 },
    { frequency: 523, startSeconds: 0.44, durationSeconds: 0.8, type: 'sine', peak: 0.6 },
    { frequency: 392, startSeconds: 0.44, durationSeconds: 0.8, type: 'sine', peak: 0.5 },
  ]);
}

// Defeat: three falling minor steps on a darker wave.
function defeat(context: AudioContext): void {
  playNotes(context, [
    { frequency: 330, startSeconds: 0, durationSeconds: 0.35, type: 'square', peak: 0.5 },
    { frequency: 294, startSeconds: 0.3, durationSeconds: 0.35, type: 'square', peak: 0.5 },
    { frequency: 220, startSeconds: 0.6, durationSeconds: 0.9, type: 'square', peak: 0.6 },
  ]);
}

// Research done: one bright, short ding — information, not ceremony.
function researchComplete(context: AudioContext): void {
  playNotes(context, [
    { frequency: 880, startSeconds: 0, durationSeconds: 0.28, type: 'sine', peak: 0.8 },
    { frequency: 1320, startSeconds: 0, durationSeconds: 0.2, type: 'sine', peak: 0.35 },
  ]);
}

// Countdown begun: two solemn bell strikes.
function countdownStarted(context: AudioContext): void {
  playNotes(context, [
    { frequency: 440, startSeconds: 0, durationSeconds: 0.5, type: 'triangle', peak: 0.9 },
    { frequency: 554, startSeconds: 0.4, durationSeconds: 0.7, type: 'triangle', peak: 0.9 },
  ]);
}

// The town bell: three urgent strikes on one high bell.
function townBell(context: AudioContext): void {
  playNotes(context, [
    { frequency: 660, startSeconds: 0, durationSeconds: 0.3, type: 'triangle', peak: 1.0 },
    { frequency: 660, startSeconds: 0.28, durationSeconds: 0.3, type: 'triangle', peak: 1.0 },
    { frequency: 660, startSeconds: 0.56, durationSeconds: 0.5, type: 'triangle', peak: 1.0 },
    { frequency: 1320, startSeconds: 0, durationSeconds: 0.2, type: 'sine', peak: 0.3 },
  ]);
}

const VOICES: Record<GameAudioCue, (context: AudioContext) => void> = {
  'town-under-attack': horn,
  'age-up': ageUp,
  victory,
  defeat,
  'research-complete': researchComplete,
  'countdown-started': countdownStarted,
  'town-bell': townBell,
};

/** Play one cue through the given context. */
export function playProceduralCue(context: AudioContext, cue: GameAudioCue): void {
  VOICES[cue](context);
}
