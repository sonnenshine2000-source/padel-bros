import { supabase, SUPABASE_URL } from './supabase.js';
import { sendTestPush } from './notifications.js';
import { state } from './state.js';
import { $, msg, escapeHtml } from './utils.js';

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
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:center">
          <div>
            <b>${escapeHtml(p.name)}</b>
            ${p.is_admin ? ' 👑' : ''}
            ${
              p.is_stammspieler
                ? ' <span class="star">⭐</span>'
                : ''
            }

            <div class="sub" style="margin:4px 0 0">
              ${p.active === false ? '🔒 Gesperrt' : '🟢 Aktiv'}
              ·
              ${
                p.auth_user_id
                  ? 'PIN eingerichtet'
                  : 'Noch keine PIN'
              }
            </div>
          </div>

          <div style="display:flex;gap:6px;flex-wrap:wrap">
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
              ${p.active === false ? 'Freigeben' : 'Sperren'}
            </button>

            <button
              class="smallAdmin"
              data-action="stamm"
              data-id="${p.id}"
            >
              ${p.is_stammspieler ? '⭐ Stamm' : '☆ Ersatz'}
            </button>
          </div>
        </div>
      </div>
    `
      )
      .join('') ||
    '<div class="sub">Noch keine Spieler.</div>';
}

export function bindAdmin() {
  document.addEventListener('click', async e => {
    /*
     * TEST-PUSH
     */
    const testPushBtn = e.target.closest('#testPush');

    if (testPushBtn) {
      testPushBtn.disabled = true;
      testPushBtn.textContent = '⏳ Wird gesendet …';

      try {
        const result = await sendTestPush();

        if (result?.ok) {
          msg(
            $('adminStatus'),
            '🔔 Test-Push wurde gesendet.',
            true
          );
        } else {
          let details = result?.error || '';

          if (!details && Array.isArray(result?.results)) {
            details = result.results
              .map(r => {
                const status =
                  r.statusCode ?? '???';

                const message =
                  r.message ||
                  r.body ||
                  'unbekannter Fehler';

                return `${status}: ${message}`;
              })
              .join(' | ');
          }

          if (!details) {
            details = 'Unbekannter Push-Fehler.';
          }

          msg(
            $('adminStatus'),
            '❌ ' + details
          );
        }
      } catch (error) {
        msg(
          $('adminStatus'),
          error?.message ||
            'Fehler beim Test-Push.'
        );
      }

      testPushBtn.disabled = false;
      testPushBtn.textContent =
        '🔔 Test-Push senden';

      return;
    }

    /*
     * SPIELERVERWALTUNG
     */
    const btn = e.target.closest('.smallAdmin');

    if (!btn) return;

    const id = Number(btn.dataset.id);
    const action = btn.dataset.action;

    if (!id) return;

    const session =
      (await supabase.auth.getSession()).data.session;

    /*
     * PIN ÄNDERN
     */
    if (action === 'pin') {
      const pin = prompt(
        'Neue 6-stellige PIN für diesen Spieler:'
      );

      if (!pin) return;

      if (!/^\d{6}$/.test(pin)) {
        return msg(
          $('adminStatus'),
          'Die PIN muss genau 6 Ziffern enthalten.'
        );
      }

      const res = await fetch(
        SUPABASE_URL +
          '/functions/v1/player-auth',
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
            Authorization:
              'Bearer ' +
              (session?.access_token || '')
          },

          body: JSON.stringify({
            action: 'set_pin',
            player_id: id,
            pin
          })
        }
      );

      const body = await res.json();

      if (!res.ok) {
        msg(
          $('adminStatus'),
          body.error ||
            'PIN konnte nicht gesetzt werden.'
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

    /*
     * AKTIV / GESPERRT
     */
    if (action === 'active') {
      const row = await supabase
        .from('players')
        .select('active')
        .eq('id', id)
        .single();

      if (row.error) return;

      const res = await fetch(
        SUPABASE_URL +
          '/functions/v1/player-auth',
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
            Authorization:
              'Bearer ' +
              (session?.access_token || '')
          },

          body: JSON.stringify({
            action: 'set_active',
            player_id: id,
            active: !row.data.active
          })
        }
      );

      const body = await res.json();

      if (!res.ok) {
        msg(
          $('adminStatus'),
          body.error ||
            'Status konnte nicht geändert werden.'
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

    /*
     * STAMMSPIELER / ERSATZ
     */
    if (action === 'stamm') {
      const row = await supabase
        .from('players')
        .select('is_stammspieler')
        .eq('id', id)
        .single();

      if (row.error) return;

      const r = await supabase
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

      return;
    }
  });
}
