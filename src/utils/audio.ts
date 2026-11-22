// Web Audio API Synthesizer - realistic procedural sound design without external dependencies

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private activeAudioSet: Set<HTMLAudioElement> = new Set();
  private previewAudioEl: HTMLAudioElement | null = null;
  private audioBufferCache: Map<string, AudioBuffer> = new Map();
  private inflightAudioDecodes: Set<string> = new Set();
  private preloadedAudioEls: Map<string, HTMLAudioElement> = new Map();
  private audioUnlocked: boolean = false;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public unlockAudio(): void {
    const ctx = this.getContext();
    if (ctx && !this.audioUnlocked) {
      this.audioUnlocked = true;
      try {
        const silent = ctx.createBuffer(1, 1, 22050);
        const src = ctx.createBufferSource();
        src.buffer = silent;
        src.connect(ctx.destination);
        src.start(0);
      } catch {
        // ignore silent unlock errors
      }
    }
  }

  public preloadAudioUrl(url?: string | null): void {
    const clean = url?.trim();
    if (!clean || typeof window === 'undefined') return;

    if (typeof Audio !== 'undefined' && !this.preloadedAudioEls.has(clean)) {
      try {
        const el = new Audio(clean);
        el.preload = 'auto';
        el.volume = 0.92;
        el.load();
        this.preloadedAudioEls.set(clean, el);
      } catch {
        // ignore audio element preload errors
      }
    }

    if (this.audioBufferCache.has(clean) || this.inflightAudioDecodes.has(clean)) return;
    const ctx = this.getContext();
    if (!ctx) return;

    this.inflightAudioDecodes.add(clean);
    void fetch(clean, { mode: 'cors', credentials: 'omit' })
      .then((res) => (res.ok ? res.arrayBuffer() : null))
      .then((buf) => (buf ? ctx.decodeAudioData(buf) : null))
      .then((decoded) => {
        if (decoded) {
          this.audioBufferCache.set(clean, decoded);
        }
      })
      .catch(() => {
        // CORS-restricted audio URLs will fall back cleanly to preloaded HTMLAudioElement
      })
      .finally(() => {
        this.inflightAudioDecodes.delete(clean);
      });
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      this.stopAllCustomAudio();
    }
    return this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public stopAllCustomAudio(): void {
    this.activeAudioSet.forEach((audioEl) => {
      try {
        audioEl.pause();
        audioEl.currentTime = 0;
      } catch {
        // ignore audio cleanup errors
      }
    });
    this.activeAudioSet.clear();
    this.stopPreviewAudio();
  }

  public stopPreviewAudio(): void {
    if (this.previewAudioEl) {
      try {
        this.previewAudioEl.pause();
        this.previewAudioEl.currentTime = 0;
      } catch {
        // ignore preview cleanup errors
      }
      this.previewAudioEl = null;
    }
  }

  public previewAudioUrl(url: string, onEnded?: () => void): boolean {
    const clean = url.trim();
    if (!clean || typeof Audio === 'undefined') return false;
    this.stopPreviewAudio();
    try {
      const el = new Audio(clean);
      el.volume = 0.9;
      el.preload = 'auto';
      el.onended = () => {
        if (this.previewAudioEl === el) this.previewAudioEl = null;
        onEnded?.();
      };
      el.onerror = () => {
        if (this.previewAudioEl === el) this.previewAudioEl = null;
        onEnded?.();
      };
      this.previewAudioEl = el;
      void el.play().catch(() => {
        onEnded?.();
      });
      return true;
    } catch {
      onEnded?.();
      return false;
    }
  }

  public playGiftHitAudio(
    fallbackType: 'chime' | 'fanfare' | 'roar' | 'magic' | 'laser' | 'applause' | 'slot' | 'dice',
    customSoundUrl?: string,
    forceMuted = false
  ): void {
    if (this.isMuted || forceMuted) return;

    const cleanUrl = customSoundUrl?.trim();
    if (cleanUrl) {
      // 1. Instant 0ms Web Audio BufferSource playback if already decoded in memory
      const cachedBuffer = this.audioBufferCache.get(cleanUrl);
      const ctx = this.getContext();
      if (cachedBuffer && ctx) {
        try {
          const src = ctx.createBufferSource();
          src.buffer = cachedBuffer;
          const gain = ctx.createGain();
          gain.gain.value = 0.92;
          src.connect(gain);
          gain.connect(ctx.destination);
          src.start(0);
          return;
        } catch {
          // fall through to HTMLAudioElement
        }
      }

      // Trigger preload for next time
      this.preloadAudioUrl(cleanUrl);

      // 2. HTMLAudioElement playback (reusing warm cached element when idle)
      if (typeof Audio !== 'undefined') {
        try {
          if (this.activeAudioSet.size >= 4) {
            const oldest = this.activeAudioSet.values().next().value;
            if (oldest) {
              oldest.pause();
              this.activeAudioSet.delete(oldest);
            }
          }

          const warm = this.preloadedAudioEls.get(cleanUrl);
          const audio = warm && warm.paused ? warm : new Audio(cleanUrl);
          if (audio === warm) {
            try {
              audio.currentTime = 0;
            } catch {
              // ignore seek errors before metadata
            }
          }
          audio.volume = 0.92;
          audio.preload = 'auto';
          this.activeAudioSet.add(audio);

          let fellBack = false;
          const triggerFallback = () => {
            this.activeAudioSet.delete(audio);
            if (!fellBack) {
              fellBack = true;
              this.playGiftSound(fallbackType);
            }
          };

          audio.onended = () => {
            this.activeAudioSet.delete(audio);
          };
          audio.onerror = triggerFallback;

          const playPromise = audio.play();
          if (playPromise && typeof playPromise.catch === 'function') {
            playPromise.catch(() => {
              triggerFallback();
            });
          }
          return;
        } catch {
          this.playGiftSound(fallbackType);
          return;
        }
      }
    }

    this.playGiftSound(fallbackType);
  }

  // Mic click toggle
  public playMicClick(isUnmuting: boolean) {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;

    osc.type = 'sine';
    const startFreq = isUnmuting ? 440 : 880;
    const endFreq = isUnmuting ? 880 : 330;

    osc.frequency.setValueAtTime(startFreq, now);
    osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.08);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  // Gift sounds
  public playGiftSound(type: 'chime' | 'fanfare' | 'roar' | 'magic' | 'laser' | 'applause' | 'slot' | 'dice') {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    if (type === 'applause') {
      this.playApplause();
      return;
    }
    if (type === 'dice') {
      this.playDiceRoll();
      return;
    }
    if (type === 'slot') {
      this.playSlotTick();
      return;
    }

    const now = ctx.currentTime;

    if (type === 'chime') {
      // Golden Bell Chime (C6 - E6 - G6 - C7)
      const freqs = [1046.5, 1318.5, 1567.98, 2093];
      freqs.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const noteStart = now + idx * 0.06;

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, noteStart);

        gain.gain.setValueAtTime(0.15, noteStart);
        gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.5);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(noteStart);
        osc.stop(noteStart + 0.55);
      });
    } else if (type === 'fanfare') {
      // Royal Brass Fanfare
      const notes = [440, 554.37, 659.25, 880, 1108.73];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const noteStart = now + idx * 0.08;

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, noteStart);

        gain.gain.setValueAtTime(0.1, noteStart);
        gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.4);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(noteStart);
        osc.stop(noteStart + 0.45);
      });
    } else if (type === 'magic') {
      // Celestial Magic Sparkle
      for (let i = 0; i < 8; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const noteStart = now + i * 0.04;
        const freq = 1200 + Math.random() * 1600;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, noteStart);

        gain.gain.setValueAtTime(0.08, noteStart);
        gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(noteStart);
        osc.stop(noteStart + 0.3);
      }
    } else if (type === 'laser') {
      // Space Rocket / Laser
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(1800, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.3);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.38);
    } else if (type === 'roar') {
      // Golden Dragon Rumble
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(90, now);
      osc.frequency.linearRampToValueAtTime(140, now + 0.2);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.6);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.65);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.7);
    }
  }

  // Audience Applause / Cheering
  public playApplause() {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const bufferSize = ctx.sampleRate * 1.2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.7));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1000;
    filter.Q.value = 1.2;

    const gain = ctx.createGain();
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 1.15);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(now);
  }

  // Dice roll rattle
  public playDiceRoll() {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    for (let i = 0; i < 6; i++) {
      const now = ctx.currentTime + i * 0.05 + Math.random() * 0.02;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220 + Math.random() * 300, now);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.05);
    }
  }

  // Slot machine spinning click
  public playSlotTick() {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(600, now);

    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.035);
  }

  // Victory celebration chime
  public playWinChime() {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, i) => {
      const now = ctx.currentTime + i * 0.1;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.65);
    });
  }

  // Ambient oriental lute / oud motif for music room demo
  public playOudSample() {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    // Bayati scale notes approx: D, E-half-flat (approx 311), F, G, A
    const notes = [293.66, 311.13, 349.23, 392.0, 440.0, 392.0, 349.23, 293.66];
    notes.forEach((freq, idx) => {
      const now = ctx.currentTime + idx * 0.22;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.45);
    });
  }

  // Celebratory Lucky Jackpot Splash Sound ("صوت طشة") + Royal Coin Cascade
  public playLuckySplashJackpot() {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // 1. Crisp Splash Burst (Filtered white noise sweep for "طشة")
    const splashDuration = 0.75;
    const bufferSize = Math.floor(ctx.sampleRate * splashDuration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      const t = i / bufferSize;
      // Fast attack, bubbly tail decay
      const env = Math.sin(Math.min(1, t * 8) * Math.PI * 0.5) * Math.exp(-t * 3.8);
      data[i] = (Math.random() * 2 - 1) * env;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const splashFilter = ctx.createBiquadFilter();
    splashFilter.type = 'bandpass';
    splashFilter.frequency.setValueAtTime(420, now);
    splashFilter.frequency.exponentialRampToValueAtTime(2800, now + 0.14);
    splashFilter.frequency.exponentialRampToValueAtTime(950, now + 0.65);
    splashFilter.Q.value = 1.6;

    const splashGain = ctx.createGain();
    splashGain.gain.setValueAtTime(0.42, now);
    splashGain.gain.exponentialRampToValueAtTime(0.01, now + splashDuration);

    noise.connect(splashFilter);
    splashFilter.connect(splashGain);
    splashGain.connect(ctx.destination);
    noise.start(now);

    // 2. Impact Boom (Sub punch)
    const boomOsc = ctx.createOscillator();
    const boomGain = ctx.createGain();
    boomOsc.type = 'sine';
    boomOsc.frequency.setValueAtTime(140, now);
    boomOsc.frequency.exponentialRampToValueAtTime(45, now + 0.35);
    boomGain.gain.setValueAtTime(0.32, now);
    boomGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
    boomOsc.connect(boomGain);
    boomGain.connect(ctx.destination);
    boomOsc.start(now);
    boomOsc.stop(now + 0.4);

    // 3. Sparkling Golden Coin Cascade Chimes
    const coinNotes = [1046.5, 1318.51, 1567.98, 2093.0, 2637.02, 3135.96, 2093.0];
    coinNotes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const noteStart = now + 0.06 + idx * 0.055;

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, noteStart);

      gain.gain.setValueAtTime(0.16, noteStart);
      gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.48);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(noteStart);
      osc.stop(noteStart + 0.52);
    });
  }
}

export const sound = new SoundEngine();
