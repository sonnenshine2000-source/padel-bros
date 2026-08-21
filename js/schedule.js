import { supabase } from './supabase.js';
import { state } from './state.js';
import { $, msg, escapeHtml } from './utils.js';
import { FUNCTION_URL, SUPABASE_URL } from './config.js';

export async function loadAssignments() {
  const q = await supabase
    .from('assignments')
    .select(
      'court,position,manually_changed,players(name,is_stammspieler)'
    )
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

  render(
    (q.data || []).filter(x => x.court === 'court5'),
    'court5'
  );

  render(
    (q.data || []).filter(x => x.court === 'court1'),
    'court1'
  );
}

async function sendSchedulePush() {
  try {
    const {
      data: { session }
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      console.warn('Keine Sitzung für Spielplan-Push.');
      return;
    }

    const response = await fetch(
      SUPABASE_URL + '/functions/v1/send-push-v5',
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + session.access_token
        },

        body: JSON.stringify({
          type: 'schedule',
          title: '🎾 Spielplan ist fertig',
          body: 'Der Spielplan wurde erstellt.',
          match_day_id: state.matchDay.id
        })
      }
    );

    let result = {};

    try {
      result = await response.json();
    } catch {
      result = {};
    }

    if (!response.ok) {
      console.warn(
        'Spielplan-Push fehlgeschlagen:',
        result
      );
    } else {
      console.log(
        'Spielplan-Push gesendet:',
        result
      );
    }
  } catch (error) {
    console.warn(
      'Spielplan-Push Fehler:',
      error
    );
  }
}

export function bindSchedule() {
  const button = $('generate');

  if (!button) return;

  button.onclick = async () => {
    if (!state.currentPlayer?.is_admin) return;

    button.disabled = true;

    msg(
      $('adminStatus'),
      'Spielplan wird erzeugt …',
      true
    );

    try {
      const {
        data: { session }
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        msg(
          $('adminStatus'),
          'Nicht angemeldet.'
        );
        return;
      }

      const res = await fetch(FUNCTION_URL, {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
          'Authorization':
            'Bearer ' + session.access_token
        },

        body: JSON.stringify({
          match_day_id: state.matchDay.id
        })
      });

      let body = {};

      try {
        body = await res.json();
      } catch {
        body = {};
      }

      if (!res.ok) {
        msg(
          $('adminStatus'),
          body.message ||
          body.error ||
          ('Fehler ' + res.status)
        );

        return;
      }

      msg(
        $('adminStatus'),
        'Spielplan wurde erzeugt.',
        true
      );

      await loadAssignments();

      await sendSchedulePush();

    } catch (error) {
      msg(
        $('adminStatus'),
        error?.message ||
        'Fehler beim Erzeugen des Spielplans.'
      );
    } finally {
      button.disabled = false;
    }
  };
}
