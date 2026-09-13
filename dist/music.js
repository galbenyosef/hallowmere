export const MUSIC_TRACKS = [
  {id: 'balefire', title: 'Balefire', duration: 339.946},
  {id: 'descent', title: 'Descent', duration: 137.693},
  {id: 'the-old-ones', title: 'The Old Ones', duration: 302.071},
  {id: 'incantation', title: 'Incantation', duration: 433.033},
];
export const MUSIC_FADE_SECONDS = 5;

// Two streamed media elements keep a twenty-minute score out of decoded PCM memory.
// Fades follow media time, so mute/background suspension preserves the transition.
export class MusicPlayer {
  constructor(context, output, {mediaFactory = () => new Audio(), tracks = MUSIC_TRACKS} = {}) {
    this.context = context; this.tracks = tracks; this.failed = new Set();
    this.enabled = true; this.active = false; this.blocked = false; this.activated = false;
    this.bus = context.createGain(); this.bus.gain.value = .24; this.bus.connect(output);
    this.decks = Array.from({length: 2}, () => {
      const media = mediaFactory(), gain = context.createGain();
      const source = context.createMediaElementSource(media);
      gain.gain.value = 0; source.connect(gain); gain.connect(this.bus);
      const deck = {media, gain, index: -1, token: 0, pending: false, primed: false, level: 0};
      media.preload = 'auto';
      for (const event of ['timeupdate', 'ended', 'canplay']) media.addEventListener(event, () => this.tick());
      media.addEventListener('error', () => this.fail(deck));
      return deck;
    });
    this.current = null; this.next = null; this.outgoing = null; this.transitioning = false;
  }

  nextIndex(after) {
    for (let n = 1; n <= this.tracks.length; n++) {
      const index = (after + n) % this.tracks.length;
      if (!this.failed.has(index)) return index;
    }
    return -1;
  }

  level(deck, value) {
    if (!deck || Math.abs(deck.level - value) < .001) return;
    deck.level = value;
    deck.gain.gain.setTargetAtTime(value, this.context.currentTime, .08);
  }

  prepare(deck, index) {
    deck.token++; deck.pending = false; deck.media.pause(); deck.index = index;
    deck.level = 0; deck.gain.gain.cancelScheduledValues(this.context.currentTime);
    deck.gain.gain.setValueAtTime(0, this.context.currentTime);
    deck.media.src = new URL(`./assets/music/${this.tracks[index].id}.mp3`, import.meta.url).href;
    deck.media.load();
  }

  queueNext() {
    if (!this.current || this.outgoing || this.next) return;
    const index = this.nextIndex(this.current.index);
    if (index < 0) return;
    this.next = this.decks.find(deck => deck !== this.current);
    this.prepare(this.next, index);
  }

  play(deck, onStarted, prime = false) {
    if (deck.pending) return;
    const token = deck.token; deck.pending = true;
    // Call play synchronously inside unlock to authorize both elements on mobile.
    let request;
    try { request = deck.media.play(); } catch (error) { request = Promise.reject(error); }
    Promise.resolve(request).then(() => {
      if (deck.token !== token) return;
      deck.pending = false; deck.primed = true;
      if (!this.active || (prime && deck !== this.current && deck !== this.outgoing)) deck.media.pause();
      onStarted?.();
      this.tick();
    }).catch(error => {
      if (deck.token !== token) return;
      deck.pending = false;
      if (error.name === 'AbortError') { this.transitioning = false; return; }
      if (error.name === 'NotAllowedError') {
        if (!prime) { this.blocked = true; this.transitioning = false; }
        return;
      }
      this.fail(deck);
    });
  }

  unlock() {
    this.activated = true; this.blocked = false;
    if (this.failed.size === this.tracks.length) this.failed.clear();
    this.setState(this.state || {});
    if (this.active && this.next && !this.next.primed && !this.transitioning) this.play(this.next, null, true);
  }

  setState(state) {
    this.state = state; this.enabled = state.enabled ?? true;
    this.active = this.activated && this.enabled && !state.muted && !state.backgrounded;
    if (!this.active) {
      for (const deck of this.decks) deck.media.pause();
      return;
    }
    if (!this.current) {
      const index = this.nextIndex(-1);
      if (index < 0) return;
      this.current = this.decks[0]; this.prepare(this.current, index); this.queueNext();
    }
    if (!this.blocked) {
      for (const deck of [this.current, this.outgoing]) if (deck?.media.paused && !deck.media.ended) this.play(deck);
      this.tick();
    }
  }

  tick() {
    if (!this.active || this.blocked || !this.current) return;
    if (this.outgoing) {
      const progress = Math.min(1, this.current.media.currentTime / MUSIC_FADE_SECONDS);
      this.level(this.current, progress); this.level(this.outgoing, 1 - progress);
      if (progress < 1) return;
      this.outgoing.media.pause(); this.outgoing = null; this.queueNext();
    } else this.level(this.current, Math.min(1, this.current.media.currentTime / 1.5));
    const media = this.current.media;
    if (!this.next || this.transitioning || this.next.pending) return;
    // Actual media duration wins over metadata. An unready next song never cuts off the current one.
    if (!media.ended && (!Number.isFinite(media.duration) || media.duration - media.currentTime > MUSIC_FADE_SECONDS)) return;
    if (this.next.media.readyState < 3) return;
    const incoming = this.next, outgoing = this.current;
    incoming.media.currentTime = 0; this.transitioning = true;
    this.play(incoming, () => {
      this.transitioning = false;
      if (this.current !== outgoing || this.next !== incoming) return;
      this.outgoing = outgoing; this.current = incoming; this.next = null; this.tick();
    });
  }

  fail(deck) {
    if (deck.index < 0 || this.failed.has(deck.index)) return;
    this.failed.add(deck.index); deck.token++; deck.pending = false;
    deck.media.pause(); this.level(deck, 0); this.transitioning = false;
    if (deck === this.outgoing) this.outgoing = null;
    if (deck === this.current) { this.current = this.outgoing; this.outgoing = null; }
    if (deck === this.next) this.next = null;
    // A spare may have failed while the current track was loading. Skip it once,
    // and stop after the finite playlist is exhausted instead of a retry loop.
    if (!this.current) {
      this.next = null;
      if (this.active) this.setState(this.state);
    } else this.queueNext();
  }

  duck(now) {
    const gain = this.bus.gain;
    gain.cancelScheduledValues(now); gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(.15, now + .035); gain.setTargetAtTime(.24, now + .22, .3);
  }

  getState() {
    return {enabled: this.enabled, playing: this.active && !!this.current && !this.current.media.paused,
      blocked: this.blocked, track: this.current ? this.tracks[this.current.index].title : null,
      position: this.current?.media.currentTime || 0, crossfading: !!this.outgoing,
      failed: [...this.failed].map(index => this.tracks[index].id),
      playlistSeconds: this.tracks.reduce((sum, track) => sum + track.duration, 0)};
  }
}
