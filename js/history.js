import { supabase } from './supabase.js';
import { $, escapeHtml, msg } from './utils.js';
import { state } from './state.js';
import { formatDate, startTime, openFor, validate, options, winnerTeam } from './history-helpers.js';

const courts=[['court5','Court 5 · 18:30'],['court1','Court 1 · 19:00']];
const style=document.createElement('style');
style.textContent='.history-team-group{margin:6px 0;padding:6px 9px;border-radius:9px}.history-team-1{background:#f8edf0;border-left:4px solid var(--pink2)}.history-team-2{background:#eef1f8;border-left:4px solid #737caa}.history-team-winning{box-shadow:inset 0 0 0 2px var(--green)}.history-winner-player{font-weight:950}.history-result-ok{position:absolute;top:7px;right:8px;color:var(--green);font-size:20px;font-weight:950}.history-court-wrap{position:relative}.history-edit-toggle{margin:8px 0}.history-edit-area{display:none}.history-edit-area.open{display:block}.history-player-side{font-size:10px;color:var(--muted);font-weight:800;margin-left:4px}.history-side-row{display:grid;grid-template-columns:minmax(0,1fr) 105px;gap:7px;align-items:center;margin-top:5px}.history-side-row select{width:100%;padding:8px;border:1px solid var(--line);border-radius:9px;background:#fff;font-weight:800}.history-side-hint{font-size:11px;color:var(--muted);margin:7px 0 10px}.history-score{display:block;font-weight:900;margin:5px 0}.history-day{margin-bottom:18px}.history-date{font-size:18px;font-weight:950;margin:4px 0 10px}.history-court-wrap{border:1px solid var(--line);border-radius:12px;padding:10px;margin:8px 0}.history-player{display:flex;justify-content:space-between;gap:8px;align-items:center;margin:3px 0}.history-badge{font-size:10px;padding:2px 6px;border-radius:8px;background:#eee;font-weight:800}.history-teams{margin-top:6px}.history-score-input{width:70px}.history-edit-area .teams{display:grid;gap:8px}.history-edit-area .team{padding:7px;border:1px solid var(--line);border-radius:9px}.history-edit-area .sets{margin-top:10px}.history-edit-area .sets label{display:grid;grid-template-columns:55px 1fr 20px 1fr;gap:7px;align-items:center;margin:6px 0}.history-edit-area .sets input{padding:8px;border:1px solid var(--line);border-radius:9px;text-align:center;font-weight:900}';
document.head.appendChild(style);

const sideOptions=v=>`<option value="">Seite …</option><option value="links" ${v==='links'?'selected':''}>⬅️ Links</option><option value="rechts" ${v==='rechts'?'selected':''}>➡️ Rechts</option>`;
let currentDay=null;

function playerLabel(p){if(!p)return'';const badge=p.is_guest?'Gast':p.is_stammspieler?'⭐ Stammspieler':'Ersatz';return `<span>${escapeHtml(p.name||'Spieler')}</span><span class="history-badge">${badge}</span>`}
function editor(c,players,r,key){const canEdit=openFor(c,currentDay.match_date);const sel=[r.team1_player1,r.team1_player2,r.team2_player1,r.team2_player2];const sides=[r.team1_player1_side,r.team1_player2_side,r.team2_player1_side,r.team2_player2_side];return `<div class="history-edit-area" id="history-edit-${key}"><div class="sub">${canEdit?'Ergebnis eintragen/ändern':'⏳ Ergebnis ab '+startTime(c[0])+' Uhr + 90 Minuten möglich.'}</div><div class="teams"><div class="team"><b>Team 1</b>${['team1_player1','team1_player2'].map((f,i)=>`<div class="history-side-row"><select class="history-team" data-court="${c[0]}" data-field="${f}" ${canEdit?'':'disabled'}>${options(players,sel[i])}</select><select class="history-side" data-court="${c[0]}" data-field="${f}_side" ${canEdit?'':'disabled'}>${sideOptions(sides[i])}</select></div>`).join('')}</div><div class="team"><b>Team 2</b>${['team2_player1','team2_player2'].map((f,i)=>`<div class="history-side-row"><select class="history-team" data-court="${c[0]}" data-field="${f}" ${canEdit?'':'disabled'}>${options(players,sel[i+2])}</select><select class="history-side" data-court="${c[0]}" data-field="${f}_side" ${canEdit?'':'disabled'}>${sideOptions(sides[i+2])}</select></div>`).join('')}</div></div><div class="history-side-hint">⬅️➡️ Pro Team muss einmal Links und einmal Rechts gewählt werden.</div><div class="sets">${[1,2,3].map(n=>`<label>Satz ${n}<input class="history-score-input" data-court="${c[0]}" data-set="${n}" data-side="home" type="number" min="0" max="7" value="${r['set'+n+'_home']??''}" ${canEdit?'':'disabled'}><span>:</span><input class="history-score-input" data-court="${c[0]}" data-set="${n}" data-side="away" type="number" min="0" max="7" value="${r['set'+n+'_away']??''}" ${canEdit?'':'disabled'}></label>`).join('')}</div><button class="primary history-save" data-court="${c[0]}" ${canEdit?'':'disabled'}>💾 ${r.id?'Ergebnis ändern':'Ergebnis speichern'}</button></div>`}

async function fetchHistoryData(){
  const daysQ=await supabase.from('match_days').select('id,match_date,schedule_generated_at').order('match_date',{ascending:false}).limit(100);
  if(daysQ.error)throw daysQ.error;
  const days=daysQ.data||[];
  if(!days.length)return[];
  const ids=days.map(d=>d.id);
  const [aQ,rQ,pQ]=await Promise.all([
    supabase.from('assignments').select('id,match_day_id,court,position,manually_changed,player_id').in('match_day_id',ids),
    supabase.from('match_results').select('id,match_day_id,court,set1_home,set1_away,set2_home,set2_away,set3_home,set3_away,team1_player1,team1_player2,team2_player1,team2_player2,team1_player1_side,team1_player2_side,team2_player1_side,team2_player2_side').in('match_day_id',ids),
    supabase.from('players').select('id,name,is_stammspieler,is_guest').eq('active',true)
  ]);
  if(aQ.error)throw aQ.error;if(rQ.error)throw rQ.error;if(pQ.error)throw pQ.error;
  const players=new Map((pQ.data||[]).map(p=>[Number(p.id),p]));
  const byA=new Map(),byR=new Map();
  (aQ.data||[]).forEach(a=>{const x={...a,player:players.get(Number(a.player_id))};if(!x.player)return;if(!byA.has(a.match_day_id))byA.set(a.match_day_id,[]);byA.get(a.match_day_id).push(x)});
  (rQ.data||[]).forEach(r=>{if(!byR.has(r.match_day_id))byR.set(r.match_day_id,[]);byR.get(r.match_day_id).push(r)});
  return days.map(d=>({...d,assignments:byA.get(d.id)||[],match_results:byR.get(d.id)||[]})).filter(d=>d.assignments.length);
}

export async function loadHistory(){
  const el=$('historyList');if(!el)return;
  try{
    const days=await fetchHistoryData();
    if(!days.length){el.innerHTML='<div class="sub">Noch kein Spieltag vorhanden.</div>';return;}
    currentDay=days[0];
    const score=r=>r?`<span class="history-score">${r.set1_home??'–'}:${r.set1_away??'–'} · ${r.set2_home??'–'}:${r.set2_away??'–'}${r.set3_home!=null||r.set3_away!=null?` · ${r.set3_home??'–'}:${r.set3_away??'–'}`:''}</span>`:'<span class="history-score muted">Noch kein Ergebnis</span>';
    el.innerHTML=days.map((d,di)=>{
      const by={court5:[],court1:[]};d.assignments.forEach(a=>{if(by[a.court])by[a.court].push(a)});const allPlayers=d.assignments.map(a=>a.player).filter(Boolean).sort((a,b)=>Number(a.id)-Number(b.id));
      return `<div class="history-day"><div class="history-date">${escapeHtml(formatDate(d.match_date))}</div><div class="history-courts">${courts.map((c,ci)=>{const arr=(by[c[0]]||[]).sort((a,b)=>(a.position||0)-(b.position||0));if(!arr.length)return'';const r=(d.match_results||[]).find(x=>x.court===c[0]);const ps=arr.map(a=>a.player).filter(Boolean);let body='';if(r){const win=winnerTeam(r);const ids1=new Set([Number(r.team1_player1),Number(r.team1_player2)]),ids2=new Set([Number(r.team2_player1),Number(r.team2_player2)]);const sideMap=new Map([[Number(r.team1_player1),r.team1_player1_side],[Number(r.team1_player2),r.team1_player2_side],[Number(r.team2_player1),r.team2_player1_side],[Number(r.team2_player2),r.team2_player2_side]]);const group=(ids,team)=>ps.filter(p=>ids.has(Number(p.id))).map(p=>`<div class="history-player ${win===team?'history-winner-player':''}"><span>${win===team?'🏆 ':''}${escapeHtml(p.name||'Spieler')}${sideMap.get(Number(p.id))?` <span class="history-player-side">· ${sideMap.get(Number(p.id))}</span>`:''}</span><span class="history-badge">${p.is_guest?'Gast':p.is_stammspieler?'⭐ Stammspieler':'Ersatz'}</span></div>`).join('');body=`<div class="history-team-group history-team-1 ${win===1?'history-team-winning':''}">${group(ids1,1)}</div><div class="history-team-group history-team-2 ${win===2?'history-team-winning':''}">${group(ids2,2)}</div>`}else{body=ps.map(p=>`<div class="history-player">${playerLabel(p)}</div>`).join('')}
        return `<div class="history-court-wrap"><b>${c[1]}</b>${r?'<span class="history-result-ok" title="Ergebnis eingetragen">✓</span>':''}${score(r)}<div class="history-teams">${body}</div>${state.currentPlayer?.is_admin?`<button type="button" class="secondary history-edit-toggle" data-target="history-edit-${di}-${ci}">✏️ Ergebnis ändern</button>${editor(c,ps,r||{},di+'-'+ci)}`:''}</div>`}).join('')}</div></div>`
    }).join('');
    el.querySelectorAll('.history-edit-toggle').forEach(b=>b.addEventListener('click',()=>{const t=document.getElementById(b.dataset.target);if(!t)return;const o=t.classList.toggle('open');b.textContent=o?'✖ Bearbeiten schließen':'✏️ Ergebnis ändern'}));
    el.querySelectorAll('.history-save').forEach(b=>b.addEventListener('click',()=>saveHistoryResult(b.dataset.court)));
  }catch(e){console.error('Historie konnte nicht geladen werden:',e);el.innerHTML=`<div class="status err">Historie konnte nicht geladen werden: ${escapeHtml(e?.message||String(e))}</div>`}
}

async function saveHistoryResult(court){
  if(!state.currentPlayer?.is_admin){msg($('historyList'),'Nur der Admin kann Ergebnisse eintragen oder ändern.');return}
  if(!currentDay)return;
  const inputs=[...document.querySelectorAll(`.history-score-input[data-court="${court}"]`)],sets=[1,2,3].map(n=>({a:Number(inputs.find(x=>x.dataset.set==n&&x.dataset.side==='home')?.value)||null,b:Number(inputs.find(x=>x.dataset.set==n&&x.dataset.side==='away')?.value)||null}));
  const err=validate(sets);if(err){msg($('historyList'),err);return}
  const team={};document.querySelectorAll(`.history-team[data-court="${court}"]`).forEach(s=>team[s.dataset.field]=s.value?Number(s.value):null);const sides={};document.querySelectorAll(`.history-side[data-court="${court}"]`).forEach(s=>sides[s.dataset.field]=s.value||null);const ids=Object.values(team).filter(Boolean);
  if(ids.length!==4||new Set(ids).size!==4){msg($('historyList'),'Bitte alle 4 unterschiedlichen Spieler auswählen.');return}
  const sv=[sides.team1_player1_side,sides.team1_player2_side,sides.team2_player1_side,sides.team2_player2_side];if(sv.some(v=>!v)){msg($('historyList'),'Bitte für alle 4 Spieler Links oder Rechts auswählen.');return}if(new Set([sides.team1_player1_side,sides.team1_player2_side]).size!==2||new Set([sides.team2_player1_side,sides.team2_player2_side]).size!==2){msg($('historyList'),'Pro Team muss genau ein Spieler Links und einer Rechts spielen.');return}
  const assigned=await supabase.from('assignments').select('player_id').eq('match_day_id',currentDay.id).eq('court',court);if(assigned.error){msg($('historyList'),assigned.error.message);return}const allowed=new Set((assigned.data||[]).map(x=>Number(x.player_id)));if(ids.some(id=>!allowed.has(id))){msg($('historyList'),'Nur die 4 Spieler dieses Courts dürfen ausgewählt werden.');return}
  const row={match_day_id:currentDay.id,court,set1_home:sets[0].a,set1_away:sets[0].b,set2_home:sets[1].a,set2_away:sets[1].b,set3_home:sets[2].a,set3_away:sets[2].b,team1_player1:team.team1_player1,team1_player2:team.team1_player2,team2_player1:team.team2_player1,team2_player2:team.team2_player2,team1_player1_side:sides.team1_player1_side,team1_player2_side:sides.team1_player2_side,team2_player1_side:sides.team2_player1_side,team2_player2_side:sides.team2_player2_side,entered_by:state.currentPlayer.id,updated_by:state.currentPlayer.id,updated_at:new Date().toISOString()};
  const old=await supabase.from('match_results').select('id').eq('match_day_id',currentDay.id).eq('court',court).maybeSingle();let r;if(old.error){msg($('historyList'),old.error.message);return}if(old.data)r=await supabase.from('match_results').update(row).eq('id',old.data.id);else r=await supabase.from('match_results').insert(row);if(r.error){msg($('historyList'),'Ergebnis konnte nicht gespeichert werden: '+r.error.message);return}await loadHistory();window.dispatchEvent(new CustomEvent('results-updated'));
}
