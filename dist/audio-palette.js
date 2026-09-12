// Playback defaults are separate from the asset workshop so the game stays dependency-free.
const bank = (name, count, options = {}) => ({
  files: Array.from({length: count}, (_, i) => `${name}${i ? `-${i + 1}` : ''}`),
  bus: 'sfx', gain: .8, wet: .12, priority: 2, cooldown: .065, voices: 4,
  pitch: .045, ...options,
});

export const SOUND_BANKS = {
  sword: bank('sword', 3, {wet: .09}),
  impact: bank('impact', 4, {gain: .9, voices: 5}),
  ember: bank('ember', 3, {wet: .2}),
  'ember-hit': bank('ember-hit', 2, {wet: .18}),
  nova: bank('nova', 2, {gain: .85, wet: .3, priority: 4, cooldown: .3, voices: 1}),
  dodge: bank('dodge', 2, {wet: .06}),
  hurt: bank('hurt', 3, {priority: 5, cooldown: .15, wet: .04, voices: 2}),
  death: bank('death', 3, {wet: .25, voices: 3}),
  'death-hound': bank('death-hound', 2, {wet: .2}),
  'death-revenant': bank('death-revenant', 2, {wet: .38}),
  'death-boss': bank('death-boss', 1, {wet: .38, priority: 6, voices: 1, pitch: 0}),
  'death-player': bank('death-player', 1, {wet: .28, priority: 6, voices: 1, pitch: 0}),
  heal: bank('heal', 2, {wet: .22, priority: 4}),
  pickup: bank('pickup', 3, {bus: 'ui', gain: .7, wet: .035, cooldown: .045}),
  relic: bank('relic', 1, {bus: 'ui', wet: .3, priority: 5, pitch: 0}),
  equip: bank('equip', 2, {bus: 'ui', wet: .05}),
  levelup: bank('levelup', 1, {bus: 'ui', wet: .24, priority: 4, pitch: 0}),
  'ui-open': bank('ui-open', 1, {bus: 'ui', gain: .5, wet: .03}),
  'ui-close': bank('ui-close', 1, {bus: 'ui', gain: .45, wet: .03}),
  step: bank('step', 4, {gain: .7, wet: .025, priority: 1, voices: 2, cooldown: .18}),
  'step-dirt': bank('step-dirt', 4, {gain: .72, wet: .025, priority: 1, voices: 2, cooldown: .18}),
  'step-wood': bank('step-wood', 4, {gain: .65, wet: .06, priority: 1, voices: 2, cooldown: .18}),
  door: bank('door', 2, {wet: .17, cooldown: .6, voices: 1}),
  bell: bank('bell', 2, {gain: .7, wet: .35, priority: 3, cooldown: 2, voices: 2, pitch: .012}),
  roar: bank('roar', 2, {wet: .32, priority: 5, cooldown: 1.2, voices: 1}),
  'voice-hollow': bank('voice-hollow', 3, {wet: .2, cooldown: .6, voices: 2}),
  'voice-hound': bank('voice-hound', 3, {wet: .12, cooldown: .45, voices: 2}),
  'voice-revenant': bank('voice-revenant', 2, {wet: .28, cooldown: .7, voices: 2}),
  'boss-windup': bank('boss-windup', 1, {wet: .28, priority: 5, voices: 1}),
  'boss-slam': bank('boss-slam', 2, {wet: .3, priority: 5, voices: 2}),
  whisper: bank('whisper', 3, {bus: 'ambience', gain: .6, wet: .3, priority: 0, voices: 1, cooldown: 5}),
  creak: bank('creak', 3, {bus: 'ambience', gain: .6, wet: .24, priority: 0, voices: 1, cooldown: 5}),
  ambience: bank('ambience', 1, {bus: 'ambience', gain: .42, wet: 0, loop: true, pitch: 0}),
  'ambience-road': bank('ambience-road', 1, {bus: 'ambience', gain: .42, wet: 0, loop: true, pitch: 0}),
  'ambience-haunted': bank('ambience-haunted', 1, {bus: 'ambience', gain: .42, wet: 0, loop: true, pitch: 0}),
  tension: bank('tension', 1, {bus: 'ambience', gain: .32, wet: 0, loop: true, pitch: 0}),
  heartbeat: bank('heartbeat', 1, {bus: 'ambience', gain: .4, wet: 0, loop: true, pitch: 0}),
};

export const AUDIO_FILES = [...new Set(Object.values(SOUND_BANKS).flatMap(bank => bank.files))];
export const MAX_VOICES = 28;

export function spatialMix(position, listener = {x: 0, z: 0}, occluded = false) {
  if (!position) return {pan: 0, gain: 1, cutoff: 18000};
  const dx = position.x - listener.x, dz = position.z - listener.z;
  const distance = Math.hypot(dx, dz);
  const gain = Math.max(0, 1 - Math.max(0, distance - 2) / 30) ** 1.6;
  // Matches the isometric camera's screen-right axis, rather than world X.
  return {pan: Math.max(-.88, Math.min(.88, (dx * .837 - dz * .547) / 13)),
    gain: gain * (occluded ? .48 : 1), cutoff: occluded ? 1250 : Math.max(2600, 18000 - distance * 420)};
}

export function ambienceMix({zone = 'ashwick', threat = 0, interior = false, health = 1, ended = false, victory = false} = {}) {
  const danger = ended || victory ? 0 : Math.max(0, Math.min(1, threat));
  const bed = (interior ? .52 : 1) * (1 - danger * .35);
  return {
    ambience: zone === 'ashwick' ? bed * .65 : 0,
    'ambience-road': zone === 'road' ? bed * .8 : 0,
    'ambience-haunted': zone === 'hallowmere' ? bed * (victory ? .35 : .85) : 0,
    tension: danger * .66,
    heartbeat: !ended && health < .3 ? Math.min(.72, (.3 - health) * 3.2) : 0,
  };
}
