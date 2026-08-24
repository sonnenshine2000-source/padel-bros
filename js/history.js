import { supabase } from './supabase.js';
import { $, escapeHtml } from './utils.js';

export async function loadHistory(){
 const el=$('historyList'); if(!el)return;
 const q=await supabase.from('match_days').select('id,match_date,assignments(court,position,manually_changed,players:player_id(name,is_stammspieler))').order('match_date',{ascending:false}).limit(100);
 if(q.error){el.innerHTML=`<div class="status err">${escapeHtml(q.error.message)}</div>`;return;}
 const days=(q.data||[]).filter(d=>(d.assignments||[]).length);
 if(!days.length){el.innerHTML='<div class="sub">Noch keine gespielten Spieltage in der Historie.</div>';return;}
 el.innerHTML=days.map(d=>{const byCourt={court5:[],court1:[]};(d.assignments||[]).forEach(a=>{if(byCourt[a.court])byCourt[a.court].push(a)});const fmt=(arr)=>arr.sort((a,b)=>a.position-b.position).map(a=>`<div class="history-player"><span>${escapeHtml(a.players?.name||'Spieler')}</span>${a.players?.is_stammspieler?'<span class="badge">⭐ Stammspieler</span>':'<span class="badge">Ersatz</span>'}${a.manually_changed?'<span class="badge">✋ geändert</span>':''}</div>`).join('');return `<div class="history-day"><div class="history-date">${escapeHtml(d.match_date||'Datum unbekannt')}</div><div class="history-courts"><div><b>Court 5 · 18:30</b>${fmt(byCourt.court5)}</div><div><b>Court 1 · 19:00</b>${fmt(byCourt.court1)}</div></div></div>`}).join('');
}
