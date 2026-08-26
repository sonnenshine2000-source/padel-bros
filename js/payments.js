import { supabase } from './supabase.js';
import { state } from './state.js';
import { $, escapeHtml, msg } from './utils.js';

export async function loadPayments(){
  const q=await supabase.from('payments').select('id,match_day_id,amount,paid,paid_at,paid_by,substitute_id,stammspieler_id,created_at,players_sub:substitute_id(name),players_main:stammspieler_id(name,paypal_email),match_days:match_day_id(match_date)').order('match_day_id',{ascending:false}).order('id',{ascending:false});
  if(q.error||!q.data?.length){$('payments').innerHTML='<div class="sub">Keine Zahlungen.</div>';return;}
  const groups=new Map();
  for(const p of q.data){const date=p.match_days?.match_date||'';if(!groups.has(date))groups.set(date,[]);groups.get(date).push(p);}
  const dates=[...groups.keys()].sort((a,b)=>b.localeCompare(a));
  const me=state.currentPlayer?.id;const isAdmin=state.currentPlayer?.is_admin===true;
  const formatDate=d=>{if(!d)return'';const [y,m,day]=String(d).slice(0,10).split('-');return `${day}.${m}.${y}`;};
  const cards=[];
  for(const date of dates){
    const entries=groups.get(date)||[];
    cards.push(`<section class="payment-history-day"><h3 style="margin:12px 0 8px">📅 ${escapeHtml(formatDate(date))}</h3><div class="list">${entries.map(p=>{
      const isPayer=Number(p.substitute_id)===Number(me);const paypal=p.players_main?.paypal_email||'';
      const copyBtn=paypal?`<button class="payment-copy-paypal" data-paypal="${escapeHtml(paypal)}">📋 PayPal-Mail kopieren</button>`:'';
      const action=p.paid?(isAdmin?`<button class="payment-undo" data-payment="${p.id}">↩ Zahlung zurücksetzen</button>`:''):(isPayer?`<button class="payment-paid" data-payment="${p.id}">✓ Ich habe bezahlt</button>`:'');
      return `<div class="item pay"><div><b>${escapeHtml(p.players_sub?.name||'Ersatzspieler')}</b> → ${escapeHtml(p.players_main?.name||'Stammspieler')}<br><small>${Number(p.amount).toFixed(2)} € · PayPal: ${escapeHtml(paypal||'—')}</small>${p.paid_at?`<br><small>Bezahlt am ${new Date(p.paid_at).toLocaleDateString('de-DE')}</small>`:''}${copyBtn?`<div style="margin-top:7px">${copyBtn}</div>`:''}</div><div style="text-align:right"><span class="${p.paid?'paid':'open'}">${p.paid?'✓ Bezahlt':'Offen'}</span>${action?`<div style="margin-top:7px">${action}</div>`:''}</div></div>`;
    }).join('')}</div></section>`);
  }
  $('payments').innerHTML=cards.join('');
  $('payments').querySelectorAll('.payment-paid').forEach(b=>b.onclick=()=>setPaid(Number(b.dataset.payment)));
  $('payments').querySelectorAll('.payment-undo').forEach(b=>b.onclick=()=>undoPaid(Number(b.dataset.payment)));
  $('payments').querySelectorAll('.payment-copy-paypal').forEach(b=>b.onclick=async()=>{const email=b.dataset.paypal;try{await navigator.clipboard.writeText(email);const old=b.textContent;b.textContent='✓ Kopiert';setTimeout(()=>b.textContent=old,1400);}catch(e){msg($('payments'),'PayPal-Mail konnte nicht kopiert werden.');}});
}
async function setPaid(id){const p=await supabase.from('payments').select('id,substitute_id,paid').eq('id',id).single();if(p.error)return msg($('payments'),p.error.message);if(Number(p.data.substitute_id)!==Number(state.currentPlayer?.id)){msg($('payments'),'Nur der zahlende Spieler kann diese Zahlung bestätigen.');return;}if(p.data.paid)return;const q=await supabase.from('payments').update({paid:true,paid_at:new Date().toISOString(),paid_by:state.currentPlayer.id}).eq('id',id).eq('substitute_id',state.currentPlayer.id);if(q.error){msg($('payments'),q.error.message);return;}await loadPayments();}
async function undoPaid(id){if(!state.currentPlayer?.is_admin)return;const q=await supabase.from('payments').update({paid:false,paid_at:null,paid_by:null}).eq('id',id);if(q.error){msg($('payments'),q.error.message);return;}await loadPayments();}
