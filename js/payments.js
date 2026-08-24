import { supabase } from './supabase.js';
import { state } from './state.js';
import { $, escapeHtml, msg } from './utils.js';

export async function loadPayments() {
  const q = await supabase.from('payments').select('id,amount,paid,paid_at,paid_by,substitute_id,stammspieler_id,players_sub:substitute_id(name),players_main:stammspieler_id(name,paypal_email)').eq('match_day_id', state.matchDay.id);
  if (q.error || !q.data?.length) { $('payments').innerHTML='<div class="sub">Keine offenen Zahlungen.</div>'; return; }
  const me=state.currentPlayer?.id;
  $('payments').innerHTML='<div class="list">'+q.data.map(p=>{
    const isPayer=Number(p.substitute_id)===Number(me); const isAdmin=state.currentPlayer?.is_admin===true;
    const action=p.paid
      ? `${isAdmin?`<button class="payment-undo" data-payment="${p.id}">↩ Zahlung zurücksetzen</button>`:''}`
      : (isPayer?`<button class="payment-paid" data-payment="${p.id}">✓ Ich habe bezahlt</button>`:'');
    return `<div class="item pay"><div><b>${escapeHtml(p.players_sub?.name||'Ersatzspieler')}</b> → ${escapeHtml(p.players_main?.name||'Stammspieler')}<br><small>${Number(p.amount).toFixed(2)} € · PayPal: ${escapeHtml(p.players_main?.paypal_email||'—')}${p.paid_at?` · ${new Date(p.paid_at).toLocaleDateString('de-DE')}`:''}</small></div><div style="text-align:right"><span class="${p.paid?'paid':'open'}">${p.paid?'✓ Bezahlt':'Offen'}</span>${action?`<div style="margin-top:7px">${action}</div>`:''}</div></div>`;
  }).join('')+'</div>';
  $('payments').querySelectorAll('.payment-paid').forEach(b=>b.onclick=()=>setPaid(Number(b.dataset.payment)));
  $('payments').querySelectorAll('.payment-undo').forEach(b=>b.onclick=()=>undoPaid(Number(b.dataset.payment)));
}
async function setPaid(id){const p=await supabase.from('payments').select('id,substitute_id,paid').eq('id',id).single();if(p.error)return msg($('payments'),p.error.message);if(Number(p.data.substitute_id)!==Number(state.currentPlayer?.id)){msg($('payments'),'Nur der zahlende Spieler kann diese Zahlung bestätigen.');return;}if(p.data.paid)return;const q=await supabase.from('payments').update({paid:true,paid_at:new Date().toISOString(),paid_by:state.currentPlayer.id}).eq('id',id).eq('substitute_id',state.currentPlayer.id);if(q.error){msg($('payments'),q.error.message);return;}await loadPayments();}
async function undoPaid(id){if(!state.currentPlayer?.is_admin)return;const q=await supabase.from('payments').update({paid:false,paid_at:null,paid_by:null}).eq('id',id);if(q.error){msg($('payments'),q.error.message);return;}await loadPayments();}
