import { supabase } from './supabase.js';
import { state } from './state.js';
import { $, msg, escapeHtml } from './utils.js';
import { FUNCTION_URL } from './config.js';

export async function loadAssignments() {
  const q = await supabase
    .from('assignments')
    .select('court,position,manually_changed,players(name,is_stammspieler)')
    .eq('match_day_id', state.matchDay.id)
    .order('court')
    .order('position');

  if (q.error) {
    msg($('scheduleStatus'), q.error.message);
    return;
  }

  const render = (arr, el) => {
    $(el).innerHTML = arr.length
      ? arr.map(x => `
          <div class="player">
            <b>${escapeHtml(x.players?.name || 'Spieler')}</b>
            ${
              x.players?.is_stammspieler
                ? '<span class="badge">⭐ Stammspieler</span>'
                : '<span class="badge">Ersatz</span>'
            }
            ${
              x.manually_changed
                ? '<span class="badge">✋ geändert</span>'
                : ''
            }
          </div>
        `).join('')
      : '<div class="player">Noch keine Zuordnung.</div>';
  };

  render((q.data || []).filter(x => x.court === 'court5'), 'court5');
  render((q.data || []).filter(x => x.court === 'court1'), 'court1');
}

export function bindSchedule() {
  $('generate').onclick = async () => {
    if (!state.currentPlayer?.is_admin) return;

    msg($('adminStatus'), 'Spielplan wird erzeugt …', true);

    const { data: { session } } = await supabase.auth.getSession();

    const res = await fetch(FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + session.access_token
      },
      body: JSON.stringify({ match_day_id: state.matchDay.id })
    });

    let body = {};
    try { body = await res.json(); } catch {}

    if (!res.ok) {
      msg($('adminStatus'),
        body.message || body.error || ('Fehler ' + res.status));
    } else {
      msg($('adminStatus'), 'Spielplan wurde erzeugt.', true);
      await loadAssignments();
    }
  };
}
