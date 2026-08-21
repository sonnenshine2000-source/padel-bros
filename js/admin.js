import { supabase, SUPABASE_URL } from './supabase.js';
import { sendTestPush } from './notifications.js';
import { state } from './state.js';
import { $, msg, escapeHtml } from './utils.js';

function formatError(value) {
  if (!value) return 'Unbekannter Fehler.';

  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

async function sendBroadcastPush(type, title, body) {
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return {
      ok: false,
      error: 'Nicht angemeldet.'
    };
  }

  try {
    const response = await fetch(
      SUPABASE_URL + '/functions/v1/send-push-v5',
      {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
          'Authorization':
            'Bearer ' + session.access_token
        },

        body: JSON.stringify({
          type,
          title,
          body,
          match_day_id: state.matchDay?.id
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
      return {
        ok: false,
        error:
          formatError(result.error) ||
          formatError(result.message) ||
          `HTTP ${response.status}`
      };
    }

    return result;

  } catch (error) {
    return {
      ok: false,
      error:
        error?.message ||
        'Push konnte nicht gesendet werden.'
    };
  }
}


export async function loadPlayerAdmin() {
  if (!state.currentPlayer?.is_admin) return;

  const q = await supabase
    .from('players')
    .select(
      'id,name,is_admin,is_stammspieler,paypal_email,active,auth_user_id,login_email'
    )
    .order('name');

  if (q.error) {
    $('playerAdminList').innerHTML =
      '<div class="status err">' +
      escapeHtml(q.error.message) +
      '</div>';
    return;
  }

  $('playerAdminList').innerHTML =
    (q.data || [])
      .map(
        p => `
          <div class="item">
            <div
              style="
                display:flex;
                justify-content:space-between;
                gap:10px;
                align-items:center
              "
            >

              <div>

                <b>${escapeHtml(p.name)}</b>

                ${p.is_admin ? ' 👑' : ''}

                ${
                  p.is_stammspieler
                    ? ' <span class="star">⭐</span>'
                    : ''
                }

                <div
                  class="sub"
                  style="margin:4px 0 0"
                >
                  ${
                    p.active === false
                      ? '🔒 Gesperrt'
                      : '🟢 Aktiv'
                  }

                  ·

                  ${
                    p.auth_user_id
                      ? 'PIN eingerichtet'
                      : 'Noch keine PIN'
                  }
                </div>

              </div>

              <div
                style="
                  display:flex;
                  gap:6px;
                  flex-wrap:wrap
                "
              >

                <button
                  class="smallAdmin"
                  data-action="pin"
                  data-id="${p.id}"
                >
                  🔑 PIN
                </button>

                <button
                  class="smallAdmin"
                  data-action="active"
                  data-id="${p.id}"
                >
                  ${
                    p.active === false
                      ? 'Freigeben'
                      : 'Sperren'
                  }
                </button>

                <button
                  class="smallAdmin"
                  data-action="stamm"
                  data-id="${p.id}"
                >
                  ${
                    p.is_stammspieler
                      ? '⭐ Stamm'
                      : '☆ Ersatz'
                  }
                </button>

              </div>

            </div>
          </div>
        `
      )
      .join('') ||
    '<div class="sub">Noch keine Spieler.</div>';
}


async function reloadMatchDay() {
  if (!state.matchDay) return;

  const q = await supabase
    .from('match_days')
    .select(
      'id,match_date,poll_open,poll_closed,court_5_cancelled,court_1_cancelled,poll_push_sent_at'
    )
    .eq('id', state.matchDay.id)
    .single();

  if (q.error) {
    msg(
      $('adminStatus'),
      q.error.message
    );
    return;
  }

  state.matchDay = q.data;
}


async function openPoll() {
  if (!state.currentPlayer?.is_admin) return;

  if (!state.matchDay) {
    msg(
      $('adminStatus'),
      'Kein Spieltag vorhanden.'
    );
    return;
  }

  const button = $('openPoll');

  if (button) {
    button.disabled = true;
    button.textContent = '⏳ Wird geöffnet …';
  }

  try {
    const result = await supabase
      .from('match_days')
      .update({
        poll_open: true,
        poll_closed: false,
        poll_push_sent_at: null
      })
      .eq('id', state.matchDay.id);

    if (result.error) {
      msg(
        $('adminStatus'),
        'Umfrage konnte nicht geöffnet werden: ' +
        result.error.message
      );
      return;
    }

    await reloadMatchDay();

    /*
     * PUSH DIREKT SENDEN
     *
     * Kein Cron notwendig.
     */
    const push = await sendBroadcastPush(
      'poll_open',
      '🎾 Neue Padel-Umfrage',
      `Die Umfrage für ${state.matchDay.match_date} ist jetzt geöffnet.`
    );

    if (push.ok) {
      msg(
        $('adminStatus'),
        '🔓 Umfrage geöffnet · 🔔 Push an alle Geräte gesendet.',
        true
      );
    } else {
      msg(
        $('adminStatus'),
        '🔓 Umfrage geöffnet · ⚠️ Push fehlgeschlagen: ' +
        formatError(push.error)
      );
    }

  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = '🔓 Umfrage öffnen';
    }
  }
}


async function closePoll() {
  if (!state.currentPlayer?.is_admin) return;

  if (!state.matchDay) {
    msg(
      $('adminStatus'),
      'Kein Spieltag vorhanden.'
    );
    return;
  }

  const button = $('closePoll');

  if (button) {
    button.disabled = true;
    button.textContent = '⏳ Wird geschlossen …';
  }

  try {
    const result = await supabase
      .from('match_days')
      .update({
        poll_open: false,
        poll_closed: true
      })
      .eq('id', state.matchDay.id);

    if (result.error) {
      msg(
        $('adminStatus'),
        'Umfrage konnte nicht geschlossen werden: ' +
        result.error.message
      );
      return;
    }

    await reloadMatchDay();

    msg(
      $('adminStatus'),
      '🔒 Umfrage wurde geschlossen.',
      true
    );

  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = '🔒 Umfrage schließen';
    }
  }
}


async function handleTestPush(button) {
  button.disabled = true;
  button.textContent = '⏳ Wird gesendet …';

  try {
    const result = await sendTestPush();

    if (result?.ok) {
      msg(
        $('adminStatus'),
        '🔔 Test-Push wurde gesendet.',
        true
      );
    } else {
      msg(
        $('adminStatus'),
        '❌ ' +
        formatError(
          result?.error ||
          result?.results
        )
      );
    }

  } catch (error) {
    msg(
      $('adminStatus'),
      error?.message ||
      'Fehler beim Test-Push.'
    );
  }

  button.disabled = false;
  button.textContent = '🔔 Test-Push senden';
}


export function bindAdmin() {

  const openButton = $('openPoll');
  const closeButton = $('closePoll');
  const testButton = $('testPush');

  if (openButton) {
    openButton.onclick = openPoll;
  }

  if (closeButton) {
    closeButton.onclick = closePoll;
  }

  if (testButton) {
    testButton.onclick =
      () => handleTestPush(testButton);
  }


  document.addEventListener(
    'click',
    async e => {

      const btn =
        e.target.closest('.smallAdmin');

      if (!btn) return;

      const id =
        Number(btn.dataset.id);

      const action =
        btn.dataset.action;

      if (!id) return;

      const session =
        (
          await supabase.auth.getSession()
        ).data.session;


      if (action === 'pin') {

        const pin =
          prompt(
            'Neue 6-stellige PIN für diesen Spieler:'
          );

        if (!pin) return;

        if (!/^\d{6}$/.test(pin)) {
          msg(
            $('adminStatus'),
            'Die PIN muss genau 6 Ziffern enthalten.'
          );
          return;
        }

        const res =
          await fetch(
            SUPABASE_URL +
            '/functions/v1/player-auth',
            {
              method: 'POST',

              headers: {
                'Content-Type':
                  'application/json',

                Authorization:
                  'Bearer ' +
                  (
                    session?.access_token || ''
                  )
              },

              body: JSON.stringify({
                action: 'set_pin',
                player_id: id,
                pin
              })
            }
          );

        const body =
          await res.json();

        if (!res.ok) {
          msg(
            $('adminStatus'),
            formatError(
              body.error ||
              body.message
            )
          );
        } else {
          msg(
            $('adminStatus'),
            'PIN wurde erfolgreich gesetzt.',
            true
          );

          await loadPlayerAdmin();
        }

        return;
      }


      if (action === 'active') {

        const row =
          await supabase
            .from('players')
            .select('active')
            .eq('id', id)
            .single();

        if (row.error) return;

        const res =
          await fetch(
            SUPABASE_URL +
            '/functions/v1/player-auth',
            {
              method: 'POST',

              headers: {
                'Content-Type':
                  'application/json',

                Authorization:
                  'Bearer ' +
                  (
                    session?.access_token || ''
                  )
              },

              body: JSON.stringify({
                action: 'set_active',
                player_id: id,
                active:
                  !row.data.active
              })
            }
          );

        const body =
          await res.json();

        if (!res.ok) {
          msg(
            $('adminStatus'),
            formatError(
              body.error ||
              body.message
            )
          );
        } else {
          msg(
            $('adminStatus'),
            'Spielerstatus geändert.',
            true
          );

          await loadPlayerAdmin();
        }

        return;
      }


      if (action === 'stamm') {

        const row =
          await supabase
            .from('players')
            .select('is_stammspieler')
            .eq('id', id)
            .single();

        if (row.error) return;

        const r =
          await supabase
            .from('players')
            .update({
              is_stammspieler:
                !row.data.is_stammspieler
            })
            .eq('id', id);

        if (r.error) {
          msg(
            $('adminStatus'),
            r.error.message
          );
        } else {
          await loadPlayerAdmin();
        }
      }

    }
  );
}
