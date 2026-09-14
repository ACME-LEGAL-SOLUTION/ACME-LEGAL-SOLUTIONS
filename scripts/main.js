const $=(s,c=document)=>c.querySelector(s);const $$=(s,c=document)=>[...c.querySelectorAll(s)];
const APPROVED_ACME_LOGO='assets/brand/acme-logo.jpg';
// STRICT BRAND RULE: the supplied ACME artwork is the only approved public mark.
$$('img[src*="acme-logo-approved.svg"],img[src*="acme-logo-clean.svg"]').forEach(img=>{img.src=APPROVED_ACME_LOGO;img.removeAttribute('srcset')});
$$('link[rel~="icon"]').forEach(link=>{link.href=APPROVED_ACME_LOGO;link.type='image/jpeg'});
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;const API_BASE='/api';const INDIA_CODE_API='https://indiacode.ecourtsindia.com/api/v1';
addEventListener('load',()=>setTimeout(()=>$('.loader')?.classList.add('done'),350));
const header=$('[data-header]'),progress=$('[data-progress]');
addEventListener('scroll',()=>{const max=document.documentElement.scrollHeight-innerHeight;if(progress)progress.style.width=`${max>0?(scrollY/max)*100:0}%`;header?.classList.toggle('scrolled',scrollY>40)},{passive:true});
const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-visible');io.unobserve(e.target)}}),{threshold:.12});
$$('.reveal').forEach((el,i)=>{if(!reduced)el.style.transitionDelay=`${Math.min(i%5,4)*45}ms`;io.observe(el)});
const world=$('[data-world]');if(world&&!reduced){const wo=new IntersectionObserver(e=>{if(e[0].isIntersecting){world.classList.add('is-active');wo.disconnect()}},{threshold:.25});wo.observe(world)}
const heroVisual=$('.hero-visual');if(heroVisual&&!reduced&&matchMedia('(pointer:fine)').matches){heroVisual.addEventListener('pointermove',e=>{const r=heroVisual.getBoundingClientRect();const x=(e.clientX-r.left)/r.width-.5;const y=(e.clientY-r.top)/r.height-.5;heroVisual.style.setProperty('--hero-x',`${x*12}px`);heroVisual.style.setProperty('--hero-y',`${y*12}px`)},{passive:true});heroVisual.addEventListener('pointerleave',()=>{heroVisual.style.setProperty('--hero-x','0px');heroVisual.style.setProperty('--hero-y','0px')})}
const toggle=$('.menu-toggle'),nav=$('.site-nav');toggle?.addEventListener('click',()=>{const open=nav.classList.toggle('open');toggle.setAttribute('aria-expanded',open)});$$('.site-nav a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');toggle?.setAttribute('aria-expanded','false')}));
$$('.node').forEach(n=>n.addEventListener('click',()=>{world?.setAttribute('aria-label',`${n.dataset.node} selected`);$$('.node').forEach(x=>x.removeAttribute('aria-current'));n.setAttribute('aria-current','true')}));
if(!reduced&&matchMedia('(pointer:fine)').matches){addEventListener('pointermove',e=>{const x=(e.clientX/innerWidth-.5)*10,y=(e.clientY/innerHeight-.5)*10;world?.style.setProperty('--mx',`${x}px`);world?.style.setProperty('--my',`${y}px`)},{passive:true})}

async function submitConsultation(payload){const response=await fetch(`${API_BASE}/consultations`,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'same-origin',body:JSON.stringify(payload)});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.error||'Consultation request could not be submitted. Please check your details and try again.');return body;}
async function researchLegalQuery(query){
  try{const response=await fetch(`${API_BASE}/legal-research?q=${encodeURIComponent(query)}&limit=6`,{headers:{Accept:'application/json'},credentials:'same-origin'});if(response.ok){const body=await response.json();return body}}
  catch{}
  const response=await fetch(`${INDIA_CODE_API}/search?q=${encodeURIComponent(query)}&limit=6`,{headers:{Accept:'application/json'}});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.error||'The public legal research source is temporarily unavailable.');return {query,source:'India Code',classification:{jurisdiction:'India'},results:(body.results||[]).map(r=>({...r,source:'India Code',sourceType:'public_primary',verification:'source_returned'})),disclaimer:'Public-source retrieval only. Verify the authority and current legal state with a qualified professional.'};
}
function validateForm(form){let valid=true;form.querySelectorAll('[required]').forEach(field=>{const bad=!field.value.trim()||(field.type==='email'&&!/^\S+@\S+\.\S+$/.test(field.value));field.setAttribute('aria-invalid',bad?'true':'false');if(bad)valid=false});return valid}
function escapeHtml(value){return String(value||'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function renderResearch(modal,result){const box=$('[data-ask-results]',modal);if(!box)return;const rows=Array.isArray(result.results)?result.results:[];box.innerHTML=`<div class="ask-results-head"><span>RESEARCH OUTPUT / ${escapeHtml(result.source||'PUBLIC SOURCE')}</span><b>${rows.length} source${rows.length===1?'':'s'}</b></div>${rows.length?`<div class="ask-results-list">${rows.map((r,i)=>`<article class="ask-result"><div><small>#${i+1} · ${escapeHtml(r.source||result.source||'Public source')}</small><h3>${escapeHtml(r.title||r.name||r.act||'Legal authority')}</h3>${r.section?`<p>Section ${escapeHtml(r.section)}</p>`:''}${r.snippet?`<p>${escapeHtml(r.snippet)}</p>`:''}</div>${r.url?`<a href="${escapeHtml(r.url)}" target="_blank" rel="noopener noreferrer">SOURCE ↗</a>`:''}</article>`).join('')}</div>`:'<p class="ask-results-empty">No matching public source was returned. Refine the facts, jurisdiction or section and try again.'}<p class="ask-results-note">Source-retrieval output only. Verify the authority, current legal state and application with a qualified professional.</p>`;box.hidden=false}
function openAskAcme(){
  if($('.ask-acme-modal'))return $('.ask-acme-modal textarea')?.focus();
  const modal=document.createElement('div');modal.className='ask-acme-modal';modal.innerHTML=`<div class="ask-acme-panel" role="dialog" aria-modal="true" aria-labelledby="ask-acme-title"><button class="ask-acme-close" type="button" aria-label="Close Ask ACME">×</button><p class="eyebrow dark">ACME / ASK ACME</p><h2 id="ask-acme-title">Ask the <em>question.</em></h2><p>Describe the legal issue. ACME will search a public primary legal source and return ranked research results. Results are research output, not legal advice.</p><form class="ask-acme-form" data-ask-form novalidate><label>What do you need help with?<textarea name="summary" rows="4" required placeholder="Example: Cheque dishonour matter against a company in Mumbai under Section 138…"></textarea></label><label>Jurisdiction<input name="jurisdiction" placeholder="e.g. India, Maharashtra"></label><label>Urgency<select name="urgency"><option value="standard">Standard</option><option value="urgent">Urgent</option><option value="critical">Critical</option></select></label><label>Your email (optional)<input name="email" type="email" autocomplete="email" placeholder="name@example.com"></label><div class="ask-acme-actions"><button class="button button-gold ask-acme-submit" type="submit">Research with ACME <span>→</span></button><button class="text-link" type="button" data-ask-cancel>Close</button></div><p class="ask-acme-status" data-ask-status role="status" aria-live="polite"></p><div class="ask-results" data-ask-results hidden></div><p class="ask-acme-hint">Do not send passwords, payment credentials or highly sensitive documents through this public intake.</p></form></div>`;document.body.append(modal);
  const form=$('[data-ask-form]',modal),status=$('[data-ask-status]',modal),button=$('.ask-acme-submit',modal);const close=()=>modal.remove();$('.ask-acme-close',modal).addEventListener('click',close);$('[data-ask-cancel]',modal).addEventListener('click',close);modal.addEventListener('click',e=>{if(e.target===modal)close()});
  form.querySelectorAll('input,textarea,select').forEach(field=>field.addEventListener('input',()=>field.setAttribute('aria-invalid','false')));
  form.addEventListener('submit',async e=>{e.preventDefault();status.dataset.state='';status.textContent='';if(!validateForm(form)){status.dataset.state='error';status.textContent='Please describe the legal issue.';form.querySelector('[aria-invalid="true"]')?.focus();return}const data=Object.fromEntries(new FormData(form).entries());const query=[data.summary,data.jurisdiction].filter(Boolean).join(' in ');button.disabled=true;status.dataset.state='busy';status.textContent='Researching public legal sources…';try{const result=await researchLegalQuery(query);renderResearch(modal,result);status.dataset.state='success';status.textContent='Research complete.'}catch(error){status.dataset.state='error';status.textContent=error.message}finally{button.disabled=false}});
  $('[name="summary"]',modal)?.focus();
}
function openConsultation(){
  if($('.consultation-modal'))return $('.consultation-modal input')?.focus();
  const modal=document.createElement('div');modal.className='consultation-modal';modal.innerHTML=`<div class="consultation-panel" role="dialog" aria-modal="true" aria-labelledby="consultation-title"><button class="consultation-close" type="button" aria-label="Close consultation">×</button><p class="eyebrow">ACME / CONSULTATION</p><h2 id="consultation-title">Bring ACME <em>the matter.</em></h2><p>Share the essential facts. This is an intake request, not a final legal opinion.</p><form data-consultation-form novalidate><label>Name<input name="name" autocomplete="name" required></label><label>Email<input name="email" type="email" autocomplete="email" required></label><label>Phone<input name="phone" type="tel" autocomplete="tel"></label><label>Subject<input name="subject" required></label><label>Jurisdiction<input name="jurisdiction" placeholder="e.g. India, Hong Kong"></label><label>Urgency<select name="urgency"><option value="standard">Standard</option><option value="urgent">Urgent</option><option value="critical">Critical</option></select></label><label>Matter summary<textarea name="summary" rows="5" required></textarea></label><button class="button button-gold" type="submit">Submit consultation <span>↗</span></button><p class="form-status" data-form-status role="status" aria-live="polite"></p></form></div>`;document.body.append(modal);
  const form=$('[data-consultation-form]',modal),status=$('[data-form-status]',form),button=form.querySelector('button[type="submit"]'),close=()=>modal.remove();$('.consultation-close',modal).addEventListener('click',close);modal.addEventListener('click',e=>{if(e.target===modal)close()});
  form.querySelectorAll('input,textarea,select').forEach(field=>field.addEventListener('input',()=>field.setAttribute('aria-invalid','false')));
  form.addEventListener('submit',async e=>{e.preventDefault();status.dataset.state='';status.textContent='';if(!validateForm(form)){status.dataset.state='error';status.textContent='Please complete the required fields and check your email address.';form.querySelector('[aria-invalid="true"]')?.focus();return}const data=Object.fromEntries(new FormData(form).entries());button.disabled=true;status.dataset.state='busy';status.textContent='Submitting securely…';try{const result=await submitConsultation(data);form.reset();status.dataset.state='success';status.textContent=result.message||'Your consultation request has been received.'}catch(error){status.dataset.state='error';status.textContent=error.message}finally{button.disabled=false}});
  $('.consultation-modal input',modal)?.focus();
}
$$('[data-ask-acme]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();openAskAcme()}));
$$('a[href^="mailto:"]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();openConsultation()}));
$$('.floating a[href="#consultation"]').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();openConsultation()}));

/* ACME opening experience: small logo animation -> one centered Disclaimer -> website. */
(function(){
  const loader=document.querySelector('.intro-loader[data-loader]');
  const gateway=document.querySelector('[data-consent-gateway]');
  const site=document.querySelector('[data-site]');
  const drawer=document.querySelector('[data-legal-drawer]');
  const accept=document.querySelector('[data-consent-accept]');
  const prefs=document.querySelector('[data-consent-preferences]');
  const reset=document.querySelector('[data-consent-reset]');
  const reveal=()=>{if(site)site.hidden=false;if(gateway)gateway.hidden=true;document.body.classList.remove('is-locked')};
  const show=()=>{if(site)site.hidden=true;if(gateway){gateway.hidden=false;document.body.classList.add('is-locked')}};
  if(drawer)drawer.hidden=true;
  if(loader){loader.classList.remove('done');setTimeout(()=>loader.classList.add('done'),900)}
  let acknowledged=false;try{acknowledged=sessionStorage.getItem('acme_entry_ack')==='1'}catch{}
  if(!acknowledged){show();setTimeout(show,950)}else{reveal()}
  const acknowledge=()=>{try{sessionStorage.setItem('acme_entry_ack','1')}catch{};reveal()};
  accept?.addEventListener('click',acknowledge);
  prefs?.addEventListener('click',acknowledge);
  reset?.addEventListener('click',()=>{try{sessionStorage.removeItem('acme_entry_ack')}catch{};show()});
  document.querySelectorAll('[data-legal]').forEach(btn=>btn.addEventListener('click',()=>{if(drawer)drawer.hidden=false}));
  document.querySelector('[data-legal-close]')?.addEventListener('click',()=>{if(drawer)drawer.hidden=true});
  drawer?.addEventListener('click',e=>{if(e.target===drawer)drawer.hidden=true});
})();