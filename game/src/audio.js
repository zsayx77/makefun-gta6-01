// Synthesized sound only — WebAudio oscillators, no audio files, no network.
export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenOn = false;
    this.sirenPhase = 0;
    this.sirenHigh = false;
    this.started = false;
  }

  ensure() {
    if (this.started) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.6;
      this.master.connect(this.ctx.destination);

      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();

      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 720;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();

      this.started = true;
    } catch (e) {
      this.ctx = null;
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  setEngine(level, on) {
    if (!this.ctx) return;
    if (!Number.isFinite(level)) level = 0;
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(52 + level * 110, t, 0.08);
    this.engineGain.gain.setTargetAtTime(on ? 0.045 + level * 0.03 : 0, t, 0.1);
  }

  setSiren(on) {
    if (!this.ctx) return;
    this.sirenOn = on;
    this.sirenGain.gain.setTargetAtTime(on ? 0.028 : 0, this.ctx.currentTime, 0.15);
  }

  update(dt) {
    if (!this.ctx || !this.sirenOn) return;
    this.sirenPhase += dt;
    if (this.sirenPhase > 0.42) {
      this.sirenPhase = 0;
      this.sirenHigh = !this.sirenHigh;
      this.sirenOsc.frequency.setTargetAtTime(this.sirenHigh ? 880 : 660, this.ctx.currentTime, 0.03);
    }
  }

  blip(freq, dur) {
    if (!this.ctx) return;
    try {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'square';
      o.frequency.value = freq || 880;
      g.gain.setValueAtTime(0.06, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + (dur || 0.09));
      o.connect(g);
      g.connect(this.master);
      o.start();
      o.stop(this.ctx.currentTime + (dur || 0.09));
    } catch (e) {}
  }

  thud() {
    if (!this.ctx) return;
    try {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(120, this.ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(45, this.ctx.currentTime + 0.18);
      g.gain.setValueAtTime(0.12, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);
      o.connect(g);
      g.connect(this.master);
      o.start();
      o.stop(this.ctx.currentTime + 0.2);
    } catch (e) {}
  }
}
