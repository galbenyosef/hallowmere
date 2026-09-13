// Shared combat definitions used by the server, selection screen, HUD, and inventory.
const ability=(name,kind,cooldown,cost,description,options={})=>({name,kind,cooldown,cost,description,...options});
const draught=ability('Draught','heal',1,0,'Restore up to 65 vitality. Consumes one healing draught.');
const evade=(name,cooldown=1.9)=>ability(name,'dodge',cooldown,0,'Evade in your movement direction with brief invulnerability.');
export const SORCERER_APPEARANCES={C01:{id:'C01',name:'Sorcerer',weapon:'Crystal-tipped staff',focus:'Spellbook',color:'#88cfdb'},W06:{id:'W06',name:'Mire Witch',weapon:'Gnarled root staff',focus:'Marsh lantern',color:'#bed184'},W07:{id:'W07',name:'Bone Oracle',weapon:'Skull-topped staff',focus:'Spirit skull',color:'#a6d9bd'},W10:{id:'W10',name:'Storm Hermit',weapon:'Lightning fork staff',focus:'Storm orb',color:'#adcaef'}};
export const CLASSES={
 sorcerer:{id:'sorcerer',concept:'C01',name:'Sorcerer',role:'Ranged · elemental control',description:'Keep your distance, hurl blazing fireballs, and blanket the road with an elemental storm.',hp:110,mana:120,regen:9,speed:4.8,color:'#88cfdb',weapon:'Crystal-tipped staff',weaponType:'staff',focus:'Spellbook',abilities:{
  attack:ability('Arcane Bolt','projectile',.60,0,'Fire a ranged arcane projectile.',{damage:26,range:11,speed:17,projectile:'arcane',magic:true}),
  bolt:ability('Fireball','projectile',1.2,18,'Hurl a large fireball. Grazing an enemy counts as a hit and bursts on impact.',{damage:46,range:35,speed:14,hitRadius:.4,projectile:'ember',color:'#ff902e',magic:true}),dodge:evade('Miststep',2.2),
  nova:ability('Elemental Storm','zone',9,38,'Call a three-second storm at your aim point.',{damage:13,radius:3.4,duration:3,interval:.5,range:8,magic:true}),heal:draught}},
 ranger:{id:'ranger',concept:'C02',name:'Ranger',role:'Ranged · precision',description:'Cut through foes with piercing arrows and punish clustered enemies with a focused rain of arrows.',hp:125,mana:100,regen:7,speed:5.2,color:'#b6ca87',weapon:'Yew longbow',weaponType:'longbow',focus:'Quiver of barbed arrows',abilities:{
  attack:ability('Quickshot','projectile',.58,0,'Loose an arrow at a distant enemy.',{damage:25,range:13,speed:23,projectile:'arrow'}),
  bolt:ability('Piercing Shot','projectile',2.8,20,'Fire a powerful arrow that pierces up to four enemies.',{damage:48,range:16,speed:26,pierce:4,projectile:'arrow'}),dodge:evade('Hunter’s Roll',1.7),
  nova:ability('Arrow Rain','zone',8,32,'Rain arrows onto your aim point for three seconds.',{damage:15,radius:3.1,duration:3,interval:.5,range:10}),heal:draught}},
 reaver:{id:'reaver',concept:'C03',name:'Reaver',role:'Melee · fury',description:'Trade speed for reach and resilience. Bleed enemies with your axe, then whirl through the pack.',hp:180,mana:80,regen:6,speed:4.6,color:'#e3a178',weapon:'Two-handed war axe',weaponType:'war axe',focus:'Fury talisman',abilities:{
  attack:ability('Rend','melee',.68,0,'Sweep your axe in a wide arc and inflict bleeding.',{damage:34,range:3.1,arc:2.3,dot:{damage:4,duration:3,interval:.75,type:'bleed'}}),
  bolt:ability('War Cry','burst',7,22,'Stagger nearby enemies and take 35% less damage for four seconds.',{damage:0,radius:4,root:1,guard:.35,duration:4}),dodge:evade('Rush',2.1),
  nova:ability('Blood Whirl','zone',8,35,'Spin your axe around you for 2.4 seconds while moving.',{damage:19,radius:3,duration:2.4,interval:.4,follow:true}),heal:draught}},
 nightblade:{id:'nightblade',concept:'C04',name:'Nightblade',role:'Melee · assassination',description:'Land swift paired strikes, throw a fan of knives, and disappear into smoke to reposition.',hp:115,mana:100,regen:8,speed:5.6,color:'#c1a0d0',weapon:'Paired hooked daggers',weaponType:'daggers',focus:'Throwing knives',abilities:{
  attack:ability('Twin Cut','melee',.48,0,'Strike twice. Hits from behind deal 50% extra damage.',{damage:16,range:2.35,arc:1.7,hits:2,backstab:1.5}),
  bolt:ability('Knife Fan','projectile',2.2,18,'Throw three knives in a narrow fan.',{damage:20,range:9,speed:21,projectile:'knife',count:3,spread:.18}),
  dodge:ability('Shadowstep','dodge',2.4,0,'Step behind a nearby enemy on a clear path, or evade in your movement direction.',{shadowstep:true,range:5.5}),
  nova:ability('Smoke Veil','zone',9,30,'Create four seconds of smoke that conceals allies and slows enemies.',{damage:0,radius:3.5,duration:4,interval:.3,conceal:true,slow:.5}),heal:draught}},
 oathkeeper:{id:'oathkeeper',concept:'C05',name:'Oathkeeper',role:'Melee · protection',description:'Hold the line with mace and shield. Protect yourself with Aegis and shelter your allies in Sanctuary.',hp:190,mana:100,regen:6,speed:4.2,color:'#e4cf8e',weapon:'Lantern mace',weaponType:'mace',focus:'Kite shield',abilities:{
  attack:ability('Consecrated Strike','melee',.65,0,'Smite enemies in front of you, restoring 5 vitality per enemy struck.',{damage:30,range:2.7,arc:1.9,leech:5,magic:true}),
  bolt:ability('Aegis','shield',6,20,'Raise a ward that absorbs 40 damage for four seconds.',{shield:40,duration:4}),dodge:evade('Pilgrim’s Step',2.3),
  nova:ability('Sanctuary','zone',10,35,'Bless the ground for four seconds, healing allies and reducing damage by 20%.',{damage:5,heal:6,guard:.2,radius:4.2,duration:4,interval:.5,magic:true}),heal:draught}},
 alchemist:{id:'alchemist',concept:'C09',name:'Plague Alchemist',role:'Ranged · affliction',description:'Coat the battlefield in poison, fire your hand crossbow, and shatter remedies to aid nearby allies.',hp:130,mana:110,regen:8,speed:4.8,color:'#c0d78e',weapon:'Hand crossbow',weaponType:'crossbow',focus:'Alchemical flask',abilities:{
  attack:ability('Virulent Bolt','projectile',.66,0,'Fire a bolt that poisons its target for three seconds.',{damage:19,range:10,speed:19,projectile:'venom',dot:{damage:4,duration:3,interval:.75,type:'poison'}}),
  bolt:ability('Bitter Remedy','burst',5,22,'Shatter a flask at your aim point, damaging enemies and healing allies for 25 vitality.',{damage:24,heal:25,radius:2.6,range:7,magic:true}),dodge:evade('Quickstep',1.9),
  nova:ability('Miasma','zone',9,35,'Release a four-second poison cloud that damages and slows enemies.',{damage:8,radius:3.7,duration:4,interval:.5,range:7,slow:.4,magic:true}),heal:draught}}
};
export const CLASS_LIST=Object.values(CLASSES);
// Compatibility for a session that has not chosen a class yet.
const legacy={id:'warden',name:'Warden',role:'Oathbound',hp:140,mana:100,regen:7,speed:4.9,color:'#88cfdb',weapon:'Warden’s longsword',weaponType:'sword',focus:'Shield',abilities:{attack:ability('Cleave','melee',.48,0,'Sweep your blade.',{damage:28,range:2.9,arc:2.1}),bolt:ability('Emberbolt','projectile',1.2,18,'Hurl a firebolt.',{damage:46,range:35,speed:14,projectile:'ember',magic:true}),dodge:evade('Evade'),nova:ability('Cinder nova','burst',6,35,'Burn nearby enemies.',{damage:62,radius:4.6,root:.7,magic:true}),heal:draught}};
export const classFor=state=>CLASSES[state?.classId]||legacy;
export const abilitiesFor=state=>classFor(state).abilities;
export const classAppearance=(classId,appearanceId)=>classId==='sorcerer'?(SORCERER_APPEARANCES[appearanceId]||SORCERER_APPEARANCES.C01):null;
export const conceptFor=(classId,appearanceId)=>classAppearance(classId,appearanceId)?.id||CLASSES[classId]?.concept||'warden';
export const classColor=state=>classAppearance(state?.classId,state?.appearanceId)?.color||classFor(state).color;
export const primaryDamage=state=>classFor(state).abilities.attack.damage+(state.level||1)*2+(state.damageBonus||0);
export function applyClass(state,classId,appearanceId){
 const definition=Object.hasOwn(CLASSES,classId)?CLASSES[classId]:null;if(!definition)return false;
 if(classId==='sorcerer'&&!Object.hasOwn(SORCERER_APPEARANCES,appearanceId))return false;
 if(classId!=='sorcerer'&&appearanceId!==undefined&&appearanceId!==null&&appearanceId!==definition.concept)return false;
 const hpRatio=state.maxHp?state.hp/state.maxHp:1,manaRatio=state.maxMana?state.mana/state.maxMana:1;
 Object.assign(state,{classId,appearanceId:classId==='sorcerer'?appearanceId:definition.concept,baseHp:definition.hp,maxHp:definition.hp+((state.level||1)-1)*15+(state.healthBonus||0),maxMana:definition.mana,shield:0,shieldTime:0,guard:0,guardTime:0,concealed:0});
 state.hp=Math.max(0,Math.min(state.maxHp,state.maxHp*hpRatio));state.mana=Math.min(state.maxMana,state.maxMana*manaRatio);return true;
}
export function weaponForClass(item,state){
 if(item.slot!=='weapon'||!CLASSES[state.classId])return item;
 const c=CLASSES[state.classId],appearance=classAppearance(state.classId,state.appearanceId);
 const prefix={'iron-falchion':'Roadwarden','cinder-blade':'Cindersteel','bellkeeper-edge':'Bellkeeper’s Requiem ·','rootbound-edge':'Rootbound ·','quarry-edge':'Blackvein ·','regent-edge':'Crownfall ·'}[item.template];
 return {...item,weaponType:c.weaponType,name:prefix?`${prefix} ${c.weaponType}`:appearance?.weapon||c.weapon,description:item.template==='wardens-sword'?`The ${c.name.toLowerCase()}’s starting weapon. ${appearance?.focus||c.focus} accompanies it.`:item.description};
}
