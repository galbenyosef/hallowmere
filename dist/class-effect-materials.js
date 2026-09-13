import * as T from './vendor/three.core.js';

const vertexShader=`varying vec2 vUv; varying vec3 vLocal; varying vec3 vNormal; varying vec3 vView;
void main(){vUv=uv;vLocal=position;vNormal=normalize(normalMatrix*normal);
 vec4 view=modelViewMatrix*vec4(position,1.0);vView=-view.xyz;gl_Position=projectionMatrix*view;}`;
const noise=`float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
 return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){return noise(p)*.57+noise(p*2.03)*.28+noise(p*4.07)*.15;}`;
const fragments={
 trail:`float x=vUv.x,y=(vUv.y-.5)*2.0;
 float wake=sin(x*21.0-time*14.0)*.12*(1.0-x);
 float spine=exp(-abs(y-wake)*45.0),silk=exp(-abs(y+wake)*13.0)*.35;
 float taper=smoothstep(0.0,.35,x)*(1.0-smoothstep(.97,1.0,x));
 gl_FragColor=vec4(mix(color,hot,spine*.8),taper*(spine+silk)*opacity);`,
 ground:`vec2 p=vUv*2.0-1.0;float r=length(p),a=atan(p.y,p.x);
 float boundary=1.0-smoothstep(.94,1.0,r);
 float ring=exp(-abs(r-.93)*150.0)+exp(-abs(r-.82)*190.0)*.35;
 float runes=pow(max(0.0,cos(a*12.0)),18.0)*(1.0-smoothstep(.018,.035,abs(r-.875)));
 float flow=fbm(p*5.0+vec2(time*.18,-time*.13));
 float field=(1.0-smoothstep(.1,1.0,r))*(.05+flow*.12);
 if(style>1.5&&style<3.5){field=(1.0-smoothstep(.55,1.0,r))*smoothstep(.28,.8,flow)*.42;ring*=.18;runes=0.0;}
 if(style<.5){ring*=.55;runes*=.35;field*=.5;}
 gl_FragColor=vec4(mix(color,hot,clamp(ring+runes,0.0,1.0)*.55),(ring*.6+runes*.6+field)*boundary*opacity);`,
 wave:`vec2 p=vUv*2.0-1.0;float r=length(p),a=atan(p.y,p.x);
 float edge=exp(-abs(r-.84)*65.0),ripple=exp(-abs(r-.7)*38.0)*.25;
 float fractures=.65+.35*sin(a*19.0+sin(a*7.0)*2.0);
 gl_FragColor=vec4(mix(color,hot,edge*.6),(edge+ripple)*fractures*opacity);`,
 cloud:`float rim=pow(1.0-abs(dot(normalize(vNormal),normalize(vView))),1.4);
 float f=fbm(vUv*vec2(9.0,6.0)+vec2(time*.12,-time*.25));
 float density=smoothstep(.18,.82,f)*(1.0-rim)*opacity;
 float light=smoothstep(-.6,.9,vLocal.y)*.45+.15;
 gl_FragColor=vec4(mix(color*.13,color,light)+hot*pow(f,5.0)*.14,density*.65);`,
 shadow:`float r=length((vUv-.5)*2.0);float shade=pow(max(0.0,1.0-r*r),2.5);
 gl_FragColor=vec4(vec3(.015,.018,.025),shade*opacity);`,
 ward:`float rim=pow(1.0-abs(dot(normalize(vNormal),normalize(vView))),2.4);
 vec2 grid=vUv*vec2(24.0,16.0);grid.x+=mod(floor(grid.y),2.0)*.5;
 vec2 cell=abs(fract(grid)-.5);float seams=smoothstep(.44,.49,max(cell.x,cell.y));
 float scan=exp(-abs(fract(vUv.y-time*.14)-.5)*65.0);
 float sign=pow(max(0.0,cos(vUv.x*18.84956)),30.0)*exp(-abs(vUv.y-.5)*35.0);
 gl_FragColor=vec4(mix(color,hot,clamp(rim+scan,0.0,1.0)),(.035+rim*.55+seams*.11+scan*.2+sign*.25)*opacity);`,
 flame:`float y=vUv.y,x=(vUv.x-.5)*2.0;
 float f=fbm(vec2(x*5.0,y*6.0-time*3.0));
 float width=(1.0-y)*(.7+f*.5);
 float edge=1.0-smoothstep(width*.2,width+.01,abs(x+sin(y*9.0-time*4.0)*y*.2));
 float heat=pow(1.0-y,2.0)*edge;
 gl_FragColor=vec4(mix(color,hot,heat),edge*smoothstep(0.0,.12,y)*(1.0-smoothstep(.65,1.0,y))*opacity);`,
 mote:`float d=length(gl_PointCoord-.5)*2.0;float core=exp(-d*d*12.0);
 gl_FragColor=vec4(mix(color,hot,core),exp(-d*d*5.0)*(1.0-smoothstep(.6,1.0,d))*opacity);`
};

// Procedural materials need no downloaded textures. Smoke and contact shadows use
// normal blending; only emitted light is additive, preserving ground readability.
export function effectMaterial(kind,color,hot=0xf1fff4,{style=0,opacity=1}={}){
 const points=kind==='mote';
 return new T.ShaderMaterial({name:`class-${kind}`,transparent:true,depthWrite:false,
  blending:['cloud','shadow'].includes(kind)?T.NormalBlending:T.AdditiveBlending,
  side:kind==='cloud'||kind==='ward'?T.FrontSide:T.DoubleSide,toneMapped:false,fog:false,
  uniforms:{time:{value:0},opacity:{value:opacity},color:{value:new T.Color(color)},hot:{value:new T.Color(hot)},style:{value:style}},
  vertexShader:points?'void main(){gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);gl_PointSize=5.0;}':vertexShader,
  fragmentShader:`${points?'':'varying vec2 vUv; varying vec3 vLocal; varying vec3 vNormal; varying vec3 vView;'}
   uniform float time; uniform float opacity; uniform float style; uniform vec3 color; uniform vec3 hot;
   ${noise} void main(){${fragments[kind]}}`
 });
}
