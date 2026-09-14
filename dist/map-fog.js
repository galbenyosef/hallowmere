let texture;

// A cached, opaque cloud field covers unknown terrain on both map views.
// Domain-warped noise gives the mist billows and wisps without animated motion.
export function mapFogTexture(){
 if(texture)return texture;
 const size=384;texture=document.createElement('canvas');texture.width=texture.height=size;
 const ctx=texture.getContext('2d'),image=ctx.createImageData(size,size);
 const hash=(x,y)=>{let n=Math.imul(x,374761393)+Math.imul(y,668265263)+4171;n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;};
 const smooth=t=>t*t*(3-2*t),mix=(a,b,t)=>a+(b-a)*t;
 function noise(x,y){const ix=Math.floor(x),iy=Math.floor(y),u=smooth(x-ix),v=smooth(y-iy);return mix(mix(hash(ix,iy),hash(ix+1,iy),u),mix(hash(ix,iy+1),hash(ix+1,iy+1),u),v);}
 function clouds(x,y){let sum=0,weight=.54;for(let i=0;i<5;i++){sum+=noise(x,y)*weight;x=x*2.07+13.1;y=y*2.03+7.8;weight*=.48;}return sum;}
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/size,v=y/size,wx=u*4+noise(u*3+8,v*3)*1.8,wy=v*4+noise(u*3,v*3+19)*1.8;
  const billow=clouds(wx,wy),wisps=1-Math.abs(clouds(wx*1.8+23,wy*1.8)-.52)*2;
  const edge=Math.max(0,1-Math.hypot(u-.5,v-.5)*1.15),light=Math.max(0,Math.min(1,(billow-.2)*1.8))*(.65+edge*.35);
  const i=(y*size+x)*4;
  image.data[i]=12+light*47+wisps*3;
  image.data[i+1]=22+light*55+wisps*4;
  image.data[i+2]=30+light*62+wisps*5;
  image.data[i+3]=255;
 }
 ctx.putImageData(image,0,0);return texture;
}
