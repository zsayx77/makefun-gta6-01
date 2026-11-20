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
    this.rotorOsc = null;
    this.rotorGain = null;
    this.rotorOn = false;
    this.rotorPhase = 0;
    this.musicOn = false;
    this.musicStep = 0;
    this.musicNext = 0;
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

      // Helicopter rotor: a slow chopping sawtooth, wobbled in update().
      this.rotorOsc = this.ctx.createOscillator();
      this.rotorOsc.type = 'sawtooth';
      this.rotorOsc.frequency.value = 30;
      this.rotorGain = this.ctx.createGain();
      this.rotorGain.gain.value = 0;
      this.rotorOsc.connect(this.rotorGain);
      this.rotorGain.connect(this.master);
      this.rotorOsc.start();

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

  setRotor(on) {
    if (!this.ctx) return;
    this.rotorOn = on;
    this.rotorGain.gain.setTargetAtTime(on ? 0.05 : 0, this.ctx.currentTime, 0.2);
  }

  setMusic(on) {
    if (!this.ctx) return;
    this.musicOn = on;
    if (on) {
      this.musicStep = 0;
      this.musicNext = this.ctx.currentTime + 0.05;
    }
  }

  update(dt) {
    if (!this.ctx) return;
    if (this.sirenOn) {
      this.sirenPhase += dt;
      if (this.sirenPhase > 0.42) {
        this.sirenPhase = 0;
        this.sirenHigh = !this.sirenHigh;
        this.sirenOsc.frequency.setTargetAtTime(this.sirenHigh ? 880 : 660, this.ctx.currentTime, 0.03);
      }
    }
    if (this.rotorOn) {
      this.rotorPhase += dt;
      this.rotorOsc.frequency.setTargetAtTime(28 + Math.sin(this.rotorPhase * 9) * 5, this.ctx.currentTime, 0.03);
    }
    // Tiny bassline loop (A minor groove, 8 eighth-notes at 112 bpm).
    if (this.musicOn) {
      const bass = [55, 0, 55, 65.41, 55, 0, 82.41, 49];
      const stepDur = 60 / 112 / 2;
      while (this.musicNext < this.ctx.currentTime + 0.15) {
        const f = bass[this.musicStep % bass.length];
        if (f > 0) {
          const o = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          o.type = 'triangle';
          o.frequency.value = f;
          g.gain.setValueAtTime(0.05, this.musicNext);
          g.gain.exponentialRampToValueAtTime(0.001, this.musicNext + stepDur * 0.95);
          o.connect(g);
          g.connect(this.master);
          o.start(this.musicNext);
          o.stop(this.musicNext + stepDur);
        }
        this.musicStep += 1;
        this.musicNext += stepDur;
      }
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

  shoot() {
    if (!this.ctx) return;
    try {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'square';
      o.frequency.setValueAtTime(240, this.ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(55, this.ctx.currentTime + 0.09);
      g.gain.setValueAtTime(0.09, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.1);
      o.connect(g);
      g.connect(this.master);
      o.start();
      o.stop(this.ctx.currentTime + 0.1);
    } catch (e) {}
  }

  explosion() {
    if (!this.ctx) return;
    try {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(160, this.ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.5);
      g.gain.setValueAtTime(0.16, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.55);
      o.connect(g);
      g.connect(this.master);
      o.start();
      o.stop(this.ctx.currentTime + 0.55);
    } catch (e) {}
  }
}
