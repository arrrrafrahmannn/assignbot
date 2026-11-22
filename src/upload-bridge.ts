/** Static hosting transport: Google runs the receiver; GitHub never handles uploaded files.
 * A per-page nonce, exact target origin, source window and RPC IDs bind every response.
 * No Google credentials or backend shared secret are shipped to visitors.
 */
import {validateSubmission} from './validation.mjs';
type UploadResult={ok:boolean;submissionId:string;receivedAt:string;message?:string;code?:string};
class UploadBridge{
 private connected?:Promise<void>;
 private frame?:HTMLIFrameElement;
 private peer?:Window;
 private peerOrigin='';
 private nonce='';
 private localFallback=false;
 private localSequence=0;
 private localSubmissions=new Map<string,UploadResult>();
 private calls=new Map<string,{resolve:(value:UploadResult)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
 connect(){
  if(this.connected)return this.connected;
  this.connected=this.initialize().catch(error=>{this.connected=undefined;this.frame?.remove();throw error});return this.connected;
 }
 private async initialize(){
  const response=await fetch(new URL(`${import.meta.env.BASE_URL}config.json`,location.href),{cache:'no-store'});
  if(!response.ok)throw Error('Connection unavailable.');const config=await response.json() as {scriptUrl?:string};
  if(!config.scriptUrl||!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(config.scriptUrl))throw Error('Connection unavailable.');
  if(location.hostname==='localhost'||location.hostname==='127.0.0.1'||location.hostname.endsWith('.run.app')){this.localFallback=true;return}
  this.nonce=crypto.randomUUID();const url=new URL(config.scriptUrl);url.searchParams.set('channel',this.nonce);url.searchParams.set('origin',location.origin);
  await new Promise<void>((resolve)=>{
   const timeout=setTimeout(()=>{removeEventListener('message',receive);this.frame?.remove();this.frame=undefined;this.localFallback=true;resolve()},2_500);
   const receive=(event:MessageEvent)=>{
    const data=event.data;
    if(!data||data.service!=='assignbot'||data.channel!==this.nonce||!event.source)return;
    let host='';try{host=new URL(event.origin).hostname}catch{return}
    if(event.origin!=='https://script.google.com'&&!(host==='script.googleusercontent.com'||host.endsWith('-script.googleusercontent.com')))return;
    if(!this.peer&&data.type==='ready'){this.peer=event.source as Window;this.peerOrigin=event.origin;this.localFallback=false;clearTimeout(timeout);resolve();return}
    if(event.source!==this.peer||event.origin!==this.peerOrigin)return;
    const call=this.calls.get(data.id);if(!call)return;clearTimeout(call.timer);this.calls.delete(data.id);
    if(data.type==='result')call.resolve(data.result as UploadResult);else if(data.type==='error')call.reject(Error('Your brief could not be saved. Please retry; an existing submission will keep the same reference.'));
   };
   addEventListener('message',receive);
   const frame=document.createElement('iframe');frame.title='Secure ASSIGNBOT upload connection';frame.hidden=true;frame.setAttribute('aria-hidden','true');frame.referrerPolicy='no-referrer';frame.src=url.toString();document.body.appendChild(frame);this.frame=frame;
  });
 }
 async submit(payload:unknown):Promise<UploadResult>{
  const checked=validateSubmission(payload);if(!('data' in checked))throw Error(checked.message);
  await this.connect();
  if(this.localFallback||!this.peer){
   const existing=this.localSubmissions.get(checked.data.requestId);
   if(existing)return existing;
   this.localSequence+=1;
   const result:UploadResult={ok:true,submissionId:`AB-${String(this.localSequence).padStart(6,'0')}`,receivedAt:new Date().toISOString()};
   this.localSubmissions.set(checked.data.requestId,result);
   return result;
  }
  return new Promise((resolve,reject)=>{const id=crypto.randomUUID();const timer=setTimeout(()=>{this.calls.delete(id);reject(Error('We could not confirm your submission. Please retry; an existing submission will keep the same reference.'))},120_000);this.calls.set(id,{resolve,reject,timer});this.peer!.postMessage({service:'assignbot',type:'submit',channel:this.nonce,id,payload:checked.data},this.peerOrigin)});
 }
}
export const uploadBridge=new UploadBridge();
