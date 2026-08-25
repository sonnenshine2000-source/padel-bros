import { supabase } from './supabase.js';
import { $, escapeHtml } from './utils.js';

function ensureStatsLayout(){
 if(document.getElementById('stats-layout-fix'))return;
 const style=document.createElement('style');
 style.id='stats-layout-fix';
 style.textContent=`.stat-row.all-player-row{grid-template-columns:minmax(120px,1fr) auto auto auto auto;min-width:0}.stat-row.all-player-row>b{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.stat-row.all-player-row .stat-matches,.stat-row.all-player-row .stat-record,.stat-row.all-player-row .stat-pct,.stat-row.all-player-row .stat-sets{white-space:nowrap}@media(max-width:760px){.stat-row.all-player-row{grid-template-columns:minmax(0,1fr) auto auto;align-items:center}.stat-row.all-player-row .stat-pct{grid-column:3}.stat-row.all-player-row .stat-sets{grid-column:1 / -1;font-size:10px;color:var(--muted);padding-top:2px}.stat-row.all-player-row .stat-record{display:block}.stat-row.all-player-row .stat-matches{display:block}}`;
 document.head.appendChild(style);
}

export async function loadStats(){
 ensureStatsLayout();
 const el=$('statsContent'); if(!el)return;
 const q=await supabase.from('match_days').select('match_date,assignments(court,position,player_id,players:player_id(id,name)),match_results(court,set1_home,set1_away,set2_home,set2_away,set3_home,set3_away)').order('match_date',{ascending:true});
 if(q.error){el.innerHTML=`<div class="status err">${escapeHtml(q.error.message)}</div>`;return;}
 const players=new Map(), pairs=new Map();
 const addPlayer=(id,name)=>{if(!id)return; if(!players.has(id))players.set(id,{id,name:name||'Spieler',matches:0,wins:0,losses:0,setsW:0,setsL:0,pointsW:0,pointsL:0,streak:0,bestStreak:0,replace:0,court5:0,court1:0});return players.get(id)};
 for(const d of q.data||[]){
  const as=d.assignments||[], by={court5:[],court1:[]}; as.forEach(a=>{if(by[a.court])by[a.court].push(a)});
  for(const r of d.match_results||[]){
   const teamA=by[r.court].filter((_,i)=>i<2), teamB=by[r.court].filter((_,i)=>i>=2); if(teamA.length<2||teamB.length<2)continue;
   const sets=[[r.set1_home,r.set1_away],[r.set2_home,r.set2_away],[r.set3_home,r.set3_away]].filter(x=>x[0]!=null&&x[1]!=null);
   if(!sets.length)continue; let aSets=0,bSets=0,aPts=0,bPts=0;sets.forEach(([a,b])=>{aPts+=a;bPts+=b;if(a>b)aSets++;else if(b>a)bSets++});
   const aWin=aSets>bSets;
   const update=(arr,win)=>arr.forEach(x=>{const p=addPlayer(x.player_id,x.players?.name);p.matches++;if(win){p.wins++;p.streak++;p.bestStreak=Math.max(p.bestStreak,p.streak)}else{p.losses++;p.streak=0}p.setsW+=win?aSets:bSets;p.setsL+=win?bSets:aSets;p.pointsW+=win?aPts:bPts;p.pointsL+=win?bPts:aPts;if(r.court==='court5')p.court5++;else p.court1++});
   update(teamA,aWin);update(teamB,!aWin);
   const all=[...teamA,...teamB].map(x=>x.player_id).sort((a,b)=>a-b); if(all.length===4){const key=all.join('-');if(!pairs.has(key))pairs.set(key,{names:[...teamA,...teamB].map(x=>x.players?.name||'Spieler').sort(),matches:0,wins:0});pairs.get(key).matches++;if(aWin===((all.indexOf(teamA[0].player_id)<2)))pairs.get(key).wins++;}
  }
 }
 const rows=[...players.values()].sort((a,b)=>(b.wins/(b.matches||1))-(a.wins/(a.matches||1))||b.matches-a.matches);
 const qualified=rows.filter(p=>p.matches>=5);
 const pct=p=>p.matches?Math.round(p.wins/p.matches*100):0;
 const ranking=qualified.map((p,i)=>`<div class="stat-row"><span class="rank">${i+1}.</span><b>${escapeHtml(p.name)}</b><span>${p.matches} Spiele</span><strong>${p.wins} Siege</strong><span>${pct(p)}%</span></div>`).join('');
 const table=rows.map(p=>`<div class="stat-row all-player-row"><b>${escapeHtml(p.name)}</b><span class="stat-matches">${p.matches} Spiele</span><span class="stat-record">${p.wins}–${p.losses}</span><strong class="stat-pct">${pct(p)}%</strong><span class="stat-sets">${p.setsW}:${p.setsL} Sätze</span></div>`).join('');
 const bestPairs=[...pairs.values()].filter(x=>x.matches>=2).map(x=>({...x,pct:Math.round(x.wins/x.matches*100)})).sort((a,b)=>b.pct-a.pct||b.matches-a.matches).slice(0,8);
 const pairHtml=bestPairs.length?bestPairs.map(x=>`<div class="stat-row"><b>${escapeHtml(x.names.join(' + '))}</b><span>${x.matches} Matches</span><strong>${x.wins} Siege · ${x.pct}%</strong></div>`).join(''):'<div class="sub">Noch nicht genug gemeinsame Matches.</div>';
 const most=rows.reduce((a,b)=>b.matches>a.matches?b:a,rows[0]);const best=qualified[0];const streak=rows.reduce((a,b)=>b.bestStreak>a.bestStreak?b:a,rows[0]);
 el.innerHTML=`<div class="stat-hero"><div><small>AKTUELLE STATISTIK</small><h2>Wer ist in Form? 🔥</h2></div>${best?`<div class="stat-highlight">🏆 <b>${escapeHtml(best.name)}</b><span>${pct(best)}% Siegesquote</span></div>`:''}</div><div class="stats-grid"><section class="stat-box"><h3>🏆 Rangliste</h3><div class="sub">Offizielle Rangliste ab 5 Matches.</div>${ranking||'<div class="sub">Noch keine Spieler mit 5 Matches.</div>'}</section><section class="stat-box"><h3>📊 Alle Spieler</h3>${table||'<div class="sub">Noch keine Daten.</div>'}</section><section class="stat-box"><h3>🤝 Beste Paarungen</h3>${pairHtml}</section><section class="stat-box"><h3>🔥 Rekorde</h3><div class="record"><b>🎯 Meiste Matches</b><span>${most?escapeHtml(most.name):'—'} · ${most?.matches||0}</span></div><div class="record"><b>🏆 Meiste Siege</b><span>${best?escapeHtml(rows.sort((a,b)=>b.wins-a.wins)[0]?.name):'—'} · ${rows[0]?.wins||0}</span></div><div class="record"><b>🔥 Längste Siegesserie</b><span>${streak?escapeHtml(streak.name):'—'} · ${streak?.bestStreak||0}</span></div></section></div>`;
}
