import { supabase } from './supabase.js';
import { state } from './state.js';

let loadedFor=null;
async function addGuestOptions(){
  const host=document.getElementById('historyList');
  if(!host||!state.matchDay)return;
  const dayId=Number(state.matchDay.id);
  if(!dayId||loadedFor===dayId)return;
  const q=await supabase.from('players').select('id,name').eq('is_guest',true).eq('guest_match_day_id',dayId).order('name');
  if(q.error){console.warn('Gastspieler für Historie konnten nicht geladen werden:',q.error);return;}
  const guests=q.data||[];
  if(!guests.length){loadedFor=dayId;return;}
  const selects=[...host.querySelectorAll('.history-team')];
  selects.forEach(sel=>{
    guests.forEach(g=>{
      const value=String(g.id);
      if(!sel.querySelector(`option[value="${value}"]`)){
        const opt=document.createElement('option');
        opt.value=value;
        opt.textContent=`${g.name} · Gast`;
        sel.appendChild(opt);
      }
    });
  });
  loadedFor=dayId;
}

const observer=new MutationObserver(()=>addGuestOptions().catch(console.error));
function start(){
  const host=document.getElementById('historyList');
  if(host)observer.observe(host,{childList:true,subtree:true});
  addGuestOptions().catch(console.error);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
export function refreshHistoryGuestOptions(){loadedFor=null;return addGuestOptions();}
