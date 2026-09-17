export class AudioEngine {
  private ctx: AudioContext | null = null;
  private backgroundOscillator: OscillatorNode | null = null;
  private backgroundGain: GainNode | null = null;

  private init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Plays a silent audio loop to keep the browser process alive in the background on mobile
  public startKeepAlive() {
    this.init();
    if (!this.ctx) return;
    if (this.backgroundOscillator) return; // already running

    this.backgroundOscillator = this.ctx.createOscillator();
    this.backgroundGain = this.ctx.createGain();

    // Set gain to strictly 0 (silent)
    this.backgroundGain.gain.value = 0.0001; // nearly silent, just enough

    this.backgroundOscillator.connect(this.backgroundGain);
    this.backgroundGain.connect(this.ctx.destination);

    this.backgroundOscillator.start();
  }

  public stopKeepAlive() {
    if (this.backgroundOscillator) {
      this.backgroundOscillator.stop();
      this.backgroundOscillator.disconnect();
      this.backgroundGain?.disconnect();
      this.backgroundOscillator = null;
      this.backgroundGain = null;
    }
  }

  /**
   * Plays a custom sound effect whenever JARVIS completes/executes a task.
   * Checks for custom audio URL/path in localStorage or public/sounds/task.mp3 first.
   */
  public playTaskSound() {
    const customSound = localStorage.getItem('jarvis_custom_task_sound') || '/sounds/whatsapp_audio.mp3';

    try {
      const audio = new Audio(customSound);
      audio.volume = 0.6;
      const promise = audio.play();
      if (promise !== undefined) {
        promise.catch(() => {
          // Fallback to /sounds/task.mp3 or synthesized chime
          const fallbackAudio = new Audio('/sounds/task.mp3');
          fallbackAudio.volume = 0.6;
          fallbackAudio.play().catch(() => {
            this.playBeep('scan');
          });
        });
      }
    } catch (e) {
      this.playBeep('scan');
    }
  }

  public playBeep(type: 'startup' | 'click' | 'error' | 'scan' | 'task') {
    if (type === 'task') {
      this.playTaskSound();
      return;
    }

    this.init();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    const now = this.ctx.currentTime;

    switch (type) {
      case 'startup':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(600, now + 0.4);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.15, now + 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
        osc.start(now);
        osc.stop(now + 0.6);
        break;
      case 'click':
        osc.type = 'square';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.05);
        gain.gain.setValueAtTime(0.05, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
        osc.start(now);
        osc.stop(now + 0.05);
        break;
      case 'error':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.3);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
        break;
      case 'scan':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1200, now);
        osc.frequency.linearRampToValueAtTime(1250, now + 0.1);
        gain.gain.setValueAtTime(0.02, now);
        gain.gain.linearRampToValueAtTime(0.0, now + 0.1);
        osc.start(now);
        osc.stop(now + 0.1);
        break;
    }
  }
}

export const audioEngine = new AudioEngine();
