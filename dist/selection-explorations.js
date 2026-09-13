import {CLASS_LIST,CLASSES} from './classes.js';
import {DIRECTIONS,CLASS_FLAVOR,PATHS} from './selection-directions.js';

const $=selector=>document.querySelector(selector);
const art=new Map(),weapons=new Map();
const FAVORITES_KEY='hallowmere.selection-studies.favorites.v1';
let direction=0,chosen='sorcerer',path='distance',drawer=false,noticeTimer;
let favorites=new Set();
try {const saved=JSON.parse(localStorage.getItem(FAVORITES_KEY)||'[]');if(Array.isArray(saved))favorites=new Set(saved.filter(id=>DIRECTIONS.some(d=>d.id===id)));} catch {}
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const roman=['I','II','III','IV','V','VI','VII'];
const number=n=>String(n).padStart(2,'0');

function portrait(c,extra='',weapon=false){
  const source=(weapon?weapons:art).get(c.id);
  return source?`<img class="character-image ${extra}" src="${source}" alt="${escape(weapon?c.weapon:c.name)}" draggable="false">`:`<span class="art-status ${extra}">${c.name}<small>${art.has('failed')?'Portrait unavailable':'Summoning…'}</small></span>`;
}
function classButton(c,kind='portrait',extra=''){
  return `<button class="class-choice ${kind} ${extra}" data-class="${c.id}" aria-pressed="${c.id===chosen}" aria-label="Select ${c.name}" style="--class-color:${c.color}">${kind!=='text-choice'?portrait(c,'',kind==='weapon-choice'):''}<span class="choice-label">${c.name}</span>${kind==='text-choice'?`<small>${c.role}</small>`:''}</button>`;
}
function roster(kind='portrait',classes=CLASS_LIST){return `<nav class="class-roster ${kind}-roster" aria-label="Choose a class">${classes.map(c=>classButton(c,kind)).join('')}</nav>`;}
function stats(c){return `<dl class="stats"><div><dt>Vitality</dt><dd>${c.hp}</dd></div><div><dt>Essence</dt><dd>${c.mana}</dd></div><div><dt>Speed</dt><dd>${c.speed.toFixed(1)}</dd></div></dl>`;}
function kit(c,compact=false){return `<div class="kit ${compact?'compact':''}">${['attack','bolt','dodge','nova'].map((key,i)=>`<div class="skill"><kbd>${['LMB','RMB','1','2'][i]}</kbd><div><strong>${c.abilities[key].name}</strong>${compact?'':`<p>${c.abilities[key].description}</p>`}</div></div>`).join('')}</div>`;}
function equipment(c){return `<dl class="equipment"><div><dt>WEAPON</dt><dd>${c.weapon}</dd></div><div><dt>OFF HAND</dt><dd>${c.focus}</dd></div></dl>`;}
function identity(c,{story=true,attributes=true,skills=false}={}){return `<div class="identity"><span class="eyebrow class-role">${c.role}</span><h2>${c.name}</h2>${story?`<p class="class-description">${c.description}</p>`:''}${attributes?stats(c):''}${skills?kit(c):''}</div>`;}
function enter(){return '<button class="primary enter" data-action="enter">Preview selection <span aria-hidden="true">→</span></button>';}
function pageHeading(title='Choose your calling',caption='THE ASHEN VIGIL'){return `<header class="screen-heading"><span class="eyebrow">${caption}</span><h2>${title}</h2><div class="ornament" aria-hidden="true"></div></header>`;}
function stepButtons(){return `<div class="class-arrows"><button data-action="class-prev" aria-label="Previous character">←</button><span>${number(CLASS_LIST.findIndex(c=>c.id===chosen)+1)} <i>/ 07</i></span><button data-action="class-next" aria-label="Next character">→</button></div>`;}

const layouts={
  hearth(c){return `${pageHeading('Who will answer the call?')}<div class="hearth-lineup">${CLASS_LIST.map((hero,i)=>`<div class="hearth-member" style="--position:${i};--class-color:${hero.color}">${classButton(hero,'figure')}</div>`).join('')}</div><div class="hearth-detail">${identity(c,{attributes:false})}<div class="hearth-attributes">${stats(c)}${enter()}</div></div>`;},
  codex(c){return `<div class="codex-heading"><span class="eyebrow">THE ASHEN CODEX</span><span class="eyebrow">BOOK I · THE CALLINGS</span></div><div class="book"><div class="book-art"><span class="chapter-number">${roman[CLASS_LIST.findIndex(hero=>hero.id===c.id)]}</span>${portrait(c)}<p class="flavor">“${CLASS_FLAVOR[c.id].line}”</p><div class="book-pagination">${stepButtons()}</div></div><article class="book-text"><span class="eyebrow">CHAPTER ${roman[CLASS_LIST.findIndex(hero=>hero.id===c.id)]}</span>${identity(c)}${equipment(c)}${kit(c,true)}${enter()}</article></div><nav class="chapter-tabs" aria-label="Choose a class">${CLASS_LIST.map(hero=>classButton(hero,'text-choice')).join('')}</nav>`;},
  circle(c){return `${pageHeading('Choose your oath','SEVEN CALLINGS · ONE VIGIL')}<div class="circle-layout"><div class="oath-wheel"><div class="wheel-rule" aria-hidden="true"></div><div class="wheel-hero">${portrait(c)}<span class="eyebrow">${CLASS_FLAVOR[c.id].tag}</span></div><nav class="orbit" aria-label="Choose a class">${CLASS_LIST.map((hero,i)=>`<div class="orbit-position" style="--x:${50+Math.cos(-Math.PI/2+i*Math.PI*2/7)*40}%;--y:${50+Math.sin(-Math.PI/2+i*Math.PI*2/7)*41}%">${classButton(hero,'medallion')}</div>`).join('')}</nav></div><article class="oath-detail">${identity(c)}${kit(c,true)}${enter()}</article></div>`;},
  banners(c){return `${pageHeading('Seven souls. One vigil.')}<nav class="banner-roster" aria-label="Choose a class">${CLASS_LIST.map((hero,i)=>`<button class="banner" data-class="${hero.id}" aria-pressed="${hero.id===chosen}" aria-label="Select ${hero.name}" style="--class-color:${hero.color}"><span class="banner-number">${roman[i]}</span>${portrait(hero)}<span class="banner-name">${hero.name}</span><span class="banner-role">${hero.role}</span></button>`).join('')}</nav><div class="banner-detail"><div><h3>${c.name}</h3><p>${c.description}</p></div>${enter()}</div>`;},
  armory(c){return `<header class="armory-heading"><span class="eyebrow">THE RELIQUARY</span><h2>What will you carry<br>into the dark?</h2></header><div class="armory-layout"><div class="armory-equipment"><span class="eyebrow">CHOOSE YOUR WEAPON</span>${roster('weapon-choice')}${equipment(c)}</div><div class="armory-hero">${portrait(c)}<span class="eyebrow">${CLASS_FLAVOR[c.id].tag}</span></div><article class="armory-description">${identity(c)}${kit(c,true)}${enter()}</article></div>`;},
  chronicle(c){return `<header class="chronicle-heading"><span class="eyebrow">HALLOWMERE</span><span class="eyebrow">A CHRONICLE OF THE VIGIL</span></header><div class="chronicle-layout"><nav class="chronicle-index" aria-label="Choose a class">${CLASS_LIST.map((hero,i)=>`<button data-class="${hero.id}" aria-pressed="${hero.id===chosen}" aria-label="Select ${hero.name}"><span>${number(i+1)}</span>${hero.name}</button>`).join('')}</nav><article class="chronicle-copy"><span class="folio" aria-hidden="true">${number(CLASS_LIST.findIndex(hero=>hero.id===c.id)+1)}</span><span class="eyebrow">${CLASS_FLAVOR[c.id].tag}</span><h2>${CLASS_FLAVOR[c.id].title}</h2><p class="class-description">${c.description}</p><div class="chronicle-meta"><strong>${c.name}</strong><span>${c.role}</span></div>${enter()}</article><div class="chronicle-portrait">${portrait(c)}</div></div><footer class="chronicle-footer"><span>THE CALLINGS</span><span>EVERY VIGIL BEGINS WITH A NAME.</span></footer>`;},
  ledger(c){return `<header class="ledger-heading"><div><span class="eyebrow">ASHWICK · MUSTER ROLL</span><h2>Assemble your resolve.</h2></div><span class="ledger-stamp">LEVEL I<br>7 CALLINGS</span></header><div class="ledger-layout"><div class="ledger-table-wrap"><table class="ledger-table"><caption>Starting attributes</caption><thead><tr><th scope="col">Calling</th><th scope="col">Vitality</th><th scope="col">Essence</th><th scope="col">Speed</th></tr></thead><tbody>${CLASS_LIST.map((hero,i)=>`<tr class="${hero.id===chosen?'selected':''}"><th scope="row"><button data-class="${hero.id}" aria-pressed="${hero.id===chosen}" aria-label="Select ${hero.name}"><span>${number(i+1)}</span><div>${hero.name}<small>${hero.role}</small></div></button></th><td>${hero.hp}</td><td>${hero.mana}</td><td>${hero.speed.toFixed(1)}</td></tr>`).join('')}</tbody></table><p class="ledger-note">All callings begin at level 1. Compare vitality, essence, and movement speed.</p></div><article class="ledger-profile"><div class="ledger-portrait">${portrait(c)}<div><span class="eyebrow">${CLASS_FLAVOR[c.id].tag}</span><h3>${c.name}</h3></div></div><p class="class-description">${c.description}</p>${kit(c)}${enter()}</article></div>`;},
  procession(c){const current=CLASS_LIST.findIndex(hero=>hero.id===c.id),prev=CLASS_LIST[(current+6)%7],next=CLASS_LIST[(current+1)%7];return `${pageHeading('Step into the vigil')}<div class="procession-stage"><button class="procession-neighbor previous" data-class="${prev.id}" aria-label="Select ${prev.name}">${portrait(prev)}<span>← ${prev.name}</span></button><div class="procession-hero">${portrait(c)}<span class="eyebrow">${CLASS_FLAVOR[c.id].tag}</span></div><button class="procession-neighbor following" data-class="${next.id}" aria-label="Select ${next.name}">${portrait(next)}<span>${next.name} →</span></button></div><div class="procession-detail"><span class="eyebrow">${c.role}</span><h2>${c.name}</h2><p>${c.description}</p></div>${roster('mini')}${enter()}`;},
  paths(c){const group=CLASS_LIST.filter(hero=>CLASS_FLAVOR[hero.id].path===path);return `${pageHeading('How will you face the dark?','FIND YOUR CALLING')}<div class="paths-layout"><nav class="path-choices" aria-label="Combat paths"><span class="eyebrow">I · CHOOSE YOUR PATH</span>${PATHS.map((p,i)=>`<button data-path="${p.id}" aria-pressed="${path===p.id}"><span class="path-number">${roman[i]}</span><div><strong>${p.name}</strong><p>${p.description}</p></div></button>`).join('')}</nav><div class="path-candidates"><span class="eyebrow">II · MEET YOUR CALLING</span>${roster('candidate',group)}<p class="path-note">${group.length} ${group.length===1?'calling follows':'callings follow'} this path.</p></div><article class="path-detail"><span class="eyebrow">III · ANSWER THE CALL</span><div class="path-portrait">${portrait(c)}</div>${identity(c,{attributes:false})}${kit(c,true)}${enter()}</article></div>`;},
  threshold(c){return `<header class="threshold-header"><span class="eyebrow">HALLOWMERE</span><span class="eyebrow">THE ASHEN VIGIL</span></header><div class="threshold-layout"><div class="threshold-portrait">${portrait(c)}</div><article class="threshold-copy"><span class="eyebrow">${CLASS_FLAVOR[c.id].tag}</span><h2>${c.name}</h2><p class="flavor">${CLASS_FLAVOR[c.id].line}</p><span class="threshold-role">${c.role}</span><button class="detail-toggle" data-action="details" aria-expanded="${drawer}" aria-controls="threshold-kit">${drawer?'Hide':'View'} fighting style <span>${drawer?'−':'+'}</span></button>${drawer?`<div id="threshold-kit" class="threshold-kit">${stats(c)}${kit(c,true)}</div>`:''}${enter()}</article><div class="threshold-rail">${roster('seal')}</div></div><footer class="threshold-footer"><span>THE ROAD IS WAITING.</span>${stepButtons()}</footer>`;}
};

function renderScreen({restoreFocus=false}={}){
  const active=document.activeElement;
  const focusClass=restoreFocus?active?.dataset.class:null;
  const focusPath=restoreFocus?active?.dataset.path:null;
  const focusAction=restoreFocus?active?.dataset.action:null;
  const c=CLASSES[chosen],d=DIRECTIONS[direction];
  $('#screen').className=`screen direction-${d.id}`;
  $('#screen').style.setProperty('--accent',c.color);
  $('#screen').innerHTML=layouts[d.id](c);
  if(focusClass)$('#screen').querySelector(`[data-class="${focusClass}"]`)?.focus({preventScroll:true});
  else if(focusPath)$('#screen').querySelector(`[data-path="${focusPath}"]`)?.focus({preventScroll:true});
  else if(focusAction)$('#screen').querySelector(`[data-action="${focusAction}"]`)?.focus({preventScroll:true});
}
function renderNavigation(){
  $('#directions').innerHTML=DIRECTIONS.map((d,i)=>`<button data-direction="${i}" aria-current="${direction===i?'page':'false'}"><span class="direction-number">${number(i+1)}</span><span>${d.name}</span><span class="saved-marker" aria-label="${favorites.has(d.id)?'Saved favorite':''}">${favorites.has(d.id)?'★':''}</span></button>`).join('');
  $('#favorite').setAttribute('aria-pressed',String(favorites.has(DIRECTIONS[direction].id)));
  $('#favorite').textContent=favorites.has(DIRECTIONS[direction].id)?'Saved favorite':'Save favorite';
  $('#favorite-count').textContent=`${favorites.size||'No'} favorite${favorites.size===1?'':'s'}${favorites.size?' saved':' yet'}`;
}
function writeURL(){history.replaceState(null,'',`#${DIRECTIONS[direction].id}/${chosen}`);}
function showDirection(index,{updateURL=true}={}){
  direction=(index+DIRECTIONS.length)%DIRECTIONS.length;drawer=false;
  const d=DIRECTIONS[direction];
  $('#direction-title').textContent=d.name;
  $('#direction-category').textContent=d.category;
  $('#direction-description').textContent=d.description;
  $('#direction-reference').innerHTML=d.url?`INSPIRATION · <a href="${d.url}" target="_blank" rel="noreferrer">${d.reference} ↗</a>`:d.reference;
  $('#direction-count').textContent=`${number(direction+1)} / 10`;
  renderNavigation();renderScreen();if(updateURL){writeURL();window.scrollTo({top:0,behavior:'instant'});}
}
function selectClass(id){
  if(!Object.hasOwn(CLASSES,id))return;
  chosen=id;path=CLASS_FLAVOR[id].path;renderScreen({restoreFocus:true});writeURL();
}
function restoreURL(){
  const [id,classId]=location.hash.slice(1).split('/');
  const found=DIRECTIONS.findIndex(d=>d.id===id);
  if(Object.hasOwn(CLASSES,classId)){chosen=classId;path=CLASS_FLAVOR[chosen].path;}
  showDirection(found<0?0:found,{updateURL:false});
}
function notify(message){clearTimeout(noticeTimer);$('#notification').textContent=message;$('#notification').hidden=false;noticeTimer=setTimeout(()=>$('#notification').hidden=true,4000);}

$('#directions').addEventListener('click',event=>{const button=event.target.closest('[data-direction]');if(button){showDirection(Number(button.dataset.direction));$(`[data-direction="${direction}"]`).focus({preventScroll:true});}});
$('#previous').onclick=()=>showDirection(direction-1);
$('#next').onclick=()=>showDirection(direction+1);
$('#favorite').onclick=()=>{
  const d=DIRECTIONS[direction];if(favorites.has(d.id))favorites.delete(d.id);else favorites.add(d.id);
  try{localStorage.setItem(FAVORITES_KEY,JSON.stringify([...favorites]));notify(favorites.has(d.id)?`${d.name} saved to your favorites.`:`${d.name} removed from favorites.`);}catch{notify('Saved for this visit. Browser storage is unavailable.');}
  renderNavigation();
};
for(const size of ['desktop','mobile'])$('#'+size).onclick=()=>{
  $('#preview').classList.toggle('mobile',size==='mobile');
  $('#desktop').setAttribute('aria-pressed',String(size==='desktop'));$('#mobile').setAttribute('aria-pressed',String(size==='mobile'));
};
$('#focus').onclick=()=>{const focused=document.body.classList.toggle('focus-view');$('#focus').textContent=focused?'Exit focus':'Focus view';$('#focus').setAttribute('aria-pressed',String(focused));};
$('#screen').addEventListener('click',event=>{
  const choice=event.target.closest('[data-class]');if(choice){selectClass(choice.dataset.class);return;}
  const route=event.target.closest('[data-path]');if(route){path=route.dataset.path;chosen=CLASS_LIST.find(c=>CLASS_FLAVOR[c.id].path===path).id;renderScreen({restoreFocus:true});writeURL();return;}
  const action=event.target.closest('[data-action]')?.dataset.action;
  if(action==='enter'){
    $('#confirmation-title').textContent=`${CLASSES[chosen].name} selected`;
    $('#confirmation-body').textContent=`This previews the selection in ${DIRECTIONS[direction].name}. Save this direction as a favorite if you want to revisit it.`;
    $('#confirmation').showModal();
  }
  if(action==='class-prev'||action==='class-next'){const index=CLASS_LIST.findIndex(c=>c.id===chosen);selectClass(CLASS_LIST[(index+(action==='class-next'?1:6))%7].id);}
  if(action==='details'){drawer=!drawer;renderScreen({restoreFocus:true});}
});
// Arrow keys move between peers in any class list, including the radial selector.
$('#screen').addEventListener('keydown',event=>{
  if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
  const button=event.target.closest('[data-class]');if(!button)return;
  const group=button.closest('nav,table')||$('#screen');
  const choices=[...group.querySelectorAll('[data-class]')];
  if(choices.length<2)return;
  event.preventDefault();const offset=['ArrowRight','ArrowDown'].includes(event.key)?1:choices.length-1;
  const next=choices[(choices.indexOf(button)+offset)%choices.length];
  selectClass(next.dataset.class);$('#screen').querySelector(`[data-class="${next.dataset.class}"]`)?.focus({preventScroll:true});
});
window.addEventListener('hashchange',restoreURL);
restoreURL();

// Render the actual playable rigs once in one disposable WebGL context. The
// gallery reuses PNGs when switching layouts instead of keeping ten 3D scenes alive.
async function prepareArt(){
  let renderer;
  try{
    const [T,{createInventoryStudy},{disposeStudy}]=await Promise.all([
      import('./vendor/three.module.js'),import('./inventory-portraits.js'),import('./character-study-models.js')
    ]);
    renderer=new T.WebGLRenderer({antialias:true,alpha:true});
    renderer.setSize(840,880,false);renderer.setPixelRatio(1);renderer.setClearColor(0x101716,0);
    renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
    renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
    for(const c of CLASS_LIST){
      const study=createInventoryStudy(c.id,c.concept);
      try{
        // Keep the native low-poly figure, but leave its gallery pedestal behind.
        study.scene.children.filter(node=>node.isMesh).forEach(node=>node.visible=false);
        const modelBounds=new T.Box3().setFromObject(study.root),modelCenter=modelBounds.getCenter(new T.Vector3());
        study.camera.position.copy(modelCenter).add(new T.Vector3(3.2,2,6.2));
        study.camera.lookAt(modelCenter);study.camera.updateMatrixWorld(true);
        const frame=new T.Box3(),vertex=new T.Vector3();
        study.root.traverse(node=>{
          const positions=node.geometry?.getAttribute('position');if(!positions)return;
          for(let i=0;i<positions.count;i++)frame.expandByPoint(vertex.fromBufferAttribute(positions,i).applyMatrix4(node.matrixWorld).applyMatrix4(study.camera.matrixWorldInverse));
        });
        const aspect=840/880,halfHeight=Math.max((frame.max.y-frame.min.y)/2,(frame.max.x-frame.min.x)/2/aspect)*1.09;
        const cx=(frame.min.x+frame.max.x)/2,cy=(frame.min.y+frame.max.y)/2;
        Object.assign(study.camera,{left:cx-halfHeight*aspect,right:cx+halfHeight*aspect,top:cy+halfHeight,bottom:cy-halfHeight});
        study.camera.updateProjectionMatrix();
        renderer.render(study.scene,study.camera);art.set(c.id,renderer.domElement.toDataURL('image/png'));
        const weapon=study.root.getObjectByName('weapon');
        if(weapon){
          const item=weapon.clone(true);study.root.visible=false;item.position.set(0,0,0);item.rotation.set(0,0,0);study.scene.add(item);
          const bounds=new T.Box3().setFromObject(item),center=bounds.getCenter(new T.Vector3()),size=bounds.getSize(new T.Vector3());
          item.position.sub(center);const extent=Math.max(size.x,size.y,size.z)*.68+.08;
          const camera=new T.OrthographicCamera(-extent,extent,extent,-extent,.1,30);camera.position.set(2,1.7,5);camera.lookAt(0,0,0);
          renderer.render(study.scene,camera);weapons.set(c.id,renderer.domElement.toDataURL('image/png'));study.scene.remove(item);
        }
      }finally{disposeStudy(study);}
      renderScreen({restoreFocus:true});await new Promise(resolve=>setTimeout(resolve,0));
    }
  }catch(error){art.set('failed',true);console.error('Selection study portraits failed',error);renderScreen({restoreFocus:true});notify('Character art could not load. The layouts and class selection remain available.');}
  finally{renderer?.dispose();renderer?.forceContextLoss();}
}
prepareArt();
