import { supabase } from './supabase.js';
import { state } from './state.js';
import { $, msg, niceDate, nextTuesday } from './utils.js';
import { loadSession, loadLoginPlayers, bindAuth } from './auth.js';
import { loadPoll, bindPoll } from './poll.js';
import { loadAssignments, bindSchedule } from './schedule.js';
import { loadMatches } from './matches.js';
import { loadPayments } from './payments.js';
import { loadPlayerAdmin, bindAdmin } from './admin.js';
import { bindPush, loadPushStatus } from './notifications.js';
import { loadCancelledCourts, bindCancellations } from './cancellations.js';
import { loadHistory } from './history.js';
import { loadResults } from './results.js';
import { loadStats } from './stats.js';

async function refreshCurrentPlayer(){
  const existing=state.currentPlayer;
  const {data:{session}}=await supabase.auth.getSession();
  if(!session?.user?.id)return existing||null;
  const q=await supabase.from('players').select('id,name,active,is_admin,is_stammspieler,paypal_email,auth_user_id,login_email,password_initialized').eq('auth_user_id',session.user.id).maybeSingle();
  if(q.error){
    console.warn('Aktueller Spieler konnte nicht erneut geladen werden; vorhandene Session-Daten werden verwendet.',q.error);
    if(existing?.is_admin===true && $('who'))$('who').textContent=existing.name+' 👑';
    return existing||null;
  }
  if(!q.data||q.data.active===false)return null;
  state.currentPlayer=q.data;
  if($('who'))$('who').textContent=q.data.name+(q.data.is_admin?' 👑':'');
  return q.data;
}

export async function loadAll(){
  if(!state.currentPlayer)return;
  const player=await refreshCurrentPlayer();
  if(!player)return;
  updateAdminVisibility();
  const date=nextTuesday();
  const {data,error}=await supabase.from('match_days').select('id,match_date,poll_open,poll_closed,court_5_cancelled,court_1_cancelled').eq('match_date',date).maybeSingle();
  if(error){console.error(error);msg($('pollStatus'),error.message);return;}
  if(!data){$('heroDate').textContent=niceDate(date);$('pollStatus').textContent='Für diesen Dienstag wurde noch kein Spieltag angelegt.';updateAdminVisibility();await Promise.all([loadCancelledCourts(),loadHistory(),loadStats()]);return;}
  state.matchDay=data;
  $('heroDate').textContent=niceDate(data.match_date);
  await Promise.all([loadPoll(),loadAssignments(),loadMatches(),loadPayments(),loadCancelledCourts(),loadHistory(),loadResults(),loadStats()]);
  await loadPushStatus();
  updateAdminVisibility();
}

function updateAdminVisibility(){
  const adminCard=$('adminCard');
  const isAdmin=state.currentPlayer?.is_admin===true;
  document.querySelectorAll('.cancel-court').forEach(b=>{
    b.style.display=isAdmin?'inline-block':'none';
    b.setAttribute('aria-hidden',isAdmin?'false':'true');
  });
  if(!adminCard)return;
  if(isAdmin){
    adminCard.classList.remove('hidden');
    loadPlayerAdmin().catch(console.error);
  }else{
    adminCard.classList.add('hidden');
  }
}

document.addEventListener('poll-updated',()=>{if(state.matchDay)loadAssignments().catch(console.error);});
bindAuth(loadAll);bindPoll();bindSchedule();bindAdmin();bindPush();bindCancellations();loadLoginPlayers();loadSession(loadAll);
