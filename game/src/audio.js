// All sound is synthesized with WebAudio — no audio files, no network.
// Every call is guarded, so in a browser without audio (headless screenshots)
// the game simply stays silent instead of throwing.

export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let muted = false;
  let clock = 0;

  /** Build the AudioContext and the two looping voices (engine, siren), once. */
  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      // Engine: a sawtooth through a low-pass filter, gain driven per frame.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 50;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 500;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
      // Siren: a triangle that wails while the player is wanted.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(ctx.destination);
      sirenOsc.start();
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  /** One short note: an oscillator that fades out over `dur` seconds. */
  function blip(freq, dur, type, vol) {
    if (!ensure() || muted) return;
    try {
      const osc = ctx.createOscillator();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(vol || 0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + dur);
    } catch {
      // A dead context stays silent; the game goes on.
    }
  }

  /** The same note again after `ms` milliseconds. */
  function later(ms, fn) {
    setTimeout(fn, ms);
  }

  return {
    /** Start (or resume) audio after a user gesture. */
    unlock() {
      if (ensure() && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
    pickup() {
      blip(880, 0.12, 'sine', 0.18);
      later(70, () => blip(1320, 0.14, 'sine', 0.15));
    },
    punch() {
      blip(160, 0.1, 'square', 0.12);
    },
    crash() {
      blip(90, 0.25, 'sawtooth', 0.2);
    },
    mission() {
      blip(523, 0.12, 'sine', 0.18);
      later(110, () => blip(659, 0.12, 'sine', 0.18));
      later(220, () => blip(784, 0.22, 'sine', 0.18));
    },
    busted() {
      blip(330, 0.2, 'square', 0.15);
      later(180, () => blip(220, 0.35, 'square', 0.15));
    },
    /** Per frame: the engine hum follows speed, the siren wails while wanted. */
    update(dt, speed01, wanted) {
      clock += dt;
      if (!ctx || muted) {
        if (engineGain) engineGain.gain.value = 0;
        if (sirenGain) sirenGain.gain.value = 0;
        return;
      }
      try {
        if (ctx.state === 'suspended') return;
        engineGain.gain.value = speed01 > 0.02 ? 0.03 + 0.05 * speed01 : 0;
        engineOsc.frequency.value = 55 + 140 * speed01;
        if (wanted > 0) {
          sirenGain.gain.value = 0.035;
          sirenOsc.frequency.value = 700 + 260 * Math.sin(clock * 5.2);
        } else {
          sirenGain.gain.value = 0;
        }
      } catch {
        // Keep the game running if the audio graph dies mid-frame.
      }
    },
  };
}
