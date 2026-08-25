import { supabase } from './supabase.js';
import { $, escapeHtml } from './utils.js';

export async function loadHistory(){
 const el=$('historyList');if(!el)return;
 const q=await supabase.from('match_days').select('id,match_date,schedule_generated_at,assignments(court,position,manually_changed,players:player_id(name,is_stammspieler)),match_results(court,set1_home,set1_away,set2_home,set2_away,set3_home,set3_away)').order('match_date',{ascending:false}).limit(100);
 if(q.error){el.innerHTML=`<div class="status err">${escapeHtml(q.error.message)}</div>`;return;}
 // A match belongs in the history only after a result has actually been entered.
 const days=(q.data||[]).filter(d=>(d.match_results||[]).length>0);
 if(!days.length){el.innerHTML='<div class="sub">Noch keine gespielten Spiele in der Historie.</div>';return;}
 const score=r=>r?`<span class="history-score">${r.set1_home??'–'}:${r.set1_away??'–'} · ${r.set2_home??'–'}:${r.set2_away??'–'}${r.set3_home!=null||r.set3_away!=null?` · ${r.set3_home??'–'}:${r.set3_away??'–'}`:''}</span>`:'<span class="history-score muted">Kein Ergebnis eingetragen</span>';
 el.innerHTML=days.map(d=>{const by={court5:[],court1:[]};(d.assignments||[]).forEach(a=>{if(by[a.court])by[a.court].push(a)});const fmt=(arr)=>arr.sort((a,b)=>a.position-b.position).map(a=>`<div class="history-player"><span>${escapeHtml(a.players?.name||'Spieler')}</span>${a.players?.is_stammspieler?'<span class="badge">⭐ Stammspieler</span>':'<span class="badge">Ersatz</span>'}${a.manually_changed?'<span class="badge">✋ geändert</span>':''}</div>`).join('');const result=c=>(d.match_results||[]).find(r=>r.court===c);return `<div class="history-day"><div class="history-date">${escapeHtml(d.match_date||'Datum unbekannt')}</div><div class="history-courts"><div><b>Court 5 · 18:30</b>${score(result('court5'))}${fmt(by.court5)}</div><div><b>Court 1 · 19:00</b>${score(result('court1'))}${fmt(by.court1)}</div></div></div>`}).join('');
}
