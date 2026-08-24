import { supabase } from './supabase.js';
import { state } from './state.js';
import { $, escapeHtml, msg } from './utils.js';

function courtLabel(court) {
  return court === 'court5' ? 'Court 5' : 'Court 1';
}

export async function loadCancelledCourts() {
  const el = $('cancelledHistory');
  if (!el) return;

  const { data, error } = await supabase
    .from('cancelled_courts')
    .select(`id,original_booking_date,original_court,original_time,replacement_week,replacement_date,status,created_at,cancelled_court_credits(id,credit_amount,used_at,players:player_id(name),used_by:used_by_player_id(name))`)
    .order('created_at', { ascending: false });

  if (error) {
    el.innerHTML = `<div class="status err">${escapeHtml(error.message)}</div>`;
    return;
  }

  if (!data?.length) {
    el.innerHTML = '<div class="sub">Noch keine stornierten Courts.</div>';
    return;
  }

  el.innerHTML = data.map(c => {
    const credits = c.cancelled_court_credits || [];
    const open = credits.filter(x => !x.used_at);
    return `
      <div class="cancelled-item">
        <div class="cancelled-head">
          <div>
            <b>🔄 ${escapeHtml(courtLabel(c.original_court))}</b>
            <div class="sub">${escapeHtml(c.original_booking_date || 'Datum unbekannt')} · ${escapeHtml(c.original_time || '')}</div>
          </div>
          <span class="count">Woche ${escapeHtml(String(c.replacement_week || 51))}</span>
        </div>
        <div class="sub">Guthaben der ursprünglichen Spieler:</div>
        <div class="credit-list">
          ${credits.map(x => `
            <div class="credit-row">
              <span><b>${escapeHtml(x.players?.name || 'Spieler')}</b></span>
              <span class="credit-amount">${Number(x.credit_amount).toFixed(2).replace('.', ',')} €${x.used_at ? ' · eingelöst' : ' · offen'}</span>
            </div>
          `).join('')}
        </div>
        <div class="sub" style="margin:10px 0 0">${open.length} offene Guthaben</div>
      </div>
    `;
  }).join('');
}

async function cancelCourt(court) {
  if (!state.currentPlayer?.is_admin || !state.matchDay?.id) return;

  const label = courtLabel(court);
  if (!confirm(`${label} für ${state.matchDay.match_date} wirklich stornieren?\n\nDie 4 aktuell zugeordneten Spieler erhalten jeweils 15 € Guthaben für die nachgeholte Buchung.`)) return;

  const { data: existing } = await supabase
    .from('cancelled_courts')
    .select('id')
    .eq('match_day_id', state.matchDay.id)
    .eq('original_court', court)
    .maybeSingle();

  if (existing) {
    msg($('adminStatus'), `${label} wurde bereits storniert.`);
    return;
  }

  const { data: assignments, error: assignmentError } = await supabase
    .from('assignments')
    .select('player_id,position,players(name,is_stammspieler)')
    .eq('match_day_id', state.matchDay.id)
    .eq('court', court)
    .order('position');

  if (assignmentError) {
    msg($('adminStatus'), 'Spieler konnten nicht geladen werden: ' + assignmentError.message);
    return;
  }

  const players = (assignments || []).filter(x => x.player_id).slice(0, 4);
  if (players.length !== 4) {
    msg($('adminStatus'), `${label} kann erst storniert werden, wenn genau 4 Spieler zugeordnet sind.`);
    return;
  }

  const { count } = await supabase
    .from('cancelled_courts')
    .select('*', { count: 'exact', head: true });

  const replacementWeek = 51 + (count || 0);

  const { data: cancelled, error } = await supabase
    .from('cancelled_courts')
    .insert({
      match_day_id: state.matchDay.id,
      original_booking_date: state.matchDay.match_date,
      original_court: court,
      original_time: court === 'court5' ? '18:30' : '19:00',
      replacement_week: replacementWeek,
      status: 'pending'
    })
    .select('id')
    .single();

  if (error) {
    msg($('adminStatus'), 'Stornierung konnte nicht gespeichert werden: ' + error.message);
    return;
  }

  const credits = players.map(p => ({
    cancelled_court_id: cancelled.id,
    player_id: p.player_id,
    credit_amount: 15
  }));

  const creditResult = await supabase.from('cancelled_court_credits').insert(credits);
  if (creditResult.error) {
    await supabase.from('cancelled_courts').delete().eq('id', cancelled.id);
    msg($('adminStatus'), 'Guthaben konnten nicht gespeichert werden: ' + creditResult.error.message);
    return;
  }

  const flag = court === 'court5' ? { court_5_cancelled: true } : { court_1_cancelled: true };
  const update = await supabase.from('match_days').update(flag).eq('id', state.matchDay.id);
  if (update.error) {
    msg($('adminStatus'), 'Court wurde gespeichert, aber der Spieltag konnte nicht aktualisiert werden: ' + update.error.message);
    return;
  }

  state.matchDay = { ...state.matchDay, ...flag };
  msg($('adminStatus'), `🔄 ${label} storniert. Woche ${replacementWeek} wurde als Nachholbuchung vorgemerkt. 4 × 15 € Guthaben wurden angelegt.`, true);
  await loadCancelledCourts();
}

export function bindCancellations() {
  const buttons = document.querySelectorAll('[data-cancel-court]');
  buttons.forEach(button => {
    button.onclick = () => cancelCourt(button.dataset.cancelCourt);
  });
}
