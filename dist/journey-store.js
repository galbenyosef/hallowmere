import {randomUUID} from './world-random.js';
import {CLASSES} from './classes.js';
import {validateJourney,journeySummary,JOURNEY_VERSION} from './journey-state.js';

const LEASE_MS=30000;
const recoveryKey=(id,owner)=>`hallowmere.journey-recovery.${id}.${owner}`;
export class JourneyConflict extends Error {}
export class JourneyStore {
 constructor(){this.owner=randomUUID();}
 async open(){
  if(this.database)return this.database;
  if(!globalThis.indexedDB)throw Error('Browser saving is unavailable. Enable site storage and try again.');
  this.database=new Promise((resolve,reject)=>{
   const request=indexedDB.open('hallowmere.journeys',1);
   request.onupgradeneeded=()=>request.result.createObjectStore('journeys',{keyPath:'id'});
   request.onerror=()=>reject(Error('Browser saving is unavailable. Check your site storage settings and retry.'));
   request.onblocked=()=>reject(Error('Close other Hallowmere tabs, then retry opening your journeys.'));
   request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>{db.close();this.database=null;};resolve(db);};
  }).catch(error=>{this.database=null;throw error;});
  return this.database;
 }
 async list(){
  const db=await this.open();
  return new Promise((resolve,reject)=>{
   const tx=db.transaction('journeys'),request=tx.objectStore('journeys').getAll();
   tx.oncomplete=()=>resolve(request.result.sort((a,b)=>b.savedAt-a.savedAt));
   tx.onerror=()=>reject(Error('Your journeys could not be loaded. Please retry.'));
  });
 }
 async change(id,mutate){
  const db=await this.open();
  return new Promise((resolve,reject)=>{
   const tx=db.transaction('journeys','readwrite'),store=tx.objectStore('journeys');let result,failure;
   const request=store.get(id);
   request.onsuccess=()=>{try{result=mutate(request.result);if(result===null)store.delete(id);else store.put(result);}catch(error){failure=error;tx.abort();}};
   tx.oncomplete=()=>resolve(result);
   tx.onabort=tx.onerror=()=>reject(failure||Error('Progress could not be saved. Check available browser storage, then retry.'));
  });
 }
 async create(data){
  validateJourney(data);const now=Date.now(),id=randomUUID();
  return this.change(id,()=>({id,name:`${CLASSES[data.player.state.classId].name} journey`,createdAt:now,savedAt:now,
   revision:1,summary:journeySummary(data),data,previous:null,owner:this.owner,leaseUntil:now+LEASE_MS}));
 }
 assertAvailable(record){
  if(!record)throw Error('This journey is no longer available. Refresh the list.');
  if(record.owner&&record.owner!==this.owner&&record.leaseUntil>Date.now())throw new JourneyConflict('This journey is open in another tab. Save & exit there before continuing here.');
 }
 async acquire(id){
  let recovery;
  const record=await this.change(id,record=>{
   this.assertAvailable(record);
   // Never downgrade a future save, even if its backup happens to be readable.
   if(record.data?.version>JOURNEY_VERSION)validateJourney(record.data);
   // A synchronous page-hide journal covers a browser closing before its final
   // IndexedDB transaction completes. Only the last owner's journal is eligible.
   recovery=recoveryKey(id,record.owner);
   try{const emergency=JSON.parse(localStorage.getItem(recovery)||'null');
    if(emergency&&emergency.capturedAt>(record.data?.capturedAt||0)){
     validateJourney(emergency);
     // The journal may carry a class change the committed record never saw; validateJourney vetted it.
     record.previous=record.data;record.data=emergency;record.summary=journeySummary(emergency);record.savedAt=emergency.capturedAt;record.revision++;
    }
   }catch{/* Keep the committed save when the optional recovery journal is unavailable. */}
   try{validateJourney(record.data);record.recovered=false;}catch(error){
    if(!record.previous)throw error;
    validateJourney(record.previous);record.data=record.previous;record.summary=journeySummary(record.data);record.savedAt=record.data.capturedAt||record.savedAt;record.revision++;record.recovered=true;
   }
   return {...record,owner:this.owner,leaseUntil:Date.now()+LEASE_MS};
  });
  try{localStorage.removeItem(recovery);}catch{}
  return record;
 }
 save(id,revision,data){
  validateJourney(data);
  return this.change(id,record=>{
   if(!record||record.owner!==this.owner||record.revision!==revision)throw new JourneyConflict('This journey changed in another tab. Return to Journeys and continue the latest save.');
   return {...record,revision:revision+1,previous:record.data,data,summary:journeySummary(data),savedAt:Date.now(),leaseUntil:Date.now()+LEASE_MS};
  });
 }
 renew(id){return this.change(id,record=>{
  if(!record||record.owner!==this.owner)throw new JourneyConflict('This journey is now open in another tab. Return to Journeys to continue.');
  return {...record,leaseUntil:Date.now()+LEASE_MS};
 });}
 release(id){return this.change(id,record=>{if(!record)throw Error('Journey not found.');return record.owner===this.owner?{...record,owner:null,leaseUntil:0}:record;});}
 rename(id,name){return this.change(id,record=>{this.assertAvailable(record);return {...record,name:name.trim().slice(0,48)||record.name};});}
 remove(id){return this.change(id,record=>{this.assertAvailable(record);return null;});}
}

export function createAutosave({store,record,getSave,onStatus,onConflict}){
 let revision=record.revision,dirty=false,stopped=false,timer=null,tail=Promise.resolve(),lastSaved=record.savedAt;
 function status(kind,message){onStatus({kind,message,savedAt:lastSaved});}
 function flush(){
  // Serialize writes and capture after earlier writes finish, so an older snapshot
  // can never land after a newer one. Failed writes leave the current world dirty.
  const operation=tail.catch(()=>{}).then(async()=>{
   if(stopped)return;
   if(!dirty){await store.renew(record.id);return;}
   dirty=false;status('saving','Saving…');
   try{const data=getSave(),saved=await store.save(record.id,revision,data);revision=saved.revision;lastSaved=saved.savedAt;
    try{const key=recoveryKey(record.id,store.owner),emergency=JSON.parse(localStorage.getItem(key)||'null');if(emergency?.capturedAt<=data.capturedAt)localStorage.removeItem(key);}catch{}
    status('saved','All progress saved');}
   catch(error){dirty=true;throw error;}
  });
  tail=operation;
  operation.catch(error=>{status('error',error.message);if(error instanceof JourneyConflict){stopped=true;clearInterval(interval);clearTimeout(timer);onConflict(error);}});
  return operation;
 }
 function changed(soon=false){if(stopped)return;dirty=true;if(soon&&!timer)timer=setTimeout(()=>{timer=null;flush().catch(()=>{});},500);}
 const interval=setInterval(()=>flush().catch(()=>{}),5000);
 status('saved','All progress saved');
 return {changed,flush,emergency(){if(stopped)return;try{localStorage.setItem(recoveryKey(record.id,store.owner),JSON.stringify(getSave()));}catch{/* Normal autosaving remains authoritative. */}},get stopped(){return stopped;},async exit(){changed();await flush();if(stopped)throw new JourneyConflict('Return to Journeys to load the latest save.');await store.release(record.id);this.stop();},stop(){stopped=true;clearInterval(interval);clearTimeout(timer);}};
}
