import { supabase, SUPABASE_URL } from './supabase.js';
import { sendTestPush } from './notifications.js';
import { state } from './state.js';
import { $, msg, escapeHtml, nextTuesday } from './utils.js';

function formatError(value){if(!value)return'Unbekannter Fehler.';if(typeof value==='string')return value;try{return JSON.stringify(value)}catch{return String(value)}}
async function getSession(){return(await supabase.auth.getSession()).data.session}
async function callPlayerAuth(body){const session=await getSession();if(!session?.access_token)throw new Error('Nicht angemeldet.');const r=await fetch(SUPABASE_URL+'/functions/v1/player-auth',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify(body)});let data={};try{data=await r.json()}catch{}if(!r.ok)throw new Error(formatError(data.error||data.message)||'Fehler bei der Spielerverwaltung.');return data}

export async function loadPlayerAdmin(){
 if(!state.currentPlayer?.is_admin)return;
 const el=$('playerAdminList');if(!el)return;
 const q=await supabase.from('players').select('id,name,is_admin,is_stammspieler,paypal_email,paypal_me_url,active,auth_user_id,login_email').order('name');
 if(q.error){el.innerHTML='<div class="status err">'+escapeHtml(q.error.message)+'</div>';return;}
 el.innerHTML=`<div class="admin-add-player" style="display:grid;gap:8px;margin-bottom:14px;padding:12px;border:1px solid var(--line);border-radius:12px"><b>➕ Neuen Spieler hinzufügen</b><input id="newPlayerName" class="logininput" type="text" maxlength="60" placeholder="Name des Spielers"><label style="display:flex;gap:8px;align-items:center"><input id="newPlayerStamm" type="checkbox"> ⭐ Stammspieler</label><button class="primary" id="addPlayerButton">Spieler hinzufügen</button><div id="addPlayerStatus"></div></div>`+(q.data||[]).map(p=>`<div class="item"><div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><div><b>${escapeHtml(p.name)}</b>${p.is_admin?' 👑':''}${p.is_stammspieler?' <span class="star">⭐</span>':''}<div class="sub" style="margin:4px 0 0">${p.active===false?'🔒 Gesperrt':'🟢 Aktiv'} · ${p.auth_user_id?'PIN eingerichtet':'Noch keine PIN'}${p.paypal_me_url?' · 💶 PayPal.Me hinterlegt':' · ⚠️ Kein PayPal.Me'}</div></div><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="smallAdmin" data-action="paypalme" data-id="${p.id}" data-value="${escapeHtml(p.paypal_me_url||'')}">💶 PayPal.Me</button><button class="smallAdmin" data-action="pin" data-id="${p.id}">🔑 PIN</button><button class="smallAdmin" data-action="active" data-id="${p.id}">${p.active===false?'Freigeben':'Sperren'}</button><button class="smallAdmin" data-action="stamm" data-id="${p.id}">${p.is_stammspieler?'⭐ Stamm':'☆ Ersatz'}</button>${p.is_admin?'':'<button class="smallAdmin" data-action="delete" data-id="'+p.id+'">🗑️ Löschen</button>'}</div></div></div>`).join('')||'<div class="sub">Noch keine Spieler.</div>';
 $('addPlayerButton')?.addEventListener('click',addPlayer);
}

async function addPlayer(){const name=$('newPlayerName')?.value.trim();const stamm=Boolean($('newPlayerStamm')?.checked);if(!name){msg($('addPlayerStatus'),'Bitte einen Namen eingeben.');return}const b=$('addPlayerButton');if(b)b.disabled=true;try{await callPlayerAuth({action:'create_player',name,is_stammspieler:stamm});msg($('addPlayerStatus'),'Spieler wurde hinzugefügt.',true);if($('newPlayerName'))$('newPlayerName').value='';if($('newPlayerStamm'))$('newPlayerStamm').checked=false;await loadPlayerAdmin();}catch(e){msg($('addPlayerStatus'),e.message)}finally{if(b)b.disabled=false}}

async function setPaypalMe(id,current){let value=prompt('PayPal.Me-Link für diesen Spieler eingeben.\nBeispiel: paypal.me/Name',current||'');if(value===null)return;value=value.trim();if(value&&!/^(https?:\/\/)?(www\.)?paypal\.me\//i.test(value)){msg($('adminStatus'),'Bitte einen gültigen PayPal.Me-Link eingeben, z. B. paypal.me/Name.');return}const r=await supabase.from('players').update({paypal_me_url:value||null}).eq('id',id);if(r.error){msg($('adminStatus'),r.error.message);return}msg($('adminStatus'),value?'💶 PayPal.Me-Link gespeichert.':'💶 PayPal.Me-Link entfernt.',true);await loadPlayerAdmin()}

async function reloadMatchDay(id=state.matchDay?.id){if(!id)return null;const q=await supabase.from('match_days').select('id,match_date,poll_open,poll_closed,court_5_cancelled,court_1_cancelled,poll_push_sent_at,schedule_generated_at').eq('id',id).single();if(q.error){msg($('adminStatus'),q.error.message);return null}state.matchDay=q.data;return q.data}
async function sendBroadcastPush(type,title,body,matchDayId=state.matchDay?.id){const session=await getSession();if(!session?.access_token)return{ok:false,error:'Nicht angemeldet.'};try{const r=await fetch(SUPABASE_URL+'/functions/v1/send-push-v5',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.access_token},body:JSON.stringify({type,title,body,match_day_id:matchDayId})});let data={};try{data=await r.json()}catch{}return r.ok?data:{ok:false,error:formatError(data.error||data.message)||`HTTP ${r.status}`}}catch(e){return{ok:false,error:e.message||'Push konnte nicht gesendet werden.'}}}
async function openPoll(){
 const session=await getSession();
 if(!session?.access_token){msg($('adminStatus'),'Sitzung abgelaufen. Bitte einmal neu laden/anmelden.');return;}
 if(!state.currentPlayer?.is_admin){msg($('adminStatus'),'Nur der Admin kann eine neue Abstimmung öffnen.');return;}
 const targetDate=nextTuesday();
 const target=await supabase.from('match_days').select('id,match_date,poll_open,poll_closed,schedule_generated_at').eq('match_date',targetDate).maybeSingle();
 if(target.error){msg($('adminStatus'),target.error.message);return;}
 if(!target.data){msg($('adminStatus'),`Für ${targetDate} wurde noch kein Spieltag angelegt.`);return;}
 const b=$('openPoll');if(b){b.disabled=true;b.textContent='⏳ Wird geöffnet …'}
 try{const r=await supabase.from('match_days').update({poll_open:true,poll_closed:false,poll_push_sent_at:null}).eq('id',target.data.id);if(r.error){msg($('adminStatus'),r.error.message);return}await reloadMatchDay(target.data.id);const push=await sendBroadcastPush('poll_open','🎾 Neue Padel-Umfrage',`Die Umfrage für ${targetDate} ist jetzt geöffnet.`,target.data.id);msg($('adminStatus'),push?.ok?`🔓 Umfrage für ${targetDate} geöffnet · 🔔 Push gesendet.`:'🔓 Umfrage geöffnet · ⚠️ Push fehlgeschlagen: '+formatError(push?.error),Boolean(push?.ok))}finally{if(b){b.disabled=false;b.textContent='🔓 Umfrage öffnen'}}}
async function closePoll(){if(!state.currentPlayer?.is_admin||!state.matchDay)return;const b=$('closePoll');if(b){b.disabled=true;b.textContent='⏳ Wird geschlossen …'}try{const r=await supabase.from('match_days').update({poll_open:false,poll_closed:true}).eq('id',state.matchDay.id);if(r.error){msg($('adminStatus'),r.error.message);return}await reloadMatchDay();const push=await sendBroadcastPush('poll_close','🔒 Padel-Umfrage geschlossen',`Die Umfrage für ${state.matchDay.match_date} ist geschlossen.`);msg($('adminStatus'),push?.ok?'🔒 Umfrage geschlossen · 🔔 Push gesendet.':'🔒 Umfrage geschlossen · ⚠️ Push fehlgeschlagen: '+formatError(push?.error),Boolean(push?.ok))}finally{if(b){b.disabled=false;b.textContent='🔒 Umfrage schließen'}}}
async function handleTestPush(button){button.disabled=true;button.textContent='⏳ Wird gesendet …';try{const result=await sendTestPush();msg($('adminStatus'),result?.ok?'🔔 Test-Push wurde gesendet.':'❌ '+(result?.error||'Unbekannter Push-Fehler.'),Boolean(result?.ok))}catch(e){msg($('adminStatus'),e.message||'Fehler beim Test-Push.')}button.disabled=false;button.textContent='🔔 Test-Push senden'}

export function bindAdmin(){
 $('openPoll')?.addEventListener('click',openPoll);$('closePoll')?.addEventListener('click',closePoll);$('testPush')?.addEventListener('click',()=>handleTestPush($('testPush')));
 document.addEventListener('click',async e=>{const btn=e.target.closest('.smallAdmin');if(!btn)return;const id=Number(btn.dataset.id),action=btn.dataset.action;if(!id)return;
  if(action==='delete'){if(!confirm('Spieler wirklich löschen?\n\nWenn bereits Abstimmungen, Spiele oder Zahlungen vorhanden sind, wird das Löschen aus Schutzgründen abgelehnt.'))return;try{await callPlayerAuth({action:'delete_player',player_id:id});msg($('adminStatus'),'🗑️ Spieler wurde gelöscht.',true);await loadPlayerAdmin()}catch(err){msg($('adminStatus'),err.message)}return}
  try{
   if(action==='paypalme'){await setPaypalMe(id,btn.dataset.value||'');return}
   if(action==='pin'){const pin=prompt('Neue 6-stellige PIN für diesen Spieler:');if(!pin)return;if(!/^\d{6}$/.test(pin)){msg($('adminStatus'),'Die PIN muss genau 6 Ziffern enthalten.');return}await callPlayerAuth({action:'set_pin',player_id:id,pin});msg($('adminStatus'),'PIN wurde erfolgreich gesetzt.',true);await loadPlayerAdmin();return}
   if(action==='active'){const row=await supabase.from('players').select('active').eq('id',id).single();if(row.error)throw new Error(row.error.message);await callPlayerAuth({action:'set_active',player_id:id,active:!row.data.active});msg($('adminStatus'),row.data.active?'🔒 Spieler wurde gesperrt.':'🟢 Spieler wurde freigegeben.',true);await loadPlayerAdmin();return}
   if(action==='stamm'){const row=await supabase.from('players').select('is_stammspieler').eq('id',id).single();if(row.error)throw new Error(row.error.message);const r=await supabase.from('players').update({is_stammspieler:!row.data.is_stammspieler}).eq('id',id);if(r.error)throw new Error(r.error.message);await loadPlayerAdmin();return}
  }catch(err){msg($('adminStatus'),err.message||'Fehler bei der Spielerverwaltung.')}
 });
}
