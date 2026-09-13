// Production version of sound-audition.html's selected set 04. First takes retain
// the exact 24 kHz audition recipe; only delivery encoding and the game mixer differ.
export const WITCHGLASS_RATE = 24000;
export const WITCHGLASS_CUES = Object.fromEntries([
  ['sword','sweep',210,.30,.9], ['impact','hit',115,.30,.6],
  ['ember','rise',290,.65,.9], ['ember-hit','hit',175,.48,.9], ['nova','burst',72,1.05,.8],
  ['dodge','sweep',130,.35,.35], ['hurt','hit',87,.37,.3],
  ['death-player','fall',67,1.55,.3], ['heal','reward',330,1.05,.6],
  ['voice-hollow','voice',83,.95,.5], ['death','fall',80,1.10,.5],
  ['voice-hound','voice',125,.65,.8], ['death-hound','fall',138,.80,.8],
  ['voice-revenant','voice',190,1.20,.45], ['death-revenant','fall',175,1.45,.45],
  ['roar','voice',48,1.75,.55], ['boss-windup','rise',74,1.30,.65],
  ['boss-slam','burst',43,1.15,.6], ['death-boss','fall',48,2.25,.65],
  ['pickup','reward',720,.30,.9], ['relic','reward',220,1.80,.8],
  ['equip','double',285,.35,.8], ['levelup','reward',277,1.55,.7],
  ['ui-open','rise',400,.18,.35], ['ui-close','fall',350,.18,.3],
  ['step','step',130,.16,.8], ['step-dirt','step',85,.18,.2], ['step-wood','step',185,.21,.5],
  ['door','double',77,.95,.6], ['bell','bell',130,2.10,.7],
  ['whisper','air',300,1.55,.7], ['creak','rise',122,1.10,.35],
  ['ambience','bed',62,5.50,.25], ['ambience-road','bed',49,5.50,.5],
  ['ambience-haunted','bed',37,5.50,.75], ['tension','pulse',55,5.50,.7], ['heartbeat','heart',48,4.50,.2],
].map(([id,kind,hz,duration,brightness])=>[id,{kind,hz,duration,brightness}]));

export const WITCHGLASS_LOOPS = {ambience:18, 'ambience-road':21, 'ambience-haunted':25, tension:14, heartbeat:5.1};
const RATE=WITCHGLASS_RATE, TAU=Math.PI*2, sin=Math.sin, exp=Math.exp;
const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
function hash(text){let seed=2166136261;for(const char of text)seed=Math.imul(seed^char.charCodeAt(0),16777619);return seed>>>0;}
function random(seed){return()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/2147483648-1;};}

// Crossfade a wrap with overlapping source material, then match the endpoints.
// Unlike looping the audition excerpts, this has no fade to silence at the seam.
function seamless(data,overlapSeconds){
  const overlap=Math.round(overlapSeconds*RATE),length=data.length-overlap;
  const out=new Float32Array(length);out.set(data.subarray(overlap,length));
  for(let i=0;i<overlap;i++){
    const fade=.5-.5*Math.cos(Math.PI*i/(overlap-1));
    out[length-overlap+i]=data[length+i]*(1-fade)+data[i]*fade;
  }
  const delta=out[length-1]-out[0],blend=Math.round(.005*RATE);
  for(let i=0;i<blend;i++){const u=i/(blend-1);out[length-blend+i]-=delta*u*u*(3-2*u);}
  return out;
}

export function renderWitchglass(cueId,{variant=0,loop=false,channel=0}={}){
  const cue=WITCHGLASS_CUES[cueId];
  if(!cue||!Number.isInteger(variant)||variant<0||variant>3||![0,1].includes(channel))throw Error('Invalid Witchglass cue or take');
  if(loop&&!WITCHGLASS_LOOPS[cueId])throw Error(`Not a Witchglass loop: ${cueId}`);
  const {kind,hz,duration,brightness:b}=cue,bed=['bed','pulse','heart'].includes(kind);
  // Heartbeat stays on its .85-second cadence. Atmosphere gets long stereo motion.
  const overlap=kind==='heart'?.85:1.5,d=loop?WITCHGLASS_LOOPS[cueId]+overlap:duration;
  const f=hz*[1,.987,1.018,.973][variant]*(channel?1.002:1);
  const noise=random(hash('04'+cueId+(variant?`:take:${variant}`:'')+(channel?':right':'')));
  let data=new Float32Array(Math.ceil((d+(loop?0:bed?.12:.70))*RATE));
  let low=0,mid=0,phase=channel?.173:0;const dark=.018+b*.065;
  for(let i=0;i<Math.ceil(d*RATE);i++){
    const t=i/RATE,u=t/d,n=noise();low+=dark*(n-low);mid+=(.15+b*.3)*(n-mid);
    let envelope=exp(-5*u),pitch=f*(1+.3*exp(-20*u)),activity=1;
    if(kind==='sweep'){envelope=sin(Math.PI*u)**1.6;pitch=f*(2.8-2.1*u);}
    if(kind==='hit'||kind==='step'||kind==='burst'){envelope=exp(-(kind==='burst'?3.8:6)*u);pitch=f*(1+1.6*exp(-30*u));}
    if(kind==='rise'){envelope=sin(Math.PI*u)**.8;pitch=f*(.55+1.6*u);}
    if(kind==='fall'){envelope=(1-u)**1.5;pitch=f*(1.3-.95*u);}
    if(kind==='double'){envelope=exp(-14*u)+(u>.3?.7*exp(-13*(u-.3)):0);pitch=f*(1.2-.5*u);}
    if(kind==='reward'){const note=Math.min(3,Math.floor(u*4)),local=(u*4)%1;pitch=f*[1,1.1892,1.4983,2][note];envelope=(.3+.7*exp(-5*local))*(1-u*.65);}
    if(kind==='bell'){pitch=f;envelope=exp(-3*u);}
    if(kind==='voice'){activity=.5+.5*sin(TAU*(cueId.includes('hound')?9:5)*t+2*sin(13*t))**2;envelope=sin(Math.PI*u)**.55*activity;pitch=f*(1+.12*sin(19*t)+.08*sin(47*t));}
    if(kind==='air'){envelope=sin(Math.PI*u)**1.2;pitch=f*(.8+.3*sin(7*t));}
    if(bed){envelope=loop?1:clamp(t/.35,0,1)*clamp((d-t)/.5,0,1);pitch=f*(1+.03*sin(t*1.4));}
    if(kind==='pulse')envelope*=.25+.75*sin(TAU*1.8*t)**6;
    if(kind==='heart'){const beat=t%.85;envelope*=exp(-beat*36)+(beat>.21?.65*exp(-(beat-.21)*42):0);}
    phase+=pitch/RATE;const p=phase*TAU,edge=kind==='sweep'||kind==='air';
    // Takes vary shard resonance, FM depth, fragment rhythm, and excitation seed.
    const shimmer=sin(p*[3.93,3.91,3.97,3.94][variant]+[1.8,1.95,1.64,2.05][variant]*sin(p*1.414)*exp(-2*u));
    let value=.25*sin(p)+.55*shimmer*exp(-1.4*u)+.24*sin(p*7.13)*exp(-4*u);
    value+=.14*sin(p*10.7)*sin([63,58,69,61][variant]*t)**8+mid*.4*exp(-80*t);if(edge)value+=mid*.7;
    if(kind==='air')value=value*.25+mid*(.5+.5*sin(21*t)**2);
    if(kind==='step')value*=cueId==='step-dirt'?.7:1;
    data[i]=value*envelope*(loop?1:clamp(t/.004,0,1)*clamp((d-t)/.025,0,1));
  }
  if(!bed){
    const dry=data.slice();
    for(let tap=1;tap<=5;tap++){
      const offset=Math.round(.079*tap*RATE),level=.42**tap;
      for(let i=offset;i<data.length;i++)data[i]+=dry[i-offset]*level;
    }
  }
  let dc=0;
  for(let i=0;i<data.length;i++){
    dc+=.004*(data[i]-dc);data[i]-=dc;
    if(!loop)data[i]*=clamp(i/(RATE*.003),0,1)*clamp((data.length-1-i)/(RATE*.025),0,1);
  }
  if(loop)data=seamless(data,overlap);
  let square=0,peak=0;
  for(const value of data){square+=value*value;peak=Math.max(peak,Math.abs(value));}
  const target=bed?.052:kind==='step'?.08:kind==='burst'?.15:.115;
  const scale=Math.min(target/Math.max(1e-8,Math.sqrt(square/data.length)),.56/Math.max(1e-8,peak));
  for(let i=0;i<data.length;i++)data[i]*=scale;
  return data;
}
