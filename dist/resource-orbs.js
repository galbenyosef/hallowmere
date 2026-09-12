// Small, self-contained GPU surfaces; CSS liquid remains available if WebGL fails.
const vertex = `attribute vec2 position;
varying vec2 uv;
void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}`;
const fragment = `precision mediump float;
varying vec2 uv;
uniform float time, fill, energy;
uniform vec3 deepColor, brightColor;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float flow(vec2 p){return noise(p)*.57+noise(p*2.03)*.28+noise(p*4.01)*.15;}
void main(){
 vec2 p=uv*2.-1.;float r=length(p);
 float lens=sqrt(max(0.,1.-dot(p,p)));
 vec2 q=uv+ p*(1.-lens)*.08;
 float t=time*.58;
 // Leave a little headroom at capacity so the free surface is always visible.
 float wave=(sin(q.x*7.5+t*2.6)*.026+sin(q.x*16.-t*1.8)*.009)*(1.+energy*2.);
 float level=mix(-.06,.91,fill)+wave;
 float depth=level-q.y;
 float liquid=(1.-smoothstep(-.004,.004,-depth))*step(.001,fill);
 // Broad, advected currents with refracted light rather than fine smoky veins.
 vec2 current=vec2(sin(q.y*5.+t)*.18,cos(q.x*6.-t*.8)*.12);
 vec2 drift=q*2.8+current+vec2(t*.18,-t*.26);
 float silk=flow(drift+flow(drift+2.)*.65);
 float caustic=pow(1.-abs(sin((q.x+current.x)*9.+(q.y+current.y)*6.+t)),9.);
 vec3 color=mix(deepColor,brightColor,.28+silk*.65);
 color*=.65+.65*lens;
 color+=brightColor*caustic*.16*smoothstep(.02,.18,depth);
 color+=brightColor*exp(-length((p-vec2(-.2,-.48))*vec2(1.5,1.8))*2.)*.85;
 // A curved, translucent surface and a crisp wet edge catch the light.
 float surfaceWidth=.018+.046*sqrt(max(0.,1.-p.x*p.x));
 float surface=exp(-pow((depth-surfaceWidth*.35)/surfaceWidth,2.))*liquid;
 float meniscus=exp(-abs(depth)*220.)*step(.001,fill);
 color=mix(color,brightColor*.85+vec3(.13,.17,.2),surface*.48);
 color+=brightColor*exp(-abs(depth)*28.)*.3;
 color+=(brightColor*.7+vec3(.4,.45,.5))*meniscus*.8;
 for(int i=0;i<10;i++){
  float seed=float(i);float speed=.055+hash(vec2(seed,2.))*.075;
  vec2 b=vec2(.12+hash(vec2(seed,8.))*.76,fract(hash(vec2(seed,4.))+time*speed));
  b.x+=sin(time*.9+seed*3.+b.y*8.)*.025;
  float size=.009+hash(vec2(seed,6.))*.014;
  float d=length(q-b);
  float bubble=exp(-abs(d-size)*550.)*.32+exp(-length(q-b-vec2(-.004,.006))*400.)*.7;
  color+=brightColor*bubble*(1.-smoothstep(level-.04,level,b.y));
 }
 vec3 empty=vec3(.014,.022,.031)+vec3(.025,.035,.043)*lens;
 empty+=brightColor*exp(-abs(depth)*24.)*.12*step(.001,fill);
 color=mix(empty,color,liquid);
 float rim=pow(r,9.)*.4;
 color+=mix(vec3(.28,.36,.4),brightColor,.3)*rim;
 float gleam=exp(-length((p-vec2(-.38,.52))*vec2(5.,2.8))*2.);
 color+=vec3(.8,.9,1.)*gleam*.5;
 gl_FragColor=vec4(color,1.-smoothstep(.985,1.,r));
}`;

export function createResourceOrbs() {
 const motion=matchMedia('(prefers-reduced-motion: reduce)');
 const surfaces=[];
 for(const [selector,deep,bright] of [
  ['.orb.health',[.19,.007,.035],[1.,.16,.23]],
  ['.orb.mana',[.008,.045,.17],[.12,.7,1.]],
 ]) {
  const host=document.querySelector(selector),canvas=document.createElement('canvas');
  canvas.className='orb-shader';canvas.setAttribute('aria-hidden','true');
  canvas.width=canvas.height=256;
  host.parentElement.style.setProperty('--potion-strength','1');
  const gl=canvas.getContext('webgl',{alpha:true,antialias:false,depth:false,stencil:false,premultipliedAlpha:false});
  if(!gl)continue;
  try {
   const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));return shader;};
   const program=gl.createProgram(),vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment);
   gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
   if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
   gl.useProgram(program);const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
   const position=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
   const uniform=name=>gl.getUniformLocation(program,name);
   gl.uniform3fv(uniform('deepColor'),deep);gl.uniform3fv(uniform('brightColor'),bright);
   const surface={gl,host,canvas,time:uniform('time'),fill:uniform('fill'),energy:uniform('energy'),value:null,kick:0,lost:false};
   canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();surface.lost=true;host.classList.remove('shader-ready');});
   canvas.addEventListener('webglcontextrestored',()=>{ // Retain the readable CSS fallback after a context reset.
    surface.lost=true;host.classList.remove('shader-ready');
   });
   host.prepend(canvas);surfaces.push(surface);
  } catch(error) {console.warn('Resource shader unavailable; using CSS liquid.',error);gl.getExtension('WEBGL_lose_context')?.loseContext();}
 }
 let elapsed=0;
 return {
  update(dt,health,mana) {
   if(!motion.matches)elapsed+=dt;
   surfaces.forEach((surface,index)=>{
    const target=Math.max(0,Math.min(1,index===0?health:mana));
    surface.host.parentElement.style.setProperty('--potion-strength',String(.15+target*.85));
    if(surface.lost)return;
    if(surface.value===null)surface.value=target;
    surface.kick=Math.max(surface.kick,Math.abs(target-surface.value)*2.);
    surface.value=motion.matches?target:surface.value+(target-surface.value)*(1-Math.exp(-dt*8));
    surface.kick*=Math.exp(-dt*3);
    const gl=surface.gl;gl.uniform1f(surface.time,motion.matches?0:elapsed+index*13);gl.uniform1f(surface.fill,surface.value);gl.uniform1f(surface.energy,motion.matches?0:surface.kick);
    gl.drawArrays(gl.TRIANGLES,0,6);surface.host.classList.add('shader-ready');
   });
  },
 };
}
