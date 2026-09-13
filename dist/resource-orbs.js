// Tidal glass, selected from study 01. Canvas 2D keeps the effect independent
// of the game's WebGL context; the existing CSS liquid is the fallback.
const TAU=Math.PI*2,RADIUS=81;
const clamp=value=>Number.isFinite(value)?Math.max(0,Math.min(1,value)):0;
const random=n=>{const value=Math.sin(n*127.1+311.7)*43758.5453;return value-Math.floor(value);};
const color=(hue,lightness=55,alpha=1)=>`hsla(${hue},90%,${lightness}%,${alpha})`;
function circle(ctx,x,y,r,fill){ctx.beginPath();ctx.arc(x,y,r,0,TAU);if(fill){ctx.fillStyle=fill;ctx.fill();}}
function line(ctx,points,stroke,width){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}
function glow(ctx,x,y,r,hue,alpha){const gradient=ctx.createRadialGradient(x,y,0,x,y,r);gradient.addColorStop(0,color(hue,77,alpha));gradient.addColorStop(.3,color(hue,56,alpha*.65));gradient.addColorStop(1,color(hue,38,0));circle(ctx,x,y,r,gradient);}

function drawTidalGlass({ctx,canvas,hue,value:fill,kick},time){
 const r=RADIUS;
 ctx.setTransform(canvas.width/(r*2),0,0,canvas.height/(r*2),0,0);
 ctx.clearRect(0,0,r*2,r*2);ctx.save();ctx.translate(r,r);
 circle(ctx,0,0,r);ctx.clip();
 const glass=ctx.createRadialGradient(-25,-35,5,0,0,r);glass.addColorStop(0,'#233038');glass.addColorStop(1,'#070b12');circle(ctx,0,0,r,glass);
 // Move the wave completely beyond the lens at 0% and 100%.
 const level=fill<=.001?r+12:fill>=.999?-r-12:r-2*r*fill,points=[];
 for(let x=-r-2;x<=r+2;x+=2)points.push([x,level+(Math.sin(x*.045+time*2.1)+Math.sin(x*.087-time*1.5)*.4)*(2+kick*5)]);
 ctx.save();ctx.beginPath();ctx.moveTo(-r-2,r+2);points.forEach(point=>ctx.lineTo(...point));ctx.lineTo(r+2,r+2);ctx.closePath();ctx.clip();
 const fluid=ctx.createLinearGradient(-r,-r,r,r);fluid.addColorStop(0,color(hue,59));fluid.addColorStop(.4,color(hue,35));fluid.addColorStop(1,color(hue,10));ctx.fillStyle=fluid;ctx.fillRect(-r,-r,2*r,2*r);glow(ctx,-22,35,95,hue,.5);
 ctx.globalCompositeOperation='screen';
 for(let j=0;j<5;j++){const curve=[];for(let x=-r;x<=r;x+=3)curve.push([x,20+j*15+Math.sin(x*.027+time*.8+j)*14]);line(ctx,curve,color(hue,67,.11),9);}
 for(let j=0;j<18;j++){
  const x=(random(j+9)-.5)*145+Math.sin(time+j)*5,y=r-((time*(8+random(j)*12)+random(j+20)*160)%170),size=1+random(j+5)*3;
  circle(ctx,x,y,size);ctx.strokeStyle=color(hue,85,.4);ctx.lineWidth=.7;ctx.stroke();circle(ctx,x-1,y-1,.65,color(hue,92,.7));
 }
 ctx.restore();
 if(fill>.001&&fill<.999){line(ctx,points,color(hue,84,.65),1);line(ctx,points,color(hue,60,.16),5);}
 const shade=ctx.createRadialGradient(-18,-22,30,0,0,r);shade.addColorStop(0,'#0000');shade.addColorStop(.77,'#0000');shade.addColorStop(1,'#000a');circle(ctx,0,0,r,shade);
 const glint=ctx.createRadialGradient(-26,-52,0,-26,-52,31);glint.addColorStop(0,'#ffffff60');glint.addColorStop(1,'#ffffff00');ctx.beginPath();ctx.ellipse(-26,-52,25,9,-.45,0,TAU);ctx.fillStyle=glint;ctx.fill();
 ctx.strokeStyle='#dceef325';ctx.lineWidth=1;circle(ctx,0,0,r-2);ctx.stroke();ctx.restore();
}

export function createResourceOrbs(){
 const motion=matchMedia('(prefers-reduced-motion: reduce)'),surfaces=[];
 for(const [index,selector,hue]of [[0,'.orb.health',350],[1,'.orb.mana',201]]){
  const host=document.querySelector(selector);if(!host)continue;
  const canvas=document.createElement('canvas');canvas.className='orb-effect tidal-glass';canvas.setAttribute('aria-hidden','true');canvas.width=canvas.height=256;
  const surface={index,host,canvas,hue,ctx:null,value:null,target:null,kick:0,lost:false};
  try{surface.ctx=canvas.getContext('2d');}catch{/* Retain the CSS liquid if canvas is unavailable. */}
  if(surface.ctx){
   canvas.addEventListener('contextlost',event=>{event.preventDefault();surface.lost=true;host.classList.remove('effect-ready');});
   canvas.addEventListener('contextrestored',()=>{surface.lost=false;});
   host.prepend(canvas);
  }
  surfaces.push(surface);
 }
 let elapsed=0;
 return {update(dt,health,mana){
  const step=Number.isFinite(dt)?Math.max(0,Math.min(dt,.1)):0,reduced=motion.matches;
  if(!reduced)elapsed+=step;
  for(const surface of surfaces){
   const target=clamp(surface.index===0?health:mana);
   surface.host.parentElement.style.setProperty('--potion-strength',String(.15+target*.85));
   if(surface.value===null||reduced||step===0){surface.value=target;surface.kick=0;}
   else{
    if(target!==surface.target)surface.kick=Math.min(1,Math.max(surface.kick,Math.abs(target-surface.value)*2.8));
    surface.value+=(target-surface.value)*(1-Math.exp(-step*6));surface.kick*=Math.exp(-step*4);
   }
   surface.target=target;
   if(!surface.ctx||surface.lost)continue;
   try{drawTidalGlass(surface,reduced?0:elapsed);surface.host.classList.add('effect-ready');}
   catch{surface.lost=true;surface.host.classList.remove('effect-ready');}
  }
 }};
}
