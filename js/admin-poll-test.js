import { supabase, SUPABASE_URL } from './supabase.js';
import { state } from './state.js';

const esc=(s)=>String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));

export function bindAdminPollTest(){
  const card=document.querySelector('#adminCard');
  if(!card)return;
  let box=document.querySelector('#adminPollTest');
  if(!box){
    box=document.createElement('div');
    box.id='adminPollTest';
    box.style.cssText='margin-top:20px;padding-top:18px;border-top:1px solid var(--line)';
    box.innerHTML=`<h3 style="margin:0 0 5px">🧪 Abstimmung testen</h3><div class="sub">Nur für den Admin. Damit kannst du die aktuelle Abstimmung eines Spielers ändern, ohne dich mit dessen Konto anzumelden.</div><label for="testPollPlayer">Spieler</label><select id="testPollPlayer" class="logininput"><option value="">Spieler auswählen …</option></select><label for="testPollResponse" style="display:block;margin-top:8px">Antwort</label><select id="testPollResponse" class="logininput"><option value="18:30">🟢 18:30 Uhr</option><option value="19:00">🔵 19:00 Uhr</option><option value="egal">🟣 Egal wann</option><option value="nein">🔴 Kann nicht</option></select><button id="testPollSet" class="primary" style="margin-top:10px">🧪 Test-Abstimmung setzen</button><div id="testPollStatus"></div>`;
    card.appendChild(box);
    document.querySelector('#testPollSet').onclick=setPoll;
  }
  loadPlayers();
}

async function loadPlayers(){
  const sel=document.querySelector('#testPollPlayer');
  const status=document.querySelector('#testPollStatus');
  if(!sel)return;
  if(!state.currentPlayer?.is_admin){sel.innerHTML='<option value="">Nur für Admins</option>';return;}
  sel.disabled=true;
  sel.innerHTML='<option value="">Spieler werden geladen …</option>';
  try{
    const q=await supabase.from('players').select('id,name,active').eq('active',true).order('name');
    if(q.error)throw q.error;
    const players=q.data||[];
    sel.innerHTML='<option value="">Spieler auswählen …</option>'+players.map(p=>`<option value="${p.id}">${esc(p.name)}</option>`).join('');
    if(!players.length&&status)status.innerHTML='<div class="status err">Keine aktiven Spieler gefunden.</div>';
  }catch(e){
    if(status)status.innerHTML=`<div class="status err">❌ Spielerliste konnte nicht geladen werden: ${esc(e.message)}</div>`;
    sel.innerHTML='<option value="">Spielerliste nicht verfügbar</option>';
  }finally{sel.disabled=false;}
}

async function setPoll(){
  const playerId=Number(document.querySelector('#testPollPlayer')?.value);
  const response=document.querySelector('#testPollResponse')?.value;
  const status=document.querySelector('#testPollStatus');
  if(!playerId){status.textContent='Bitte einen Spieler auswählen.';return;}
  if(!state.matchDay?.id){status.textContent='Kein aktueller Spieltag vorhanden.';return;}
  const {data:{session}}=await supabase.auth.getSession();
  if(!session?.access_token){status.textContent='Nicht angemeldet.';return;}
  const btn=document.querySelector('#testPollSet');btn.disabled=true;btn.textContent='⏳ Wird gesetzt …';
  try{
    const r=await fetch(`${SUPABASE_URL}/functions/v1/admin-test-poll`,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${session.access_token}`},body:JSON.stringify({player_id:playerId,response,match_day_id:state.matchDay.id})});
    const b=await r.json();
    if(!r.ok)throw new Error(b.error||`HTTP ${r.status}`);
    status.innerHTML=`<div class="status ok">✅ ${esc(b.player)} steht jetzt auf <b>${esc(response)}</b>.</div>`;
    document.dispatchEvent(new CustomEvent('poll-updated'));
  }catch(e){status.innerHTML=`<div class="status err">❌ ${esc(e.message)}</div>`;}
  finally{btn.disabled=false;btn.textContent='🧪 Test-Abstimmung setzen';}
}
