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
  box.innerHTML=`<b>👤 Externen Gast hinzufügen</b><div class="sub" style="margin:0">Der Gast bekommt keinen Login und erscheint nur bei diesem Spieltag.</div><input id="guestName" class="logininput" type="text" maxlength="60" placeholder="Name des Gastes"><select id="guestTime" class="logininput"><option value="18:30">18:30 Uhr</option><option value="19:00">19:00 Uhr</option><option value="egal" selected>Egal wann</option><option value="nein">Kann nicht</option></select><button class="primary" id="addGuestButton">👤 Gast hinzufügen</button><div id="guestStatus"></div>${(q.data||[]).length?`<div class="sub" style="margin:4px 0 0"><b>Gäste dieses Spieltags:</b> ${(q.data||[]).map(g=>`<span class="namechip">${escapeHtml(g.name)} · Gast</span>`).join(' ')}</div>`:''}`;
  $('addGuestButton')?.addEventListener('click',addGuest);
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
