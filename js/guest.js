import { supabase } from './supabase.js';
import { state } from './state.js';
import { $, msg, escapeHtml } from './utils.js';

export async function loadGuestAdmin(){
  if(!state.currentPlayer?.is_admin)return;
  const host=$('playerAdminList');
  if(!host||!state.matchDay)return;
  let box=$('guestAdminBox');
  if(!box){
    box=document.createElement('div');
    box.id='guestAdminBox';
    box.style.cssText='display:grid;gap:8px;margin:0 0 14px;padding:12px;border:1px solid var(--pink);border-radius:12px;background:#fff8f9';
    host.prepend(box);
  }
  const q=await supabase.from('players').select('id,name').eq('is_guest',true).eq('guest_match_day_id',state.matchDay.id).order('name');
  if(q.error){box.innerHTML='<b>👤 Externer Gast</b><div class="status err">'+escapeHtml(q.error.message)+'</div>';return;}
  const guests=q.data||[];
  box.innerHTML=`<b>👤 Externen Gast hinzufügen</b><div class="sub" style="margin:0">Der Gast bekommt keinen Login und erscheint nur bei diesem Spieltag.</div><input id="guestName" class="logininput" type="text" maxlength="60" placeholder="Name des Gastes"><select id="guestTime" class="logininput"><option value="18:30">18:30 Uhr</option><option value="19:00">19:00 Uhr</option><option value="egal" selected>Egal wann</option><option value="nein">Kann nicht</option></select><button class="primary" id="addGuestButton">👤 Gast hinzufügen</button><div id="guestStatus"></div>${guests.length?`<div class="sub" style="margin:4px 0 0"><b>Gäste dieses Spieltags:</b></div>${guests.map(g=>`<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:7px 0;border-top:1px solid var(--line)"><span class="namechip">${escapeHtml(g.name)} · Gast</span><button class="smallAdmin guestRemoveButton" data-guest-id="${g.id}">🗑️ Gast entfernen</button></div>`).join('')}`:''}`;
  $('addGuestButton')?.addEventListener('click',addGuest);
  box.querySelectorAll('.guestRemoveButton').forEach(b=>b.addEventListener('click',()=>removeGuest(Number(b.dataset.guestId),b)));
}

async function addGuest(){
  const name=$('guestName')?.value.trim();
  const response=$('guestTime')?.value||'egal';
  if(!name)return msg($('guestStatus'),'Bitte einen Namen eingeben.');
  if(!state.matchDay)return msg($('guestStatus'),'Kein aktiver Spieltag gefunden.');
  const b=$('addGuestButton');if(b){b.disabled=true;b.textContent='⏳ Wird hinzugefügt …';}
  try{
    const r=await supabase.rpc('admin_add_guest',{p_match_day_id:state.matchDay.id,p_name:name,p_response:response});
    if(r.error)throw r.error;
    msg($('guestStatus'),`✅ ${name} wurde als Gast hinzugefügt und in die Abstimmung aufgenommen.`,true);
    if($('guestName'))$('guestName').value='';
    await loadGuestAdmin();
    document.dispatchEvent(new CustomEvent('poll-updated'));
  }catch(e){msg($('guestStatus'),'Gast konnte nicht hinzugefügt werden: '+(e.message||'Unbekannter Fehler.'));}
  finally{if(b){b.disabled=false;b.textContent='👤 Gast hinzufügen';}}
}

async function removeGuest(id,button){
  if(!id)return;
  if(!confirm('Gast wirklich von diesem Spieltag entfernen?\n\nDer Gast wird aus der Abstimmung entfernt. Falls er bereits im Spielplan, Ergebnis oder bei einer Zahlung verwendet wird, verhindert die App das Löschen.'))return;
  if(button){button.disabled=true;button.textContent='⏳ Entfernen …';}
  try{
    const r=await supabase.rpc('admin_remove_guest',{p_player_id:id});
    if(r.error)throw r.error;
    msg($('guestStatus'),'🗑️ Gast wurde von diesem Spieltag entfernt.',true);
    await loadGuestAdmin();
    document.dispatchEvent(new CustomEvent('poll-updated'));
    document.dispatchEvent(new CustomEvent('schedule-updated'));
  }catch(e){msg($('guestStatus'),'Gast konnte nicht entfernt werden: '+(e.message||'Unbekannter Fehler.'));if(button){button.disabled=false;button.textContent='🗑️ Gast entfernen';}}
}
