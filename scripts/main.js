const $=(s,c=document)=>c.querySelector(s);const $$=(s,c=document)=>[...c.querySelectorAll(s)];
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
const API_BASE='/api';
addEventListener('load',()=>setTimeout(()=>$('.loader')?.classList.add('done'),350));
const header=$('[data-header]'),progress=$('[data-progress]');
addEventListener('scroll',()=>{const max=document.documentElement.scrollHeight-innerHeight;if(progress)progress.style.width=`${max>0?(scrollY/max)*100:0}%`;header?.classList.toggle('scrolled',scrollY>40)},{passive:true});
const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-visible');io.unobserve(e.target)}}),{threshold:.12});
$$('.reveal').forEach((el,i)=>{if(!reduced)el.style.transitionDelay=`${Math.min(i%5,4)*60}ms`;io.observe(el)});
const world=$('[data-world]');if(world&&!reduced){const wo=new IntersectionObserver(e=>{if(e[0].isIntersecting){world.classList.add('is-active');wo.disconnect()}},{threshold:.25});wo.observe(world)}
const toggle=$('.menu-toggle'),nav=$('.site-nav');toggle?.addEventListener('click',()=>{const open=nav.classList.toggle('open');toggle.setAttribute('aria-expanded',open)});$$('.site-nav a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');toggle?.setAttribute('aria-expanded','false')}));
$$('.node').forEach(n=>n.addEventListener('click',()=>{world?.setAttribute('aria-label',`${n.dataset.node} selected`);$$('.node').forEach(x=>x.removeAttribute('aria-current'));n.setAttribute('aria-current','true')}));
if(!reduced&&matchMedia('(pointer:fine)').matches){addEventListener('pointermove',e=>{const x=(e.clientX/innerWidth-.5)*10,y=(e.clientY/innerHeight-.5)*10;world?.style.setProperty('--mx',`${x}px`);world?.style.setProperty('--my',`${y}px`)},{passive:true})}

async function submitConsultation(payload){
  const response=await fetch(`${API_BASE}/consultations`,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(payload)});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(body.error||'Consultation request could not be submitted');
  return body;
}

const consultationForm=$('[data-consultation-form]');
consultationForm?.addEventListener('submit',async event=>{
  event.preventDefault();
  const status=$('[data-form-status]',consultationForm),button=consultationForm.querySelector('button[type="submit"]');
  const data=Object.fromEntries(new FormData(consultationForm).entries());
  if(status)status.textContent='Submitting securely…';
  if(button)button.disabled=true;
  try{
    const result=await submitConsultation(data);
    consultationForm.reset();
    if(status)status.textContent=result.message||'Your consultation request has been received.';
  }catch(error){
    if(status)status.textContent=error.message;
  }finally{if(button)button.disabled=false;}
});
