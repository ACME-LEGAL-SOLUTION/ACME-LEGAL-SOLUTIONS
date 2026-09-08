const $=(s,c=document)=>c.querySelector(s);const $$=(s,c=document)=>[...c.querySelectorAll(s)];
const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
addEventListener('load',()=>setTimeout(()=>$('.loader')?.classList.add('done'),350));
const header=$('[data-header]'),progress=$('[data-progress]');
addEventListener('scroll',()=>{const max=document.documentElement.scrollHeight-innerHeight;progress.style.width=`${max>0?(scrollY/max)*100:0}%`;header.classList.toggle('scrolled',scrollY>40)},{passive:true});
const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-visible');io.unobserve(e.target)}}),{threshold:.12});
$$('.reveal').forEach((el,i)=>{if(!reduced)el.style.transitionDelay=`${Math.min(i%5,4)*60}ms`;io.observe(el)});
const world=$('[data-world]');if(world&&!reduced){const wo=new IntersectionObserver(e=>{if(e[0].isIntersecting){world.classList.add('is-active');wo.disconnect()}},{threshold:.25});wo.observe(world)}
const toggle=$('.menu-toggle'),nav=$('.site-nav');toggle?.addEventListener('click',()=>{const open=nav.classList.toggle('open');toggle.setAttribute('aria-expanded',open)});$$('.site-nav a').forEach(a=>a.addEventListener('click',()=>{nav.classList.remove('open');toggle?.setAttribute('aria-expanded','false')}));
$$('.node').forEach(n=>n.addEventListener('click',()=>{world?.setAttribute('aria-label',`${n.dataset.node} selected`);$$('.node').forEach(x=>x.removeAttribute('aria-current'));n.setAttribute('aria-current','true')}));
if(!reduced&&matchMedia('(pointer:fine)').matches){addEventListener('pointermove',e=>{const x=(e.clientX/innerWidth-.5)*10,y=(e.clientY/innerHeight-.5)*10;world?.style.setProperty('--mx',`${x}px`);world?.style.setProperty('--my',`${y}px`)},{passive:true})}
