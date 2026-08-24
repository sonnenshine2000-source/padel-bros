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

export async function loadAll() {
  if (!state.currentPlayer) return;
  const date = nextTuesday();
  const { data, error } = await supabase.from('match_days').select('id,match_date,poll_open,poll_closed,court_5_cancelled,court_1_cancelled').eq('match_date', date).maybeSingle();
  if (error) { console.error('match_days Fehler:', error); msg($('pollStatus'), error.message); return; }
  if (!data) { $('heroDate').textContent = niceDate(date); $('pollStatus').textContent = 'Für diesen Dienstag wurde noch kein Spieltag angelegt.'; updateAdminVisibility(); await Promise.all([loadCancelledCourts(), loadHistory()]); return; }
  state.matchDay = data;
  $('heroDate').textContent = niceDate(data.match_date);
  await Promise.all([loadPoll(), loadAssignments(), loadMatches(), loadPayments(), loadCancelledCourts(), loadHistory()]);
  await loadPushStatus();
  updateAdminVisibility();
}

function updateAdminVisibility() {
  const adminCard = $('adminCard');
  const isAdmin = state.currentPlayer?.is_admin === true;
  document.querySelectorAll('.cancel-court').forEach(b => b.style.display = isAdmin ? 'inline-block' : 'none');
  if (!adminCard) return;
  if (isAdmin) { adminCard.classList.remove('hidden'); loadPlayerAdmin().catch(error => console.error('Spielerverwaltung konnte nicht geladen werden:', error)); }
  else adminCard.classList.add('hidden');
}

bindAuth(loadAll); bindPoll(); bindSchedule(); bindAdmin(); bindPush(); bindCancellations(); loadLoginPlayers(); loadSession(loadAll);
