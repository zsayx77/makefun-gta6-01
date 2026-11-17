// Sound, all synthesized with WebAudio — no audio files, no network.
// Everything is guarded: if the browser has no audio (headless screenshots)
// every call is a silent no-op.
export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let muted = false;
  let time = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 50;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 500;
      engineOsc.connect(filter);
      filter.connect(engineGain);
      engineGain.connect(ctx.destination);
      engineOsc.start();
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
    } catch { /* ignore */ }
  }

  return {
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
      setTimeout(() => blip(1320, 0.14, 'sine', 0.15), 70);
    },
    punch() {
      blip(160, 0.1, 'square', 0.12);
    },
    crash() {
      blip(90, 0.25, 'sawtooth', 0.2);
    },
    mission() {
      blip(523, 0.12, 'sine', 0.18);
      setTimeout(() => blip(659, 0.12, 'sine', 0.18), 110);
      setTimeout(() => blip(784, 0.22, 'sine', 0.18), 220);
    },
    busted() {
      blip(330, 0.2, 'square', 0.15);
      setTimeout(() => blip(220, 0.35, 'square', 0.15), 180);
    },
    /** Called every frame: engine hum follows speed, siren wails while wanted. */
    update(dt, speed01, wanted) {
      time += dt;
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
          sirenOsc.frequency.value = 700 + 260 * Math.sin(time * 5.2);
        } else {
          sirenGain.gain.value = 0;
        }
      } catch { /* ignore */ }
    },
  };
}
