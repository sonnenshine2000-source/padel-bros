import { supabase } from './supabase.js';
import { state } from './state.js';
import { $, msg, label, isPollClosed, escapeHtml } from './utils.js';

export function updatePollUI() {
  const closed = isPollClosed(state.matchDay);

  document.querySelectorAll('.vote').forEach(b => {
    b.disabled = closed;
  });

  $('pollInfo').textContent = closed
    ? '🔒 Umfrage geschlossen · seit Dienstag 17:00 Uhr keine Änderungen mehr möglich.'
    : 'Offen bis Dienstag 17:00 Uhr.';
}

export async function loadPoll() {
  if (!state.matchDay) return;

  updatePollUI();

  const own = await supabase
    .from('poll_responses')
    .select('response')
    .eq('match_day_id', state.matchDay.id)
    .eq('player_id', state.currentPlayer.id)
    .maybeSingle();

  document.querySelectorAll('.vote').forEach(b =>
    b.classList.toggle('selected', b.dataset.response === own.data?.response)
  );

  if (own.data?.response) {
    msg(
      $('pollStatus'),
      (isPollClosed(state.matchDay) ? '🔒 Deine letzte Antwort: ' : 'Deine Antwort: ') +
      label(own.data.response),
      true
    );
  }

  const q = await supabase
    .from('poll_responses')
    .select('response,players(name,is_stammspieler)')
    .eq('match_day_id', state.matchDay.id);

  if (q.error) {
    $('pollSummary').textContent =
      'Abstimmungen konnten nicht geladen werden.';
    return;
  }

  const groups = {
    '18:30': [],
    '19:00': [],
    'egal': [],
    'nein': []
  };

  (q.data || []).forEach(r => groups[r.response]?.push(r.players));

  $('pollSummary').innerHTML = Object.entries(groups).map(([k, arr]) => `
    <div class="pollrow">
      <div class="pollhead">
        <span>${label(k)}</span>
        <span class="count">${arr.length}</span>
      </div>
      <div class="names">
        ${
          arr.length
            ? arr.map(p => `
                <span class="namechip">
                  ${escapeHtml(p?.name || 'Spieler')}
                  ${p?.is_stammspieler ? '<span class="star">⭐</span>' : ''}
                </span>
              `).join('')
            : '<span class="sub">Noch niemand</span>'
        }
      </div>
    </div>
  `).join('');
}

export function bindPoll() {
  document.querySelectorAll('.vote').forEach(btn => {
    btn.onclick = async () => {
      if (isPollClosed(state.matchDay)) {
        updatePollUI();
        return msg($('pollStatus'), '🔒 Die Umfrage ist geschlossen.');
      }

      const existing = await supabase
        .from('poll_responses')
        .select('id')
        .eq('match_day_id', state.matchDay.id)
        .eq('player_id', state.currentPlayer.id)
        .maybeSingle();

      const payload = {
        response: btn.dataset.response,
        updated_at: new Date().toISOString()
      };

      const result = existing.data?.id
        ? await supabase
            .from('poll_responses')
            .update(payload)
            .eq('id', existing.data.id)
        : await supabase
            .from('poll_responses')
            .insert({
              ...payload,
              match_day_id: state.matchDay.id,
              player_id: state.currentPlayer.id
            });

      if (result.error) {
        msg($('pollStatus'),
          'Speichern fehlgeschlagen: ' + result.error.message);
      } else {
        msg($('pollStatus'),
          'Gespeichert: ' + label(btn.dataset.response), true);
        await loadPoll();
      }
    };
  });
}
