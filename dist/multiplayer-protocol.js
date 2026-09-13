export const PROTOCOL_VERSION=3;
export const TICK_SECONDS=.05;
export const PLAYER_SPEED=4.9;
export const PLAYER_COLORS=['#55cce6','#eda957','#af93f5','#70d59b','#ef83b1','#e2d873','#93b3ff','#f08b72'];
export const SHARED_KEYS=['questAccepted','villageKills','roadKills','bossSpawned','victory','bossLootClaimed','regionProgress','discoveries','campaignComplete'];
export const finitePoint=p=>!!p&&Number.isFinite(p.x)&&Number.isFinite(p.z);
export function direction(x,z){const length=Math.hypot(x,z);return length>1?{x:x/length,z:z/length}:{x,z};}
export function angleLerp(a,b,t){return a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;}
