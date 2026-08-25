import { supabase } from './supabase.js';
import { $, escapeHtml } from './utils.js';

function ensureStatsLayout(){
 if(document.getElementById('stats-layout-fix'))return;
 const style=document.createElement('style');
 style.id='stats-layout-fix';
 style.textContent=`.stat-row.all-player-row{grid-template-columns:minmax(120px,1fr) auto auto auto auto;min-width:0}.stat-row.all-player-row>b{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.stat-row.all-player-row .stat-matches,.stat-row.all-player-row .stat-record,.stat-row.all-player-row .stat-pct,.stat-row.all-player-row .stat-sets{white-space:nowrap}@media(max-width:760px){.stat-row.all-player-row{grid-template-columns:minmax(0,1fr) auto auto;align-items:center}.stat-row.all-player-row .stat-pct{grid-column:3}.stat-row.all-player-row .stat-sets{grid-column:1 / -1;font-size:10px;color:var(--muted);padding-top:2px}.stat-row.all-player-row .stat-record{display:block}.stat-row.all-player-row .stat-matches{display:block}}`;
 document.head.appendChild(style);
}
function validSet(a,b){if(!Number.isFinite(a)||!Number.isFinite(b)||a<0||b<0||a>7||b>7||a===b)return false;const hi=Math.max(a,b),lo=Math.min(a,b);return(hi===6&&lo<=4)||(hi===7&&(lo===5||lo===6));}
function resultSets(r){return[[r.set1_home,r.set1_away],[r.set2_home,r.set2_away],[r.set3_home,r.set3_away]].filter(([a,b])=>a!=null&&b!=null&&!(Number(a)===0&&Number(b)===0)).map(([a,b])=>[Number(a),Number(b)]).filter(([a,b])=>validSet(a,b));}
export async function loadStats(){
 ensureStatsLayout();const el=$('statsContent');if(!el)return;
 const q=await supabase.from('match_days').select('match_date,assignments(court,position,player_id,players:player_id(id,name)),match_results(court,set1_home,set1_away,set2_home,set2_away,set3_home,set3_away,team1_player1,team1_player2,team2_player1,team2_player2)').order('match_date',{ascending:true});
 if(q.error){el.innerHTML=`<div class="status err">${escapeHtml(q.error.message)}</div>`;return;}
 const players=new Map(),pairs=new Map();
 const addPlayer=(id,name)=>{if(!id)return null;if(!players.has(id))players.set(id,{id,name:name||'Spieler',matches:0,wins:0,losses:0,setsW:0,setsL:0,pointsW:0,pointsL:0,streak:0,bestStreak:0,court5:0,court1:0});return players.get(id)};
 const addPair=(ids,names,win)=>{if(ids.length!==2||ids.some(x=>!x))return;const key=ids.map(Number).sort((a,b)=>a-b).join('-');if(!pairs.has(key))pairs.set(key,{ids:[...ids].sort((a,b)=>a-b),names:[...names],matches:0,wins:0});const p=pairs.get(key);p.matches++;if(win)p.wins++;};
 for(const d of q.data||[]){
  const by={court5:[],court1:[]};for(const a of d.assignments||[])if(by[a.court])by[a.court].push(a);
  for(const r of d.match_results||[]){
   const sets=resultSets(r);if(sets.length<2)continue;let aSets=0,bSets=0,aPts=0,bPts=0;for(const[a,b]of sets){aPts+=a;bPts+=b;if(a>b)aSets++;else bSets++;}if(aSets===bSets||Math.max(aSets,bSets)!==2)continue;
   const fallback=(by[r.court]||[]).sort((a,b)=>(a.position||0)-(b.position||0));const teamAIds=[r.team1_player1,r.team1_player2].map(Number).filter(Boolean);const teamBIds=[r.team2_player1,r.team2_player2].map(Number).filter(Boolean);const teamA=teamAIds.length===2?teamAIds:fallback.slice(0,2).map(x=>Number(x.player_id));const teamB=teamBIds.length===2?teamBIds:fallback.slice(2,4).map(x=>Number(x.player_id));if(teamA.length!==2||teamB.length!==2||new Set([...teamA,...teamB]).size!==4)continue;
   const namesById=new Map((d.assignments||[]).map(a=>[Number(a.player_id),a.players?.name||'Spieler']));const aWin=aSets>bSets;
   const update=(ids,win)=>ids.forEach(id=>{const p=addPlayer(id,namesById.get(id));p.matches++;p.court5+=r.court==='court5'?1:0;p.court1+=r.court==='court1'?1:0;if(win){p.wins++;p.streak++;p.bestStreak=Math.max(p.bestStreak,p.streak);p.setsW+=aWin?aSets:bSets;p.setsL+=aWin?bSets:aSets;p.pointsW+=aWin?aPts:bPts;p.pointsL+=aWin?bPts:aPts;}else{p.losses++;p.streak=0;p.setsW+=aWin?bSets:aSets;p.setsL+=aWin?aSets:bSets;p.pointsW+=aWin?bPts:aPts;p.pointsL+=aWin?aPts:bPts;}});
   update(teamA,aWin);update(teamB,!aWin);addPair(teamA,teamA.map(id=>namesById.get(id)||'Spieler'),aWin);addPair(teamB,teamB.map(id=>namesById.get(id)||'Spieler'),!aWin);
  }
 }
 const rows=[...players.values()].sort((a,b)=>(b.wins/(b.matches||1))-(a.wins/(a.matches||1))||b.wins-a.wins||b.matches-a.matches||a.name.localeCompare(b.name));const qualified=rows.filter(p=>p.matches>=5);const pct=p=>p.matches?Math.round(p.wins/p.matches*100):0;
 const ranking=qualified.map((p,i)=>`<div class="stat-row"><span class="rank">${i+1}.</span><b>${escapeHtml(p.name)}</b><span>${p.matches} Spiele</span><strong>${p.wins} Siege</strong><span>${pct(p)}%</span></div>`).join('');
 const table=rows.map(p=>`<div class="stat-row all-player-row"><b>${escapeHtml(p.name)}</b><span class="stat-matches">${p.matches} Spiele</span><span class="stat-record">${p.wins}–${p.losses}</span><strong class="stat-pct">${pct(p)}%</strong><span class="stat-sets">${p.setsW}:${p.setsL} Sätze</span></div>`).join('');
 const bestPairs=[...pairs.values()].filter(x=>x.matches>=2).map(x=>({...x,pct:Math.round(x.wins/x.matches*100)})).sort((a,b)=>b.pct-a.pct||b.wins-a.wins||b.matches-a.matches).slice(0,8);const pairHtml=bestPairs.length?bestPairs.map(x=>`<div class="stat-row"><b>${escapeHtml(x.names.join(' + '))}</b><span>${x.matches} Matches</span><strong>${x.wins} Siege · ${x.pct}%</strong></div>`).join(''):'<div class="sub">Noch nicht genug gemeinsame Matches.</div>';
 const maxMatches=Math.max(0,...rows.map(p=>p.matches)),maxWins=Math.max(0,...rows.map(p=>p.wins)),maxStreak=Math.max(0,...rows.map(p=>p.bestStreak));
 const mostPlayers=rows.filter(p=>p.matches===maxMatches&&maxMatches>0);const mostWinPlayers=rows.filter(p=>p.wins===maxWins&&maxWins>0);const streakPlayers=rows.filter(p=>p.bestStreak===maxStreak&&maxStreak>0);
 const names=list=>list.map(p=>escapeHtml(p.name)).join(' · ');
 const best=qualified.length?[...qualified].sort((a,b)=>b.wins-a.wins||b.wins/(b.matches||1)-a.wins/(a.matches||1))[0]:null;
 el.innerHTML=`<div class="stat-hero"><div><small>AKTUELLE STATISTIK</small><h2>Wer ist in Form? 🔥</h2></div>${best?`<div class="stat-highlight">🏆 <b>${escapeHtml(best.name)}</b><span>${pct(best)}% Siegesquote</span></div>`:''}</div><div class="stats-grid"><section class="stat-box"><h3>🏆 Rangliste</h3><div class="sub">Offizielle Rangliste ab 5 Matches.</div>${ranking||'<div class="sub">Noch keine Spieler mit 5 Matches.</div>'}</section><section class="stat-box"><h3>📊 Alle Spieler</h3>${table||'<div class="sub">Noch keine Daten.</div>'}</section><section class="stat-box"><h3>🤝 Beste Paarungen</h3>${pairHtml}</section><section class="stat-box"><h3>🔥 Rekorde</h3><div class="record"><b>🎯 Meiste Matches</b><span>${maxMatches?`${names(mostPlayers)} · ${maxMatches}`:'—'}</span></div><div class="record"><b>🏆 Meiste Siege</b><span>${maxWins?`${names(mostWinPlayers)} · ${maxWins}`:'—'}</span></div><div class="record"><b>🔥 Längste Siegesserie</b><span>${maxStreak?`${names(streakPlayers)} · ${maxStreak}`:'—'}</span></div></section></div>`;
}
