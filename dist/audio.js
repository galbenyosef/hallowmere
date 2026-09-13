import {SOUND_BANKS, AUDIO_FILES, MAX_VOICES, spatialMix, ambienceMix} from './audio-palette.js';

export class AudioEngine {
  constructor({random = Math.random, fetcher = (...args) => fetch(...args), contextFactory} = {}) {
    this.contextFactory = contextFactory || (() => new (globalThis.AudioContext || globalThis.webkitAudioContext)());
    this.random = random; this.fetcher = fetcher;
    this.context = null; this.buffers = {}; this.failed = new Set(); this.inflight = new Map();
    this.muted = false; this.ready = false; this.paused = false; this.backgrounded = false;
    this.volume = .72; this.last = {}; this.bags = {}; this.previous = {};
    this.voices = new Set(); this.loops = new Map(); this.listener = {x: -66, z: 5};
    this.world = {}; this.targets = ambienceMix(); this.nextDetail = 8; this.nextBell = 24;
  }

  async unlock() {
    if (this.ready) {
      if (!this.backgrounded && this.context.state === 'suspended') await this.context.resume().catch(() => {});
      return;
    }
    if (!this.pending) this.pending = this.init().finally(() => { this.pending = null; });
    return this.pending;
  }

  createGraph(context) {
    this.context = context;
    this.master = context.createGain(); this.master.gain.value = this.muted || this.backgrounded ? 0 : this.volume;
    this.compressor = context.createDynamicsCompressor();
    for (const [name, value] of Object.entries({threshold: -15, knee: 15, ratio: 4, attack: .004, release: .22})) this.compressor[name].value = value;
    const highpass = context.createBiquadFilter(); highpass.type = 'highpass'; highpass.frequency.value = 30;
    const ceiling = context.createWaveShaper();
    ceiling.curve = Float32Array.from({length: 4097}, (_, i) => {
      const x = i / 2048 - 1, a = Math.abs(x);
      return Math.sign(x) * (a <= .8 ? a : .8 + .16 * Math.tanh((a - .8) / .16));
    });
    this.compressor.connect(highpass); highpass.connect(this.master); this.master.connect(ceiling); ceiling.connect(context.destination);
    this.worldBus = context.createGain(); this.worldBus.gain.value = this.paused ? .12 : 1;
    this.worldBus.connect(this.compressor);
    this.buses = {};
    for (const name of ['sfx', 'ui', 'ambience']) {
      const gain = context.createGain(); gain.gain.value = name === 'ambience' ? .65 : name === 'ui' ? .8 : 1;
      gain.connect(name === 'ui' ? this.compressor : this.worldBus); this.buses[name] = gain;
    }
    this.reverb = context.createConvolver();
    const impulse = context.createBuffer(2, Math.ceil(context.sampleRate * 2.4), context.sampleRate);
    let seed = 9328;
    for (let channel = 0; channel < 2; channel++) {
      const data = impulse.getChannelData(channel); let filtered = 0;
      for (let i = 0; i < data.length; i++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        filtered += .22 * (seed / 2147483648 - 1 - filtered);
        const t = i / context.sampleRate;
        data[i] = t < .021 ? 0 : filtered * Math.exp(-t * 3.4) * Math.min(1, (t - .021) * 90);
      }
    }
    this.reverb.buffer = impulse;
    this.reverbReturn = context.createGain(); this.reverbReturn.gain.value = .65;
    this.reverb.connect(this.reverbReturn); this.reverbReturn.connect(this.worldBus);
  }

  async init() {
    try {
      if (!this.context) this.createGraph(this.contextFactory());
      if (!this.backgrounded) await this.context.resume();
      const first = ['sword', 'impact', 'ember', 'dodge', 'hurt', 'heal', 'step'].flatMap(cue => SOUND_BANKS[cue].files);
      await this.loadFiles(first);
      this.ready = true; this.applyState();
      // Stream long backgrounds after responsive combat cues; six requests at a time.
      this.loading = this.loadFiles(AUDIO_FILES.filter(file => !first.includes(file))).then(() => this.startBeds());
    } catch (error) {
      console.warn('Audio unavailable; interact again to retry.', error);
      this.ready = false;
    }
  }

  async loadFiles(files) {
    let index = 0;
    await Promise.all(Array.from({length: Math.min(6, files.length)}, async () => {
      while (index < files.length) await this.loadFile(files[index++]);
    }));
  }

  async loadFile(file) {
    if (this.buffers[file]) return this.buffers[file];
    if (this.inflight.has(file)) return this.inflight.get(file);
    const request = (async () => {
      try {
        const response = await this.fetcher(new URL(`./assets/audio/${file}.wav`, import.meta.url));
        if (!response.ok) throw Error(`HTTP ${response.status}`);
        const buffer = await this.context.decodeAudioData(await response.arrayBuffer());
        this.buffers[file] = buffer; this.failed.delete(file); return buffer;
      } catch (error) {
        this.failed.add(file); console.warn(`Sound unavailable: ${file}`, error); return null;
      } finally { this.inflight.delete(file); }
    })();
    this.inflight.set(file, request); return request;
  }

  choose(cue) {
    const files = SOUND_BANKS[cue]?.files.filter(file => this.buffers[file]) || [];
    if (!files.length) return null;
    let bag = this.bags[cue];
    if (!bag?.length) {
      bag = [...files];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(this.random() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      if (bag.length > 1 && bag.at(-1) === this.previous[cue]) [bag[0], bag[bag.length - 1]] = [bag.at(-1), bag[0]];
      this.bags[cue] = bag;
    }
    const selected = bag.pop(); this.previous[cue] = selected; return selected;
  }

  play(cue, volume = 1, rate = 1, options = {}) {
    const config = SOUND_BANKS[cue];
    if (typeof options === 'boolean') options = {loop: options};
    const bus = options.ui ? 'ui' : config?.bus;
    if (!this.ready || !config || this.muted || this.backgrounded || (this.paused && bus !== 'ui')) return null;
    const now = this.context.currentTime, loop = options.loop ?? config.loop ?? false;
    if (!loop && now - (this.last[cue] ?? -Infinity) < config.cooldown) return null;
    const spatial = spatialMix(options.position, this.listener, options.occluded);
    if (spatial.gain < .008) return null;
    const file = this.choose(cue);
    if (!file) return null;
    if (!loop) {
      const same = [...this.voices].filter(voice => voice.cue === cue);
      if (same.length >= config.voices) this.stopVoice(same[0]);
      if (this.voices.size >= MAX_VOICES) {
        const victim = [...this.voices].sort((a, b) => a.priority - b.priority || a.started - b.started)[0];
        if (victim.priority > config.priority) return null;
        this.stopVoice(victim);
      }
      this.last[cue] = now;
    }
    const source = this.context.createBufferSource(), gain = this.context.createGain();
    const filter = this.context.createBiquadFilter(), panner = this.context.createStereoPanner(), send = this.context.createGain();
    source.buffer = this.buffers[file]; source.loop = loop;
    source.playbackRate.value = Math.max(.45, Math.min(1.8, rate * (1 + (this.random() * 2 - 1) * config.pitch)));
    filter.type = 'lowpass'; filter.frequency.value = spatial.cutoff;
    panner.pan.value = options.pan ?? spatial.pan;
    const level = Math.max(0, volume) * config.gain * spatial.gain * (loop ? 1 : .94 + this.random() * .12);
    gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(level, now + (loop ? .8 : .004));
    send.gain.value = config.wet;
    source.connect(filter); filter.connect(gain); gain.connect(panner);
    panner.connect(this.buses[bus]); panner.connect(send); send.connect(this.reverb);
    const voice = {cue, file, bus, source, gain, panner, filter, send, priority: config.priority, started: now, loop, level};
    if (!loop) this.voices.add(voice);
    source.onended = () => {
      this.voices.delete(voice);
      for (const node of [source, gain, filter, panner, send]) node.disconnect();
    };
    source.start(now, loop ? this.random() * source.buffer.duration : 0);
    source.voice = voice;
    if (config.priority >= 4 && !loop) this.duck(now);
    return source;
  }

  stopVoice(voice) {
    const now = this.context.currentTime;
    voice.gain.gain.cancelScheduledValues(now); voice.gain.gain.setTargetAtTime(0, now, .006);
    voice.source.stop(now + .025); this.voices.delete(voice);
  }

  duck(now) {
    const gain = this.buses.ambience.gain;
    gain.cancelScheduledValues(now); gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(.36, now + .035); gain.setTargetAtTime(.65, now + .22, .22);
  }

  startBeds() {
    if (!this.ready || this.muted || this.backgrounded || this.paused) return;
    for (const [cue, config] of Object.entries(SOUND_BANKS)) if (config.loop && !this.loops.has(cue)) {
      const source = this.play(cue, this.targets[cue] || 0, 1, {loop: true});
      if (source) this.loops.set(cue, source.voice);
    }
  }

  update(dt, world = {}) {
    this.world = world;
    if (world.position) this.listener = {x: world.position.x, z: world.position.z};
    this.targets = ambienceMix(world);
    if (!this.ready || this.paused || this.backgrounded) return;
    this.startBeds();
    const now = this.context.currentTime;
    for (const [cue, voice] of this.loops) {
      const target = this.targets[cue] * SOUND_BANKS[cue].gain;
      if (Math.abs(target - voice.level) > .002) {
        voice.gain.gain.cancelScheduledValues(now);
        voice.gain.gain.setTargetAtTime(target, now, cue === 'heartbeat' ? .4 : 1.8);
        voice.level = target;
      }
    }
    if (world.ended || this.muted) return;
    this.nextDetail -= dt; this.nextBell -= dt;
    if (this.nextDetail <= 0) {
      if ((world.threat || 0) < .3 && !world.victory) {
        const cue = world.zone === 'hallowmere' && this.random() > .4 ? 'whisper' : 'creak';
        this.play(cue, world.zone === 'ashwick' ? .16 : .3, .94 + this.random() * .12, {pan: (this.random() > .5 ? 1 : -1) * (.35 + this.random() * .4)});
      }
      this.nextDetail = 9 + this.random() * 13;
    }
    if (this.nextBell <= 0) {
      if (!world.victory && ['road','hallowmere'].includes(world.zone) && (world.threat || 0) < .35) this.play('bell', .28, .94, {position: {x: 0, z: -9}});
      this.nextBell = 28 + this.random() * 23;
    }
  }

  applyState() {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(this.muted || this.backgrounded ? 0 : this.volume, now, .04);
    this.worldBus.gain.setTargetAtTime(this.paused ? .12 : 1, now, .1);
  }

  toggle() {
    this.muted = !this.muted; this.applyState();
    if (!this.muted) { this.startBeds(); if (this.failed.size) this.loading = this.loadFiles([...this.failed]).then(() => this.startBeds()); }
    return this.muted;
  }

  pause(value, backgrounded = false) {
    const wasPaused = this.paused;
    this.paused = !!value; this.backgrounded = !!backgrounded;
    clearTimeout(this.suspendTimer); this.applyState();
    if (!this.context) return;
    if (this.paused && !wasPaused) for (const voice of [...this.voices]) if (voice.bus !== 'ui') this.stopVoice(voice);
    if (this.backgrounded) {
      this.suspendTimer = setTimeout(() => {
        if (this.backgrounded && this.context.state === 'running') this.context.suspend().catch(() => {});
      }, 180);
    } else {
      if (this.context.state === 'suspended') this.context.resume().catch(() => {});
      this.startBeds();
    }
  }

  getState() {
    return {ready: this.ready, muted: this.muted, state: this.context?.state ?? 'not-started',
      effects: Object.keys(this.buffers).length, expected: AUDIO_FILES.length, failed: [...this.failed],
      voices: this.voices.size, beds: this.loops.size, zone: this.world.zone ?? 'ashwick',
      mix: {...this.targets}, master: this.master?.gain.value ?? 0};
  }
}
