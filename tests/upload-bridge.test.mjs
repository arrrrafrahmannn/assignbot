import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import {validateSubmission} from '../src/validation.mjs';

function transport(scriptUrl='https://script.google.com/macros/s/test-deployment/exec'){
 const listeners=new Set(),timers=new Map(),frames=[],messages=[];
 let serial=0;
 const source=fs.readFileSync(new URL('../src/upload-bridge.ts',import.meta.url),'utf8').replace('import.meta.env.BASE_URL',JSON.stringify('./'));
 const code=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const exports={};
 const context={exports,require:()=>({validateSubmission}),URL,Date,Map,Error,Number,crypto:{randomUUID:()=>`12345678-1234-1234-1234-${String(++serial).padStart(12,'0')}`},location:{href:'https://assignbottttt.github.io/assignbot/',origin:'https://assignbottttt.github.io',hostname:'assignbottttt.github.io'},fetch:async()=>({ok:true,json:async()=>({scriptUrl})}),addEventListener:(type,fn)=>listeners.add(fn),removeEventListener:(type,fn)=>listeners.delete(fn),setTimeout(fn,ms){const id=++serial;timers.set(id,{fn,ms});return id},clearTimeout:id=>timers.delete(id),document:{createElement(){return{setAttribute(){},remove(){this.removed=true}}},body:{appendChild(frame){frames.push(frame)}}}};
 vm.runInNewContext(code,context);
 const peer={postMessage:(data,origin)=>messages.push({data,origin})};
 const ready=()=>{const channel=new URL(frames.at(-1).src).searchParams.get('channel');for(const fn of listeners)fn({origin:'https://example-script.googleusercontent.com',source:peer,data:{service:'assignbot',channel,type:'ready'}})};
 const result=value=>{const {data}=messages.at(-1);for(const fn of listeners)fn({origin:'https://example-script.googleusercontent.com',source:peer,data:{...data,type:'result',result:value}})};
 const tick=()=>new Promise(resolve=>setImmediate(resolve));
 return{bridge:exports.uploadBridge,frames,timers,messages,ready,result,tick};
}
const bytes=Buffer.from('ASSIGNBOT connection test');
const payload=()=>({requestId:'12345678-1234-1234-1234-123456789012',anonymous:true,channel:'gmail',contact:'test@gmail.com',requirements:'Test only',file:{name:'test.txt',size:bytes.length,base64:bytes.toString('base64')}});

test('a failed Google connection rejects instead of inventing a receipt',async()=>{
 const t=transport();const pending=t.bridge.submit(payload());const rejected=assert.rejects(pending,/could not connect/);
 await t.tick();assert.equal(t.frames.length,1);
 for(const timer of [...t.timers.values()])if(timer.ms===30000)timer.fn();
 await rejected;assert.equal(t.frames[0].removed,true);assert.equal(t.messages.length,0);
});
test('placeholder configuration cannot enable submissions',async()=>{
 const t=transport('https://script.google.com/macros/s/ASSIGNBOT_DEPLOYMENT_ID/exec');
 await assert.rejects(t.bridge.connect(),/Connection unavailable/);assert.equal(t.frames.length,0);
});
test('a receipt is returned only after the Google receiver confirms the save',async()=>{
 const t=transport();const pending=t.bridge.submit(payload());let settled=false;pending.then(()=>{settled=true});
 await t.tick();t.ready();await t.tick();assert.equal(settled,false);assert.equal(t.messages.length,1);
 const saved={ok:true,submissionId:'AB-000004',receivedAt:'2026-11-22T16:00:00.000Z'};t.result(saved);
 assert.deepEqual(await pending,saved);
});
test('a receiver save failure never becomes a success receipt',async()=>{
 const t=transport();const pending=t.bridge.submit(payload());const rejected=assert.rejects(pending,/could not be saved/);
 await t.tick();t.ready();await t.tick();t.result({ok:false,code:'SAVE_FAILED'});await rejected;
});
