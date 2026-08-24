import { supabase } from './supabase.js';
import { state } from './state.js';
import { $, escapeHtml, msg } from './utils.js';

function courtLabel(court){ return court === 'court5' ? 'Court 5' : 'Court 1'; }

export async function loadCancelledCourts(){
  const el=$('cancelledHistory'); if(!el)return;
  const q=await supabase.from('cancelled_courts').select(`id,original_booking_date,original_court,original_time,replacement_court,replacement_date,status,created_at,cancelled_court_credits(id,credit_amount,used_at,players:player_id(name))`).order('created_at',{ascending:false});
  if(q.error){el.innerHTML=`<div class="status err">${escapeHtml(q.error.message)}</div>`;return;}
  const pending=(q.data||[]).filter(x=>x.status!=='settled');
  const select=$('makeupCancellation');
  if(select){select.innerHTML='<option value="">Stornierung auswählen …</option>'+pending.map(c=>`<option value="${c.id}">${escapeHtml(c.original_booking_date||'')} · ${escapeHtml(courtLabel(c.original_court))}</option>`).join('');}
  if(!q.data?.length){el.innerHTML='<div class="sub">Noch keine stornierten Courts.</div>';return;}
  el.innerHTML=q.data.map(c=>{const credits=c.cancelled_court_credits||[];const open=credits.filter(x=>!x.used_at).length;const makeup=c.replacement_date?`Nachholcourt: ${escapeHtml(c.replacement_date)} · ${escapeHtml(courtLabel(c.replacement_court))}`:'Nachholtermin noch offen';return `<div class="cancelled-item"><div class="cancelled-head"><div><b>🔄 ${escapeHtml(courtLabel(c.original_court))}</b><div class="sub">${escapeHtml(c.original_booking_date||'Datum unbekannt')} · ${escapeHtml(c.original_time||'')}</div></div><span class="count">${c.status==='settled'?'Abgerechnet':'Offen'}</span></div><div class="sub">${makeup}</div><div class="sub">Guthaben der ursprünglichen Spieler:</div><div class="credit-list">${credits.map(x=>`<div class="credit-row"><span><b>${escapeHtml(x.players?.name||'Spieler')}</b></span><span class="credit-amount">${Number(x.credit_amount).toFixed(2).replace('.',',')} €${x.used_at?' · eingelöst':' · offen'}</span></div>`).join('')}</div><div class="sub" style="margin:10px 0 0">${open} offene Guthaben</div></div>`}).join('');
}

async function cancelCourt(court){
  if(!state.currentPlayer?.is_admin||!state.matchDay?.id)return;
  const label=courtLabel(court);
  if(!confirm(`${label} für ${state.matchDay.match_date} wirklich stornieren?\n\nDie 4 aktuell zugeordneten Spieler erhalten jeweils 15 € Guthaben für den Nachholcourt.`))return;
  const {data:existing}=await supabase.from('cancelled_courts').select('id').eq('match_day_id',state.matchDay.id).eq('original_court',court).maybeSingle();
  if(existing){msg($('adminStatus'),`${label} wurde bereits storniert.`);return;}
  const {data:assignments,error:assignmentError}=await supabase.from('assignments').select('player_id,position').eq('match_day_id',state.matchDay.id).eq('court',court).order('position');
  if(assignmentError){msg($('adminStatus'),'Spieler konnten nicht geladen werden: '+assignmentError.message);return;}
  const players=(assignments||[]).filter(x=>x.player_id).slice(0,4);
  if(players.length!==4){msg($('adminStatus'),`${label} kann erst storniert werden, wenn genau 4 Spieler zugeordnet sind.`);return;}
  const {data:cancelled,error}=await supabase.from('cancelled_courts').insert({match_day_id:state.matchDay.id,original_booking_date:state.matchDay.match_date,original_court:court,original_time:court==='court5'?'18:30':'19:00',status:'pending'}).select('id').single();
  if(error){msg($('adminStatus'),'Stornierung konnte nicht gespeichert werden: '+error.message);return;}
  const creditResult=await supabase.from('cancelled_court_credits').insert(players.map(p=>({cancelled_court_id:cancelled.id,player_id:p.player_id,credit_amount:15})));
  if(creditResult.error){await supabase.from('cancelled_courts').delete().eq('id',cancelled.id);msg($('adminStatus'),'Guthaben konnten nicht gespeichert werden: '+creditResult.error.message);return;}
  const flag=court==='court5'?{court_5_cancelled:true}:{court_1_cancelled:true};const update=await supabase.from('match_days').update(flag).eq('id',state.matchDay.id);
  if(update.error){msg($('adminStatus'),'Court wurde gespeichert, aber der Spieltag konnte nicht aktualisiert werden: '+update.error.message);return;}
  state.matchDay={...state.matchDay,...flag};msg($('adminStatus'),`🔄 ${label} storniert. 4 × 15 € Guthaben wurden angelegt. Nachholtermin kann später festgelegt werden.`,true);await loadCancelledCourts();
}

async function assignMakeup(){
  if(!state.currentPlayer?.is_admin)return;
  const id=$('makeupCancellation')?.value,date=$('makeupDate')?.value,court=$('makeupCourt')?.value;
  if(!id||!date||!court){msg($('cancellationStatus'),'Bitte Stornierung, Datum und Court auswählen.');return;}
  const collision=await supabase.from('cancelled_courts').select('id').eq('replacement_date',date).eq('replacement_court',court).neq('id',Number(id)).maybeSingle();
  if(collision.error){msg($('cancellationStatus'),collision.error.message);return;}
  if(collision.data){msg($('cancellationStatus'),'Dieser Court ist bereits als Nachholcourt verplant.');return;}
  const q=await supabase.from('cancelled_courts').update({replacement_date:date,replacement_court:court,status:'pending'}).eq('id',Number(id));
  if(q.error){msg($('cancellationStatus'),'Nachholcourt konnte nicht gespeichert werden: '+q.error.message);return;}
  msg($('cancellationStatus'),`🔄 ${courtLabel(court)} am ${date} wurde als Nachholcourt verknüpft.`,true);await loadCancelledCourts();
}

export function bindCancellations(){
  document.querySelectorAll('[data-cancel-court]').forEach(button=>button.onclick=()=>cancelCourt(button.dataset.cancelCourt));
  $('assignMakeup')?.addEventListener('click',assignMakeup);
}
