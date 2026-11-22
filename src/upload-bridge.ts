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
 private calls=new Map<string,{resolve:(value:UploadResult)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
 connect(){
  if(this.connected)return this.connected;
  this.connected=this.initialize().catch(error=>{this.connected=undefined;this.frame?.remove();this.frame=undefined;this.peer=undefined;this.peerOrigin='';throw error});return this.connected;
 }
 private async initialize(){
  const response=await fetch(new URL(`${import.meta.env.BASE_URL}config.json`,location.href),{cache:'no-store'});
  if(!response.ok)throw Error('Connection unavailable.');const config=await response.json() as {scriptUrl?:string};
  if(!config.scriptUrl||config.scriptUrl.includes('ASSIGNBOT_DEPLOYMENT_ID')||!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(config.scriptUrl))throw Error('Connection unavailable.');
  this.nonce=crypto.randomUUID();const url=new URL(config.scriptUrl);url.searchParams.set('channel',this.nonce);url.searchParams.set('origin',location.origin);
  await new Promise<void>((resolve,reject)=>{
   const timeout=setTimeout(()=>{removeEventListener('message',receive);reject(Error('We could not connect to the upload service. Please refresh and try again.'))},30_000);
   const receive=(event:MessageEvent)=>{
    const data=event.data;
    if(!data||data.service!=='assignbot'||data.channel!==this.nonce||!event.source)return;
    let host='';try{host=new URL(event.origin).hostname}catch{return}
    if(event.origin!=='https://script.google.com'&&!(host==='script.googleusercontent.com'||host.endsWith('-script.googleusercontent.com')))return;
    if(!this.peer&&data.type==='ready'){this.peer=event.source as Window;this.peerOrigin=event.origin;clearTimeout(timeout);resolve();return}
    if(event.source!==this.peer||event.origin!==this.peerOrigin)return;
    const call=this.calls.get(data.id);if(!call)return;clearTimeout(call.timer);this.calls.delete(data.id);
    if(data.type==='result'){
     const result=data.result as UploadResult|undefined;
     if(result?.ok===true&&/^AB-\d{6,}$/.test(result.submissionId)&&Number.isFinite(Date.parse(result.receivedAt)))call.resolve(result);
     else call.reject(Error('Your brief could not be saved. Please retry; an existing submission will keep the same reference.'));
    }else if(data.type==='error')call.reject(Error('Your brief could not be saved. Please retry; an existing submission will keep the same reference.'));
   };
   addEventListener('message',receive);
   const frame=document.createElement('iframe');frame.title='Secure ASSIGNBOT upload connection';frame.hidden=true;frame.setAttribute('aria-hidden','true');frame.referrerPolicy='no-referrer';frame.src=url.toString();document.body.appendChild(frame);this.frame=frame;
  });
 }
 async submit(payload:unknown):Promise<UploadResult>{
  const checked=validateSubmission(payload);if(!('data' in checked))throw Error(checked.message);
  await this.connect();
  if(!this.peer)throw Error('We could not connect to the upload service. Please refresh and try again.');
  return new Promise((resolve,reject)=>{const id=crypto.randomUUID();const timer=setTimeout(()=>{this.calls.delete(id);reject(Error('We could not confirm your submission. Please retry; an existing submission will keep the same reference.'))},120_000);this.calls.set(id,{resolve,reject,timer});this.peer!.postMessage({service:'assignbot',type:'submit',channel:this.nonce,id,payload:checked.data},this.peerOrigin)});
 }
}
export const uploadBridge=new UploadBridge();
