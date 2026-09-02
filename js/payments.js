import { supabase } from './supabase.js';
import { state } from './state.js';
import { $, escapeHtml, msg } from './utils.js';

async function paymentMatchDay(){
  const q=await supabase.from('match_days').select('id,match_date,poll_open,poll_closed,schedule_generated_at').lte('match_date',new Date().toISOString().slice(0,10)).eq('poll_closed',true).not('schedule_generated_at','is',null).order('match_date',{ascending:false}).limit(1).maybeSingle();
  return q.data||null;
}
function paypalLink(url,amount){
  if(!url)return '';
  let u=String(url).trim();if(!/^https?:\/\//i.test(u))u='https://'+u;
  try{const x=new URL(u);if(!/paypal\.me$/i.test(x.hostname)&&!/\.paypal\.me$/i.test(x.hostname))return '';const value=Math.round(Number(amount));if(!Number.isFinite(value)||value<=0)return '';x.pathname=x.pathname.replace(/\/+$/,'')+'/'+value+'EUR';return x.toString();}catch{return '';}
}
export async function loadPayments(){
  const day=await paymentMatchDay();
  if(!day){$('payments').innerHTML='<div class="sub">Keine Zahlungen.</div>';return;}
  await supabase.rpc('rebuild_match_day_payments',{p_match_day_id:day.id});
  const q=await supabase.from('payments').select('id,match_day_id,amount,paid,paid_at,paid_by,substitute_id,stammspieler_id,players_sub:substitute_id(name,is_guest),players_main:stammspieler_id(name,paypal_email,paypal_me_url),match_days:match_day_id(match_date)').eq('match_day_id',day.id).order('id',{ascending:false});
  if(q.error||!q.data?.length){$('payments').innerHTML='<div class="sub">Keine offenen Zahlungen.</div>';return;}
  const me=state.currentPlayer?.id;const isAdmin=state.currentPlayer?.is_admin===true;
  $('payments').innerHTML='<div class="list">'+q.data.map(p=>{
    const isPayer=Number(p.substitute_id)===Number(me);const paypal=p.players_main?.paypal_email||'';const direct=paypalLink(p.players_main?.paypal_me_url,p.amount);const matchDate=p.match_days?.match_date?new Date(p.match_days.match_date+'T12:00:00').toLocaleDateString('de-DE'):'—';
    const copyBtn=paypal?`<button class="payment-copy-paypal" data-paypal="${escapeHtml(paypal)}">📋 PayPal-Mail kopieren</button>`:'';
    const payBtn=direct&&!p.paid?`<a class="payment-paypal-direct" href="${escapeHtml(direct)}" target="_blank" rel="noopener">💶 ${Number(p.amount).toFixed(0)} € per PayPal bezahlen</a>`:'';
    const action=p.paid?(isAdmin?`<button class="payment-undo" data-payment="${p.id}">↩ Zahlung zurücksetzen</button>`):((isPayer&&!p.players_sub?.is_guest)?`<button class="payment-paid" data-payment="${p.id}">✓ Ich habe bezahlt</button>`:(isAdmin&&p.players_sub?.is_guest?`<button class="payment-paid" data-payment="${p.id}">✓ Zahlung als Admin bestätigen</button>`:''));
    return `<div class="item pay"><div><b>${escapeHtml(p.players_sub?.name||'Spieler')}</b>${p.players_sub?.is_guest?' <span class="badge">Gast</span>':''} → ${escapeHtml(p.players_main?.name||'Stammspieler')}<br><small>🎾 Spieltag: ${matchDate}</small><br><small>${Number(p.amount).toFixed(2)} € · PayPal: ${escapeHtml(paypal||'—')}</small>${p.paid_at?`<br><small>Bezahlt am ${new Date(p.paid_at).toLocaleDateString('de-DE')}</small>`:''}${payBtn?`<div style="margin-top:7px">${payBtn}</div>`:''}${copyBtn?`<div style="margin-top:7px">${copyBtn}</div>`:''}</div><div style="text-align:right"><span class="${p.paid?'paid':'open'}">${p.paid?'✓ Bezahlt':'Offen'}</span>${action?`<div style="margin-top:7px">${action}</div>`:''}</div></div>`;
  }).join('')+'</div>';
  $('payments').querySelectorAll('.payment-paid').forEach(b=>b.onclick=()=>setPaid(Number(b.dataset.payment)));
  $('payments').querySelectorAll('.payment-undo').forEach(b=>b.onclick=()=>undoPaid(Number(b.dataset.payment)));
  $('payments').querySelectorAll('.payment-copy-paypal').forEach(b=>b.onclick=async()=>{const email=b.dataset.paypal;try{await navigator.clipboard.writeText(email);const old=b.textContent;b.textContent='✓ Kopiert';setTimeout(()=>b.textContent=old,1400);}catch(e){msg($('payments'),'PayPal-Mail konnte nicht kopiert werden.');}});
}
async function setPaid(id){const p=await supabase.from('payments').select('id,substitute_id,paid,players_sub:substitute_id(is_guest)').eq('id',id).single();if(p.error)return msg($('payments'),p.error.message);const isAdmin=state.currentPlayer?.is_admin===true;const isPayer=Number(p.data.substitute_id)===Number(state.currentPlayer?.id);const isGuest=p.data.players_sub?.is_guest===true;if(p.data.paid)return;if(!isPayer&&!(!isGuest&&isAdmin)&&!(isGuest&&isAdmin)){msg($('payments'),'Diese Zahlung kann hier nicht bestätigt werden.');return;}const update={paid:true,paid_at:new Date().toISOString(),paid_by:state.currentPlayer.id};const q=await supabase.from('payments').update(update).eq('id',id).eq(isGuest&&isAdmin?'id':'substitute_id',isGuest&&isAdmin?id:state.currentPlayer.id);if(q.error){msg($('payments'),q.error.message);return;}await loadPayments();}
async function undoPaid(id){if(!state.currentPlayer?.is_admin)return;const q=await supabase.from('payments').update({paid:false,paid_at:null,paid_by:null}).eq('id',id);if(q.error){msg($('payments'),q.error.message);return;}await loadPayments();}
