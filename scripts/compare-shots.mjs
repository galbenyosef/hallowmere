// Pixel diff for the refactor visual baseline; PNG decode/encode via node:zlib only.
// Usage: bash scripts/node22.sh node scripts/compare-shots.mjs <a.png> <b.png> [--threshold .002] [--tolerance 8] [--diff out.png]
//        bash scripts/node22.sh node scripts/compare-shots.mjs --dir <baselineDir> <candidateDir> [--threshold .002] [--diff-dir dir]
// A pixel "differs" when any channel differs by more than --tolerance. Exits 1 when a ratio exceeds --threshold.
// --dir skips *.canvas.png (live WebGL frames, never byte-stable); pass --include-canvas to compare them anyway.
// Reporting tool only: never wired into `npm test`.
import {readFile, readdir, writeFile, mkdir} from 'node:fs/promises';
import {inflateSync, deflateSync} from 'node:zlib';
import {basename, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const SIGNATURE=Buffer.from([137,80,78,71,13,10,26,10]);
const CRC_TABLE=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
const crc32=buffer=>{let c=0xffffffff;for(const byte of buffer)c=CRC_TABLE[(c^byte)&0xff]^(c>>>8);return (c^0xffffffff)>>>0;};
const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};

export function decodePng(buffer){
 if(!buffer.subarray(0,8).equals(SIGNATURE))throw Error('Not a PNG file');
 let offset=8,header=null;const parts=[];
 while(offset<buffer.length){
  const length=buffer.readUInt32BE(offset),type=buffer.toString('ascii',offset+4,offset+8),data=buffer.subarray(offset+8,offset+8+length);
  if(type==='IHDR')header={width:buffer.readUInt32BE(offset+8),height:buffer.readUInt32BE(offset+12),depth:data[8],color:data[9],compression:data[10],filter:data[11],interlace:data[12]};
  else if(type==='IDAT')parts.push(data);
  else if(type==='IEND')break;
  offset+=length+12;
 }
 if(!header)throw Error('PNG has no IHDR');
 if(header.depth!==8||![2,6].includes(header.color)||header.interlace!==0)throw Error(`Unsupported PNG (depth ${header.depth}, colour type ${header.color}, interlace ${header.interlace}); expected 8-bit RGB/RGBA, non-interlaced`);
 const channels=header.color===6?4:3,{width,height}=header,stride=width*channels;
 const raw=inflateSync(Buffer.concat(parts)),pixels=Buffer.alloc(stride*height);
 for(let y=0;y<height;y++){
  const filter=raw[y*(stride+1)],line=raw.subarray(y*(stride+1)+1,y*(stride+1)+1+stride),row=pixels.subarray(y*stride,(y+1)*stride);
  const previous=y?pixels.subarray((y-1)*stride,y*stride):null;
  for(let x=0;x<stride;x++){
   const left=x>=channels?row[x-channels]:0,up=previous?previous[x]:0,upLeft=previous&&x>=channels?previous[x-channels]:0;
   const value=line[x];
   row[x]=(filter===0?value:filter===1?value+left:filter===2?value+up:filter===3?value+((left+up)>>1):filter===4?value+paeth(left,up,upLeft):(()=>{throw Error(`Unknown PNG filter ${filter}`);})())&0xff;
  }
 }
 return {width,height,channels,pixels};
}

export function encodePng({width,height,pixels}){
 const stride=width*3,raw=Buffer.alloc((stride+1)*height);
 for(let y=0;y<height;y++){raw[y*(stride+1)]=0;pixels.copy(raw,y*(stride+1)+1,y*stride,(y+1)*stride);}
 const chunk=(type,data)=>{
  const out=Buffer.alloc(data.length+12);
  out.writeUInt32BE(data.length,0);out.write(type,4,'ascii');data.copy(out,8);
  out.writeUInt32BE(crc32(out.subarray(4,8+data.length)),8+data.length);return out;
 };
 const ihdr=Buffer.alloc(13);
 ihdr.writeUInt32BE(width,0);ihdr.writeUInt32BE(height,4);ihdr[8]=8;ihdr[9]=2;
 return Buffer.concat([SIGNATURE,chunk('IHDR',ihdr),chunk('IDAT',deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);
}

export function compare(a,b,{tolerance=8}={}){
 if(a.width!==b.width||a.height!==b.height)throw Error(`Size mismatch: ${a.width}x${a.height} vs ${b.width}x${b.height}`);
 const total=a.width*a.height;let differing=0,minX=Infinity,minY=Infinity,maxX=-1,maxY=-1;
 const mask=new Uint8Array(total);
 for(let y=0;y<a.height;y++)for(let x=0;x<a.width;x++){
  const ai=(y*a.width+x)*a.channels,bi=(y*b.width+x)*b.channels;let different=false;
  for(let c=0;c<Math.min(a.channels,b.channels);c++)if(Math.abs(a.pixels[ai+c]-b.pixels[bi+c])>tolerance){different=true;break;}
  if(!different)continue;
  mask[y*a.width+x]=1;differing++;
  if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;
 }
 return {width:a.width,height:a.height,total,differing,ratio:differing/total,mask,
  box:maxX<0?null:{x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1}};
}

export function diffImage(a,result){
 const pixels=Buffer.alloc(a.width*a.height*3);
 for(let i=0;i<a.width*a.height;i++){
  const source=i*a.channels,target=i*3;
  if(result.mask[i]){pixels[target]=255;pixels[target+1]=32;pixels[target+2]=48;continue;}
  for(let c=0;c<3;c++)pixels[target+c]=Math.round(a.pixels[source+c]*.35+255*.2);
 }
 return encodePng({width:a.width,height:a.height,pixels});
}

const read=async file=>decodePng(await readFile(file));
const pct=ratio=>`${(ratio*100).toFixed(4)}%`;

async function comparePair(aFile,bFile,{tolerance,diff}){
 const a=await read(aFile),b=await read(bFile),result=compare(a,b,{tolerance});
 if(diff){await mkdir(resolve(diff,'..'),{recursive:true});await writeFile(diff,diffImage(a,result));}
 return {a,b,result};
}

async function main(){
 const args=process.argv.slice(2);
 const value=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
 const tolerance=Number(value('--tolerance',8)),threshold=Number(value('--threshold',.002));
 const positional=[];
 for(let i=0;i<args.length;i++){
  if(args[i]==='--dir'||args[i]==='--include-canvas')continue;
  if(['--tolerance','--threshold','--diff','--diff-dir'].includes(args[i])){i++;continue;}
  positional.push(args[i]);
 }
 if(args.includes('--dir')){
  const [baseDir,candidateDir]=positional.map(p=>resolve(p));
  if(!candidateDir)throw Error('Usage: --dir <baselineDir> <candidateDir>');
  const diffDir=value('--diff-dir',null),includeCanvas=args.includes('--include-canvas');
  const list=async dir=>(await readdir(dir)).filter(f=>f.endsWith('.png')&&(includeCanvas||!f.includes('.canvas.')));
  const base=await list(baseDir),candidate=new Set(await list(candidateDir));
  const rows=[];let failed=false;
  for(const file of base.sort()){
   if(!candidate.has(file)){rows.push({file,note:'missing in candidate'});failed=true;continue;}
   try{
    const {result}=await comparePair(join(baseDir,file),join(candidateDir,file),{tolerance,diff:diffDir?join(resolve(diffDir),file):null});
    const over=result.ratio>threshold;failed||=over;
    rows.push({file,result,over});
   }catch(error){rows.push({file,note:error.message});failed=true;}
  }
  for(const file of [...candidate].sort())if(!base.includes(file)){rows.push({file,note:'missing in baseline'});failed=true;}
  console.log(`| Scenario | size | differing px | ratio | verdict |`);
  console.log(`| --- | --- | ---: | ---: | --- |`);
  for(const row of rows){
   if(!row.result){console.log(`| ${basename(row.file)} | - | - | - | ${row.note} |`);continue;}
   console.log(`| ${basename(row.file)} | ${row.result.width}x${row.result.height} | ${row.result.differing.toLocaleString('en-US')} | ${pct(row.result.ratio)} | ${row.over?`over ${pct(threshold)}`:'ok'} |`);
  }
  console.log(`\ntolerance ${tolerance} | threshold ${pct(threshold)} | ${rows.filter(r=>r.result&&!r.over).length}/${rows.length} within threshold`);
  process.exit(failed?1:0);
 }
 const [aFile,bFile]=positional;
 if(!bFile)throw Error('Usage: compare-shots.mjs <a.png> <b.png> [--threshold n] [--tolerance n] [--diff out.png]');
 const diff=value('--diff',null);
 const {result}=await comparePair(resolve(aFile),resolve(bFile),{tolerance,diff:diff?resolve(diff):null});
 console.log(`${basename(aFile)} vs ${basename(bFile)}`);
 console.log(`size          ${result.width}x${result.height} (${result.total.toLocaleString('en-US')} px)`);
 console.log(`differing     ${result.differing.toLocaleString('en-US')} px (${pct(result.ratio)}) at tolerance ${tolerance}`);
 console.log(`bounding box  ${result.box?`x ${result.box.x} y ${result.box.y} ${result.box.width}x${result.box.height}`:'none'}`);
 if(diff)console.log(`diff image    ${resolve(diff)}`);
 console.log(result.ratio>threshold?`FAIL ratio above threshold ${pct(threshold)}`:`OK within threshold ${pct(threshold)}`);
 process.exit(result.ratio>threshold?1:0);
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 main().catch(error=>{console.error(error.message||error);process.exit(1);});
}
