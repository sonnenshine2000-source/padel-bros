import { supabase } from './supabase.js';
import { state } from './state.js';
import { $, escapeHtml, msg } from './utils.js';

async function paymentMatchDays(){
  const q=await supabase.from('match_days').select('id,match_date,poll_open,poll_closed,schedule_generated_at').lte('match_date',new Date().toISOString().slice(0,10)).order('match_date',{ascending:false}).limit(100);
  if(q.error)throw q.error; return q.data||[];
}
function paypalLink(url,amount){if(!url)return '';let u=String(url).trim();if(!/^https?:\/\//i.test(u))u='https://'+u;try{const x=new URL(u);if(!/paypal\.me$/i.test(x.hostname)&&!/.paypal\.me$/i.test(x.hostname))return '';const value=Math.round(Number(amount));if(!Number.isFinite(value)||value<=0)return '';x.pathname=x.pathname.replace(/\/+$/,'')+'/'+value+'EUR';return x.toString();}catch{return '';}}
export async function loadPayments(){
  const days=await paymentMatchDays();
  if(!days.length){$('payments').innerHTML='<div class="sub">Keine Zahlungen.</div>';return;}
  const all=[];
  for(const day of days){
    await supabase.rpc('rebuild_match_day_payments',{p_match_day_id:day.id});
    const q=await supabase.from('payments').select('id,match_day_id,amount,paid,paid_at,paid_by,substitute_id,stammspieler_id,players_sub:substitute_id(name,is_guest),players_main:stammspieler_id(name,paypal_email,paypal_me_url)').eq('match_day_id',day.id).order('id',{ascending:false});
    if(q.error)throw q.error; all.push({day,rows:q.data||[]});
  }
  const me=state.currentPlayer?.id,isAdmin=state.currentPlayer?.is_admin===true;
  $('payments').innerHTML=all.map(({day,rows})=>`<section class="payment-history-day"><h3>🎾 Spieltag ${new Date(day.match_date+'T12:00:00').toLocaleDateString('de-DE')}</h3>${rows.length?'<div class="list">'+rows.map(p=>{const isPayer=Number(p.substitute_id)===Number(me),paypal=p.players_main?.paypal_email||'',direct=paypalLink(p.players_main?.paypal_me_url,p.amount);const action=p.paid?(isAdmin?`<button class="payment-undo" data-payment="${p.id}">↩ Zahlung zurücksetzen</button>`):((isPayer&&!p.players_sub?.is_guest)?`<button class="payment-paid" data-payment="${p.id}">✓ Ich habe bezahlt</button>`:(isAdmin&&p.players_sub?.is_guest?`<button class="payment-paid" data-payment="${p.id}">✓ Zahlung als Admin bestätigen</button>`:''));return `<div class="item pay"><div><b>${escapeHtml(p.players_sub?.name||'Spieler')}</b>${p.players_sub?.is_guest?' <span class="badge">Gast</span>':''} → ${escapeHtml(p.players_main?.name||'Stammspieler')}<br><small>${Number(p.amount).toFixed(2)} € · PayPal: ${escapeHtml(paypal||'—')}</small>${direct&&!p.paid?`<div style="margin-top:7px"><a class="payment-paypal-direct" href="${escapeHtml(direct)}" target="_blank" rel="noopener">💶 ${Number(p.amount).toFixed(0)} € per PayPal bezahlen</a></div>`:''}</div><div style="text-align:right"><span class="${p.paid?'paid':'open'}">${p.paid?'✓ Bezahlt':'Offen'}</span>${action?`<div style="margin-top:7px">${action}</div>`:''}</div></div>`}).join('')+'</div>':'<div class="sub">Keine Zahlungen für diesen Spieltag.</div>'}</section>`).join('');
  $('payments').querySelectorAll('.payment-paid').forEach(b=>b.onclick=()=>setPaid(Number(b.dataset.payment)));$('payments').querySelectorAll('.payment-undo').forEach(b=>b.onclick=()=>undoPaid(Number(b.dataset.payment)));
}
async function setPaid(id){const p=await supabase.from('payments').select('id,substitute_id,paid,players_sub:substitute_id(is_guest)').eq('id',id).single();if(p.error)return msg($('payments'),p.error.message);const isAdmin=state.currentPlayer?.is_admin===true,isPayer=Number(p.data.substitute_id)===Number(state.currentPlayer?.id);if(p.data.paid||(!isPayer&&!isAdmin)){msg($('payments'),'Diese Zahlung kann hier nicht bestätigt werden.');return;}const q=await supabase.from('payments').update({paid:true,paid_at:new Date().toISOString(),paid_by:state.currentPlayer.id}).eq('id',id);if(q.error){msg($('payments'),q.error.message);return}await loadPayments();}
async function undoPaid(id){if(!state.currentPlayer?.is_admin)return;const q=await supabase.from('payments').update({paid:false,paid_at:null,paid_by:null}).eq('id',id);if(q.error){msg($('payments'),q.error.message);return}await loadPayments();}
