export const $ = id => document.getElementById(id);

export const escapeHtml = s => String(s ?? '').replace(/[&<>\"']/g,c => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
export function msg(el,text,ok=false){el.className='status '+(ok?'ok':'err');el.textContent=text;}
export function label(v){return {'18:30':'18:30 Uhr · Court 5','19:00':'19:00 Uhr · Court 1','egal':'Egal wann','nein':'Kann nicht'}[v]||v;}
export function nextTuesday(){const now=new Date(),day=now.getDay(),add=(2-day+7)%7,d=new Date(now.getFullYear(),now.getMonth(),now.getDate()+add),y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),dayOfMonth=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${dayOfMonth}`;}
export function niceDate(s){const [y,m,d]=s.split('-').map(Number);return new Intl.DateTimeFormat('de-DE',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}).format(new Date(y,m-1,d));}
// Die Datenbank ist die Quelle der Wahrheit. Die serverseitige RLS-Regel verhindert zusätzlich Abstimmungen nach Dienstag 17:00 Uhr.
export function isPollClosed(matchDay){if(!matchDay)return true;return matchDay.poll_open===false||matchDay.poll_closed===true;}
