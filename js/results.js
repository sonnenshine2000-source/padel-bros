import { supabase } from './supabase.js';
import { state } from './state.js';
import { $, escapeHtml, msg } from './utils.js';

const courts=[['court5','Court 5 · 18:30'],['court1','Court 1 · 19:00']];
function startTime(court){return court==='court5'?'18:30':'19:00';}
function resultOpen(court){
  const date=state.matchDay?.match_date;
  if(!date)return false;
  const [h,m]=startTime(court).split(':').map(Number);
  const start=new Date(`${date}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`);
  return Date.now()>=start.getTime()+90*60*1000;
}
function playerNames(court,assignments){
  return (assignments||[]).filter(a=>a.court===court).sort((a,b)=>(a.position||0)-(b.position||0)).map(a=>a.players?.name).filter(Boolean);
}
function form(court,row={},players=[]){
  const open=resultOpen(court[0]);
  const names=players.length?players.map(escapeHtml).join(' · '):'Spieler werden nach der Spielplanerstellung angezeigt';
  return `<div class="result-card"><div class="result-title"><div><b>${escapeHtml(court[1])}</b><div class="sub">📅 ${escapeHtml(state.matchDay?.match_date||'')} · 👥 ${names}</div></div>${row.id?'<span class="paid">Gespeichert</span>':''}</div>${!open?`<div class="status">⏳ Ergebnis kann ab ${escapeHtml(startTime(court[0]))} Uhr + 90 Minuten eingetragen werden.</div>`:''}<div class="sets">${[1,2,3].map(s=>`<label>Satz ${s}<input class="result-input" data-court="${court[0]}" data-set="${s}" type="number" min="0" max="99" inputmode="numeric" value="${row['set'+s+'_home']??''}" placeholder="0" ${open?'':'disabled'}><span>:</span><input class="result-input" data-court="${court[0]}" data-set="${s}" data-side="away" type="number" min="0" max="99" inputmode="numeric" value="${row['set'+s+'_away']??''}" placeholder="0" ${open?'':'disabled'}></label>`).join('')}</div><button class="primary save-result" data-court="${court[0]}" ${open?'':'disabled'}>${row.id?'💾 Ergebnis ändern':'💾 Ergebnis speichern'}</button></div>`;
}
export async function loadResults(){
  const el=$('resultsList');if(!el)return;
  const q=await supabase.from('match_results').select('*').eq('match_day_id',state.matchDay?.id);
  if(q.error){el.innerHTML=`<div class="status err">${escapeHtml(q.error.message)}</div>`;return;}
  const a=await supabase.from('assignments').select('court,position,players(name)').eq('match_day_id',state.matchDay?.id).order('court').order('position');
  if(a.error){el.innerHTML=`<div class="status err">${escapeHtml(a.error.message)}</div>`;return;}
  el.innerHTML=courts.map(c=>form(c,(q.data||[]).find(r=>r.court===c[0]),playerNames(c[0],a.data||[]))).join('');
  el.querySelectorAll('.save-result').forEach(b=>b.addEventListener('click',()=>saveResult(b.dataset.court)));
}
async function saveResult(court){
  if(!resultOpen(court)){msg($('resultStatus'),'Das Ergebnis kann erst 90 Minuten nach Spielbeginn eingetragen werden.');return;}
  const values={};document.querySelectorAll(`.result-input[data-court="${court}"]`).forEach(i=>{values[`${i.dataset.set}_${i.dataset.side||'home'}`]=i.value===''?null:Number(i.value)});
  const row={match_day_id:state.matchDay.id,court,set1_home:values['1_home'],set1_away:values['1_away'],set2_home:values['2_home'],set2_away:values['2_away'],set3_home:values['3_home'],set3_away:values['3_away'],entered_by:state.currentPlayer.id,updated_by:state.currentPlayer.id,updated_at:new Date().toISOString()};
  const existing=await supabase.from('match_results').select('id').eq('match_day_id',state.matchDay.id).eq('court',court).maybeSingle();
  if(existing.error){msg($('resultStatus'),existing.error.message);return;}
  let q;if(existing.data){if(!state.currentPlayer.is_admin){msg($('resultStatus'),'Dieses Ergebnis wurde bereits gespeichert. Nur der Admin kann es ändern.');return;}q=await supabase.from('match_results').update(row).eq('id',existing.data.id);}else q=await supabase.from('match_results').insert(row);
  if(q.error){msg($('resultStatus'),q.error.message);return;}
  msg($('resultStatus'),existing.data?'Ergebnis geändert.':'Ergebnis gespeichert.',true);await loadResults();
}
