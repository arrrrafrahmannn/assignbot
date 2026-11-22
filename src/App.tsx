import {uploadBridge} from "./upload-bridge";
import {useEffect,useRef,useState} from 'react';
import {AnimatePresence,motion} from 'framer-motion';
import {Upload,FileText,X,Check,LockKeyhole,MessageCircle,Mail,Plus,Minus,LoaderCircle,Copy,Asterisk} from 'lucide-react';
const MAX_FILE=10*1024*1024;
const extensions=['pdf','doc','docx','png','jpg','jpeg','txt'];
const CARD_EASE:[number,number,number,number]=[0.16,1,0.3,1];
function playSubmitSound(){
 try{
  const AudioCtx=window.AudioContext||(window as unknown as {webkitAudioContext:typeof AudioContext}).webkitAudioContext;
  if(!AudioCtx)return;
  const ctx=new AudioCtx();
  const now=ctx.currentTime;
  const master=ctx.createGain();
  master.gain.setValueAtTime(0.32,now);
  master.connect(ctx.destination);
  // Crisp tactile mechanical click transient
  const clickOsc=ctx.createOscillator();
  const clickGain=ctx.createGain();
  clickOsc.type='triangle';
  clickOsc.frequency.setValueAtTime(1400,now);
  clickOsc.frequency.exponentialRampToValueAtTime(220,now+0.032);
  clickGain.gain.setValueAtTime(0.7,now);
  clickGain.gain.exponentialRampToValueAtTime(0.001,now+0.032);
  clickOsc.connect(clickGain);
  clickGain.connect(master);
  clickOsc.start(now);
  clickOsc.stop(now+0.035);
  // Warm low-mid body thock
  const bodyOsc=ctx.createOscillator();
  const bodyGain=ctx.createGain();
  bodyOsc.type='sine';
  bodyOsc.frequency.setValueAtTime(320,now+0.008);
  bodyOsc.frequency.exponentialRampToValueAtTime(110,now+0.075);
  bodyGain.gain.setValueAtTime(0.5,now+0.008);
  bodyGain.gain.exponentialRampToValueAtTime(0.001,now+0.08);
  bodyOsc.connect(bodyGain);
  bodyGain.connect(master);
  bodyOsc.start(now+0.008);
  bodyOsc.stop(now+0.085);
  // Subtle harmonic confirmation chime
  const chimeOsc=ctx.createOscillator();
  const chimeGain=ctx.createGain();
  chimeOsc.type='sine';
  chimeOsc.frequency.setValueAtTime(587.33,now+0.035);
  chimeOsc.frequency.exponentialRampToValueAtTime(880,now+0.14);
  chimeGain.gain.setValueAtTime(0.22,now+0.035);
  chimeGain.gain.exponentialRampToValueAtTime(0.001,now+0.19);
  chimeOsc.connect(chimeGain);
  chimeGain.connect(master);
  chimeOsc.start(now+0.035);
  chimeOsc.stop(now+0.2);
  setTimeout(()=>ctx.close().catch(()=>{}),300);
 }catch{}
}
function Atmosphere(){
 const canvas=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  const el=canvas.current;
  if(!el)return;
  const ctx=el.getContext('2d');
  if(!ctx)return;
  let frame=0;
  const points=Array.from({length:55},(_,i)=>({
   x:Math.random(),
   y:Math.random(),
   r:Math.random()*2.2+0.8,
   vx:(Math.random()-0.5)*0.00055,
   vy:-(0.00035+Math.random()*0.00065),
   phase:Math.random()*Math.PI*2,
   ring:i%7===0
  }));
  const resize=()=>{el.width=innerWidth;el.height=innerHeight};
  resize();
  addEventListener('resize',resize);
  function draw(t:number){
   if(!ctx||!el)return;
   ctx.clearRect(0,0,el.width,el.height);
   points.forEach(p=>{
    p.y+=p.vy;
    p.x+=p.vx+Math.sin(t*0.0012+p.phase)*0.00025;
    if(p.y<-0.02)p.y=1.02;
    if(p.x<-0.02)p.x=1.02;
    if(p.x>1.02)p.x=-0.02;
    const px=p.x*el.width,py=p.y*el.height;
    ctx.beginPath();
    ctx.arc(px,py,p.r,0,Math.PI*2);
    if(p.ring){
     ctx.strokeStyle='rgba(23,24,23,0.24)';
     ctx.lineWidth=1;
     ctx.stroke();
    }else{
     ctx.fillStyle='rgba(23,24,23,0.22)';
     ctx.fill();
    }
   });
   frame=requestAnimationFrame(draw);
  }
  frame=requestAnimationFrame(draw);
  return()=>{cancelAnimationFrame(frame);removeEventListener('resize',resize)};
 },[]);
 return <canvas className="particles" ref={canvas} aria-hidden="true"/>;
}
export default function Home(){
const [anonymous,setAnonymous]=useState(false),[channel,setChannel]=useState<'whatsapp'|'gmail'>('whatsapp'),[file,setFile]=useState<File|null>(null),[drag,setDrag]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[ready,setReady]=useState<boolean|null>(null),[receipt,setReceipt]=useState<{submissionId:string;receivedAt:string;channel:'gmail'|'whatsapp'}|null>(null),[openFaq,setOpenFaq]=useState<number|null>(null),[copied,setCopied]=useState(false);
const input=useRef<HTMLInputElement>(null),requestId=useRef(''),requestPayload=useRef(''),artRef=useRef<HTMLDivElement>(null);
useEffect(()=>{requestId.current=crypto.randomUUID();let active=true;uploadBridge.connect().then(()=>{if(active)setReady(true)}).catch(()=>{if(active)setReady(false)});return()=>{active=false}},[]);
useEffect(()=>{
 const move=(e:MouseEvent)=>{
  const el=artRef.current;
  if(!el)return;
  const dx=(e.clientX/window.innerWidth-0.5)*2;
  const dy=(e.clientY/window.innerHeight-0.5)*2;
  el.style.setProperty('--mx',`${(dx*18).toFixed(2)}px`);
  el.style.setProperty('--my',`${(dy*14).toFixed(2)}px`);
 };
 addEventListener('mousemove',move);
 return()=>removeEventListener('mousemove',move);
},[]);
function chooseFile(selected:File|undefined){setError('');if(!selected)return;if(!extensions.includes(selected.name.split('.').pop()?.toLowerCase()||'')){setError('Please choose a PDF, Word document, image, or TXT file.');return}if(!selected.size||selected.size>MAX_FILE){setError('Please choose a nonempty file up to 10 MB.');return}setFile(selected)}
function toggleAnonymous(value:boolean){setAnonymous(value);if(value)setChannel('gmail')}
async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setError('');if(!file){setError('Add your assignment brief before submitting.');input.current?.focus();return}if(!ready){setError('We can’t connect right now. Please refresh and try again.');return}const form=new FormData(e.currentTarget);setBusy(true);try{const base64=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(new Error('We could not read that file. Please select it again.'));reader.readAsDataURL(file)});const payload={anonymous,channel,name:anonymous?'':form.get('name'),contact:form.get('contact'),requirements:form.get('requirements'),website:form.get('website'),file:{name:file.name,type:file.type,size:file.size,base64}};const fingerprint=JSON.stringify(payload);if(requestPayload.current!==fingerprint){requestId.current=crypto.randomUUID();requestPayload.current=fingerprint}const d=await uploadBridge.submit({...payload,requestId:requestId.current});if(!d.ok)throw new Error(d.message||'We could not confirm your submission. Please retry; your reference will be kept if it already arrived.');setReceipt({...d,channel});document.getElementById('submission')?.scrollIntoView({behavior:'smooth',block:'center'})}catch(err){setError(err instanceof Error?err.message:'Something went wrong. Please try again.')}finally{setBusy(false)}}
const faqs=[['How does it work?','Upload the instructions your faculty gave you, choose WhatsApp or Gmail, and add your requirements. We review your brief and send the completed file to your selected contact. Keep your submission reference handy.'],['Can I leave out my name?','Yes. Switch on anonymous mode and use Gmail for delivery. We will not ask for your name or WhatsApp number. Your email is still visible to the person handling your request.'],['What files can I upload?','Upload one PDF, Word document, JPG, PNG, or TXT file, up to 10 MB. If your instructions are spread across several pages, combine them into one PDF first.'],['What should I put in the requirements?','Include your deadline, word count, citation style, required sources, formatting instructions, and anything else we should know. Use your reference when asking about your request.']];
return <><Atmosphere/><main>
<div className="brand-row"><a className="wordmark" href="#" aria-label="ASSIGNBOT home">ASSIGNBOT.</a><span className="brand-caption">LESS OVERWHELM. MORE HEADSPACE.</span></div>
<section className="hero" aria-labelledby="headline"><div className="hero-copy"><div className="eyebrow"><span className="small-line"/>A LITTLE HELP GOES A LONG WAY.</div><h1 id="headline">Brief in.<br/><span className="serif">Breathe</span><br/>out<span className="hero-dot">.</span></h1><p className="intro">Big assignment? Start with one small step.<br className="desktop-break"/>Send your brief. We’ll take it from here.</p><a className="text-link" href="#how-it-works">A simple process. A little peace of mind.<span className="link-line"/></a><div className="hero-art" ref={artRef} aria-hidden="true"><div className="orb-satellite sat-1"/><div className="orb-satellite sat-2"/><div className="orb-ring"/><div className="orb-shadow"/><div className="glass-orb"><div className="orb-inner"/><div className="orb-shine"/></div><span className="art-note">a weight<br/><i>off your mind.</i></span><svg className="scribble" viewBox="0 0 100 80"><path d="M85 8C40 10 20 28 40 41s45-5 31-13S15 43 13 68m-5-9 5 10 14-5"/></svg></div><div className="micro-note"><LockKeyhole size={14}/><span>Your brief, handled with care.</span></div></div>
<div className="form-wrap" id="submission"><div className="form-topnote"><span className="note-dot"/>YOUR NEXT SMALL STEP.</div><motion.div className="submission-card" initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} transition={{duration:0.6,ease:CARD_EASE}}>
<AnimatePresence mode="wait" initial={false}>
{receipt?<motion.div key="receipt" className="receipt" role="status" initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-12}} transition={{duration:0.6,ease:CARD_EASE}}><div className="receipt-icon"><Check size={30}/></div><span className="eyebrow">SAFE AND SOUND.</span><h2>Brief received.</h2><p>Take a breath. We’ve got your instructions.</p><div className="reference"><span>YOUR SUBMISSION REFERENCE</span><strong>{receipt.submissionId}</strong><button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(receipt.submissionId);setCopied(true)}catch{setCopied(false)}}}><Copy size={15}/>{copied?'Copied':'Copy reference'}</button></div><p className="receipt-details">Your completed file will be sent to your {receipt.channel==='gmail'?'Gmail address':'WhatsApp number'}. Keep this reference so we can find your request.</p><button className="submit-button" type="button" onClick={()=>{playSubmitSound();setReceipt(null);setFile(null);setCopied(false);requestId.current=crypto.randomUUID()}}>Submit another brief <Plus size={19}/></button></motion.div>:<motion.form key="form" onSubmit={submit} aria-busy={busy} initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-12}} transition={{duration:0.6,ease:CARD_EASE}}>
<div className="form-heading"><h2>Let’s get it<br/><span className="serif">off your plate.</span></h2><span className="form-asterisk" aria-hidden="true"><Asterisk size={43} strokeWidth={1.5}/></span></div><p className="form-subtitle">Your brief. Your details. We’ll handle the rest.</p>
<div className="file-section"><label className="field-label" htmlFor="brief">The assignment brief <span>REQUIRED</span></label><div className={`upload-zone ${drag?'dragging':''} ${file?'has-file':''}`} onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);chooseFile(e.dataTransfer.files[0])}}><input ref={input} id="brief" className="file-input" type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt" onChange={e=>chooseFile(e.target.files?.[0])}/>{file?<div className="file-picked"><FileText size={26}/><div><strong>{file.name}</strong><span>{(file.size/1024/1024).toFixed(2)} MB · Ready to send</span></div><button type="button" className="remove-file" aria-label="Remove uploaded file" onClick={()=>{setFile(null);if(input.current)input.current.value=''}}><X size={18}/></button></div>:<label htmlFor="brief" className="drop-label"><div className="upload-icon"><Upload size={20} strokeWidth={1.5}/></div><strong>Drop your brief here, or <span>browse files</span></strong><small>PDF, Word, images or TXT · Up to 10 MB</small></label>}</div></div>
<div className="anonymous-row"><div><label htmlFor="anonymous">Keep my name off it.</label><p>Stay anonymous. Get your file by Gmail.</p></div><button className="toggle" id="anonymous" type="button" role="switch" aria-checked={anonymous} aria-label="Stay anonymous" onClick={()=>toggleAnonymous(!anonymous)}><span/></button></div>
{!anonymous&&<div className="field"><label className="field-label" htmlFor="name">What should we call you?</label><input id="name" name="name" placeholder="Your name" autoComplete="name" required maxLength={100}/></div>}
<fieldset className="delivery"><legend className="field-label">Where should your file arrive?</legend><div className="channel-switch"><button type="button" className={channel==='whatsapp'?'selected':''} aria-pressed={channel==='whatsapp'} disabled={anonymous} onClick={()=>setChannel('whatsapp')}><MessageCircle size={16}/>WhatsApp {channel==='whatsapp'&&<Check size={14}/>}</button><button type="button" className={channel==='gmail'?'selected':''} aria-pressed={channel==='gmail'} onClick={()=>setChannel('gmail')}><Mail size={16}/>Gmail {channel==='gmail'&&<Check size={14}/>}</button></div><label className="sr-only" htmlFor="contact">{channel==='gmail'?'Gmail address':'WhatsApp number'}</label><input key={channel} id="contact" name="contact" type={channel==='gmail'?'email':'tel'} autoComplete={channel==='gmail'?'email':'tel'} placeholder={channel==='gmail'?'you@gmail.com':'+1 555 000 0000'} required maxLength={100} pattern={channel==='gmail'?'[^\\s@]+@gmail\\.com':'\\+?[0-9\\s\\(\\)\\-]{8,25}'} title={channel==='gmail'?'Enter a Gmail address ending in @gmail.com':'Include your country code, for example +1'}/><span className="field-hint">{channel==='gmail'?'We’ll send your finished file to this Gmail address.':'Include your country code so we can reach you.'}</span></fieldset>
<div className="field requirements"><label className="field-label" htmlFor="requirements">Anything else we should know? <span>OPTIONAL</span></label><textarea id="requirements" name="requirements" rows={3} maxLength={5000} placeholder="Deadline, word count, referencing style, special instructions…"/></div><div className="honeypot" aria-hidden="true"><label htmlFor="website">Website</label><input id="website" name="website" tabIndex={-1} autoComplete="off"/></div>
{error&&<p className="form-error" role="alert">{error}</p>}<button className="submit-button" type="submit" disabled={busy||ready!==true} onClick={()=>playSubmitSound()}>{busy?<><LoaderCircle size={19} className="spin"/>Sending your brief…</>:<>Submit your brief<span className="button-dot"/></>}</button><p className="form-bottom">{ready===false?'We can’t connect right now. Please refresh and try again.':ready===null?'Connecting securely…':'One click. One reference. One less thing on your mind.'}</p></motion.form>}
</AnimatePresence>
</motion.div><div className="card-bottom"><LockKeyhole size={13}/><span>Only the details we need. Only the people who need them.</span></div></div></section>
<section className="process" id="how-it-works"><div className="section-intro"><span className="eyebrow">NO COMPLICATED PART.</span><h2>From to-do<br/>to <span className="serif">taken care of.</span></h2></div><div className="process-items"><article><Upload size={22} strokeWidth={1.4}/><h3>Drop the brief.</h3><p>Upload your faculty’s instructions. Add the little details that matter.</p></article><article><FileText size={22} strokeWidth={1.4}/><h3>Keep your reference.</h3><p>Every request gets its own number. Your brief stays matched to your details.</p></article><article><MessageCircle size={22} strokeWidth={1.4}/><h3>Get your file.</h3><p>Your completed file lands in your WhatsApp or Gmail. Just where you need it.</p></article></div></section>
<section className="faq"><div><span className="eyebrow">A FEW THINGS, CLEARED UP.</span><h2>Good<br/><span className="serif">questions.</span></h2></div><div className="faq-list">{faqs.map(([q,a],i)=><article key={q}><button type="button" aria-expanded={openFaq===i} aria-controls={`faq-${i}`} onClick={()=>setOpenFaq(openFaq===i?null:i)}>{q}{openFaq===i?<Minus size={18}/>:<Plus size={18}/>}</button><div id={`faq-${i}`} hidden={openFaq!==i}><p>{a}</p></div></article>)}</div></section>
<footer><a href="#" className="wordmark">ASSIGNBOT.</a><span>A little help. A lot of headspace.</span><span>© {new Date().getFullYear()} ASSIGNBOT.</span></footer></main></>;
}
