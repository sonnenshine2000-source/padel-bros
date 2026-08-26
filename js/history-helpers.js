import { escapeHtml } from './utils.js';

export function formatDate(d){
  if(!d)return'Datum unbekannt';
  const parts=String(d).split('-');
  return parts.length===3?`${parts[2]}.${parts[1]}.${parts[0]}`:String(d);
}

export function startTime(c){return c==='court5'?'18:30':'19:00'}

export function openFor(c,d){
  const [h,m]=startTime(c).split(':').map(Number);
  return Date.now()>=new Date(`${d}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`).getTime()+90*60*1000;
}

export function validSet(a,b){
  if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<0||a>7||b>7||a===b)return false;
  const hi=Math.max(a,b),lo=Math.min(a,b);
  return(hi===6&&lo<=4)||(hi===7&&(lo===5||lo===6));
}

export function validate(sets){
  const played=sets.filter(s=>s.a!=null&&s.b!=null);
  if(played.length<2)return'Bitte mindestens zwei Sätze eintragen.';
  let a=0,b=0;
  for(const s of played){
    if(!validSet(s.a,s.b))return`Ungültiger Satzstand ${s.a}:${s.b}.`;
    s.a>s.b?a++:b++;
  }
  if((a===2&&b===0)||(b===2&&a===0))return played.length>2?'Bei 2:0 wird kein dritter Satz benötigt.':null;
  if(a===1&&b===1)return played.length===3?null:'Bei 1:1 muss ein dritter Satz eingetragen werden.';
  return'Es muss einen eindeutigen Sieger geben.';
}

export function options(players,sel){
  return'<option value="">Spieler wählen …</option>'+players.map(p=>`<option value="${p.id}" ${Number(sel)===Number(p.id)?'selected':''}>${escapeHtml(p.name||'Spieler')}</option>`).join('');
}

export function winnerTeam(r){
  if(!r)return 0;
  let h=0,a=0;
  for(const n of[1,2,3]){
    const x=r[`set${n}_home`],y=r[`set${n}_away`];
    if(x==null||y==null)continue;
    if(x>y)h++;else if(y>x)a++;
  }
  return h>=2&&h>a?1:a>=2&&a>h?2:0;
}
