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

export async function loadAll() {
  const date = nextTuesday();

  const { data, error } = await supabase
    .from('match_days')
    .select(
      'id,match_date,poll_open,poll_closed,court_5_cancelled,court_1_cancelled'
    )
    .eq('match_date', date)
    .maybeSingle();

  if (error) {
    msg($('pollStatus'), error.message);
    return;
  }

  if (!data) {
    $('heroDate').textContent = niceDate(date);
    $('pollStatus').textContent =
      'Für diesen Dienstag wurde noch kein Spieltag angelegt.';
    return;
  }

  state.matchDay = data;
  $('heroDate').textContent = niceDate(data.match_date);

  await Promise.all([
    loadPoll(),
    loadAssignments(),
    loadMatches(),
    loadPayments()
  ]);

  await loadPushStatus();

  if (state.currentPlayer?.is_admin) {
    await loadPlayerAdmin();
  }
}

bindAuth(loadAll);
bindPoll();
bindSchedule();
bindAdmin();
bindPush();

loadSession(loadAll);
