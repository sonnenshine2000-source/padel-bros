import { supabase } from './supabase.js';
import { state } from './state.js';
import { $, msg, escapeHtml, niceDate } from './utils.js';

let days=[];

async function loadDays(){
  const sel=$('replaceMatchDay'); if(!sel)return;
  const q=await supabase.from('match_days').select('id,match_date,schedule_generated_at,poll_closed').order('match_date',{ascending:false}).limit(30);
  if(q.error){msg($('replaceStatus'),'Spieltage konnten nicht geladen werden: '+q.error.message);return}
  days=q.data||[];
  const current=state.matchDay?.id;
  sel.innerHTML='<option value="">Spieltag auswählen …</option>'+days.map(d=>`<option value="${d.id}">${escapeHtml(niceDate(d.match_date))}${d.schedule_generated_at?' · Spielplan':''}</option>`).join('');
  if(current&&days.some(d=>Number(d.id)===Number(current))){sel.value=String(current);await loadPlayersForDay()}
}

async function loadPlayersForDay(){
  const dayId=Number($('replaceMatchDay')?.value),oldSel=$('replacePlayer'),newSel=$('replaceWithPlayer');
  if(!oldSel||!newSel)return;
  oldSel.innerHTML='<option value="">Spieler auswählen …</option>'; newSel.innerHTML='<option value="">Spieler auswählen …</option>';
  if(!dayId)return;
  const a=await supabase.from('assignments').select('id,player_id,court,position,players(name,is_guest,is_stammspieler)').eq('match_day_id',dayId).order('court').order('position');
  if(a.error){msg($('replaceStatus'),'Spielplan konnte nicht geladen werden: '+a.error.message);return}
  const assigned=a.data||[];
  oldSel.innerHTML='<option value="">Spieler auswählen …</option>'+assigned.filter(x=>x.player_id).map(x=>`<option value="${x.player_id}">${escapeHtml(x.players?.name||'Spieler')} · ${x.court==='court5'?'Court 5':'Court 1'} · Platz ${x.position}</option>`).join('');
  const p=await supabase.from('players').select('id,name,is_guest,is_stammspieler').eq('active',true).order('name');
  if(p.error){msg($('replaceStatus'),'Spieler konnten nicht geladen werden: '+p.error.message);return}
  newSel.innerHTML='<option value="">Spieler auswählen …</option>'+(p.data||[]).map(x=>`<option value="${x.id}">${escapeHtml(x.name)}${x.is_guest?' · Gast':x.is_stammspieler?' · Stamm':' · Ersatz'}</option>`).join('');
  msg($('replaceStatus'),'Spieltag geladen. Jetzt Spieler auswählen.');
}

async function replacePlayer(){
  if(!state.currentPlayer?.is_admin){msg($('replaceStatus'),'Nur ein Admin kann Spieler austauschen.');return}
  const dayId=Number($('replaceMatchDay')?.value),oldId=Number($('replacePlayer')?.value),newId=Number($('replaceWithPlayer')?.value);
  if(!dayId||!oldId||!newId){msg($('replaceStatus'),'Bitte Spieltag, ausgewechselten und tatsächlichen Spieler auswählen.');return}
  if(oldId===newId){msg($('replaceStatus'),'Bitte zwei unterschiedliche Spieler auswählen.');return}
  const a=await supabase.from('assignments').select('id,player_id,court,position,players(name)').eq('match_day_id',dayId).order('court').order('position');
  if(a.error){msg($('replaceStatus'),a.error.message);return}
  const rows=a.data||[],source=rows.find(x=>Number(x.player_id)===oldId),target=rows.find(x=>Number(x.player_id)===newId);
  if(!source){msg($('replaceStatus'),'Der ausgewechselte Spieler ist an diesem Spieltag nicht zugeordnet.');return}
  if(!confirm(`${source.players?.name||'Spieler'} wird durch den tatsächlich spielenden Spieler ersetzt.\n\n${target?'Der tatsächliche Spieler ist bereits eingeplant – die beiden Spieler werden getauscht.':'Der tatsächliche Spieler wird an diesen Platz gesetzt.'}`))return;
  if(target){
    const u1=await supabase.from('assignments').update({player_id:newId,manually_changed:true}).eq('id',source.id);
    if(u1.error){msg($('replaceStatus'),'Austausch fehlgeschlagen: '+u1.error.message);return}
    const u2=await supabase.from('assignments').update({player_id:oldId,manually_changed:true}).eq('id',target.id);
    if(u2.error){msg($('replaceStatus'),'Tausch konnte nicht vollständig gespeichert werden: '+u2.error.message);return}
  }else{
    const u=await supabase.from('assignments').update({player_id:newId,manually_changed:true}).eq('id',source.id);
    if(u.error){msg($('replaceStatus'),'Austausch fehlgeschlagen: '+u.error.message);return}
  }
  const result=await supabase.from('match_results').select('id,court,team1_player1,team1_player2,team2_player1,team2_player2').eq('match_day_id',dayId).eq('court',source.court).maybeSingle();
  if(!result.error&&result.data){const r=result.data,patch={};for(const key of ['team1_player1','team1_player2','team2_player1','team2_player2'])if(Number(r[key])===oldId)patch[key]=newId;if(Object.keys(patch).length)await supabase.from('match_results').update(patch).eq('id',r.id)}
  msg($('replaceStatus'),'Spieler wurde erfolgreich ausgetauscht.',true); await loadPlayersForDay();
}

export async function loadReplacementControls(){if(state.currentPlayer?.is_admin)await loadDays()}
export function bindScheduleReplacements(){
  $('replaceMatchDay')?.addEventListener('change',loadPlayersForDay);
  $('replacePlayerButton')?.addEventListener('click',replacePlayer);
  if(state.currentPlayer?.is_admin)loadDays().catch(e=>console.error('Ersatzspieler-Verwaltung:',e));
}