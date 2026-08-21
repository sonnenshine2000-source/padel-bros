import { supabase } from './supabase.js';
import { state } from './state.js';
import { $, msg, escapeHtml } from './utils.js';
import { FUNCTION_URL, SUPABASE_URL } from './config.js';

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


export async function loadAssignments() {

  if (!state.matchDay) return;

  const q = await supabase
    .from('assignments')
    .select(
      'court,position,manually_changed,players(name,is_stammspieler)'
    )
    .eq(
      'match_day_id',
      state.matchDay.id
    )
    .order('court')
    .order('position');


  if (q.error) {

    msg(
      $('scheduleStatus'),
      q.error.message
    );

    return;
  }


  const render = (arr, el) => {

    $(el).innerHTML =
      arr.length

        ? arr.map(x => `
            <div class="player">

              <b>
                ${escapeHtml(
                  x.players?.name ||
                  'Spieler'
                )}
              </b>

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
    (q.data || []).filter(
      x => x.court === 'court5'
    ),
    'court5'
  );


  render(
    (q.data || []).filter(
      x => x.court === 'court1'
    ),
    'court1'
  );
}


async function sendSchedulePush() {

  try {

    const {
      data: { session }
    } = await supabase.auth.getSession();


    if (!session?.access_token) {
      return;
    }


    const response =
      await fetch(
        SUPABASE_URL +
        '/functions/v1/send-push-v5',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json',

            'Authorization':
              'Bearer ' +
              session.access_token
          },

          body: JSON.stringify({
            type: 'schedule',
            title: '🎾 Spielplan ist fertig',
            body: 'Der Spielplan wurde erstellt.',
            match_day_id:
              state.matchDay.id
          })
        }
      );


    const result =
      await response.json().catch(
        () => ({})
      );


    console.log(
      'Spielplan-Push:',
      result
    );


    return result;

  } catch (error) {

    console.error(
      'Spielplan-Push Fehler:',
      error
    );

    return {
      ok: false,
      error:
        error?.message ||
        String(error)
    };
  }
}


export function bindSchedule() {

  const button =
    $('generate');

  if (!button) return;


  button.onclick =
    async () => {

      if (!state.currentPlayer?.is_admin) {
        return;
      }


      button.disabled = true;

      msg(
        $('adminStatus'),
        'Spielplan wird erzeugt …',
        true
      );


      try {

        const {
          data: { session }
        } =
          await supabase.auth.getSession();


        if (!session?.access_token) {

          msg(
            $('adminStatus'),
            'Nicht angemeldet.'
          );

          return;
        }


        const res =
          await fetch(
            FUNCTION_URL,
            {
              method: 'POST',

              headers: {
                'Content-Type':
                  'application/json',

                'Authorization':
                  'Bearer ' +
                  session.access_token
              },

              body: JSON.stringify({
                match_day_id:
                  state.matchDay.id
              })
            }
          );


        const body =
          await res.json().catch(
            () => ({})
          );


        console.log(
          'generate-schedule response:',
          res.status,
          body
        );


        if (!res.ok) {

          const errorText =
            formatError(
              body.error ||
              body.message ||
              body
            );


          msg(
            $('adminStatus'),
            '❌ Spielplan konnte nicht erzeugt werden: ' +
            errorText
          );

          return;
        }


        await loadAssignments();


        const push =
          await sendSchedulePush();


        if (push?.ok) {

          msg(
            $('adminStatus'),
            '📋 Spielplan wurde erzeugt · 🔔 Push gesendet.',
            true
          );

        } else {

          msg(
            $('adminStatus'),
            '📋 Spielplan wurde erzeugt · ⚠️ Push konnte nicht gesendet werden.'
          );

        }

      } catch (error) {

        msg(
          $('adminStatus'),
          '❌ ' +
          (
            error?.message ||
            String(error)
          )
        );

      } finally {

        button.disabled = false;

      }
    };
}
