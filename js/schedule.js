import { supabase } from './supabase.js';
import { state } from './state.js';
import { $, msg, escapeHtml } from './utils.js';
import { FUNCTION_URL } from './config.js';


export async function loadAssignments() {
  if (!state.matchDay) {
    return;
  }

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



export function bindSchedule() {

  const button = $('generate');

  if (!button) {
    console.error(
      'Button #generate nicht gefunden.'
    );

    return;
  }


  button.onclick = async () => {

    if (!state.currentPlayer?.is_admin) {

      msg(
        $('adminStatus'),
        'Nur ein Admin kann den Spielplan erzeugen.'
      );

      return;
    }


    if (!state.matchDay?.id) {

      msg(
        $('adminStatus'),
        'Kein Spieltag geladen.'
      );

      return;
    }


    button.disabled = true;

    button.textContent =
      '⏳ Spielplan wird erzeugt …';


    msg(
      $('adminStatus'),
      'Spielplan wird erzeugt …',
      true
    );


    try {

      const {
        data: { session },
        error: sessionError
      } = await supabase.auth.getSession();


      if (sessionError) {

        throw new Error(
          'Session konnte nicht geladen werden: ' +
          sessionError.message
        );
      }


      if (!session?.access_token) {

        throw new Error(
          'Keine gültige Anmeldung vorhanden.'
        );
      }


      console.log(
        'Spielplan erzeugen:',
        {
          match_day_id:
            state.matchDay.id,

          poll_open:
            state.matchDay.poll_open,

          poll_closed:
            state.matchDay.poll_closed
        }
      );


      const res = await fetch(
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
              Number(state.matchDay.id)
          })
        }
      );


      let body = {};

      try {

        body =
          await res.json();

      } catch {

        body = {};

      }


      console.log(
        'generate-schedule Antwort:',
        res.status,
        body
      );


      if (!res.ok) {

        const errorText =
          body.details ||
          body.error ||
          body.message ||
          (
            'Fehler ' +
            res.status
          );


        msg(
          $('adminStatus'),
          '❌ Spielplan konnte nicht erzeugt werden: ' +
          errorText
        );


        return;
      }


      if (!body.ok) {

        msg(
          $('adminStatus'),
          '❌ Spielplan konnte nicht erzeugt werden: ' +
          (
            body.details ||
            body.error ||
            body.message ||
            'Unbekannter Fehler.'
          )
        );


        return;
      }


      await loadAssignments();


      const summary =
        (body.assignments || [])
          .map(
            x =>
              `${x.court}: ${x.count} Spieler`
          )
          .join(' · ');


      msg(
        $('adminStatus'),
        '✅ Spielplan wurde erzeugt.' +
        (
          summary
            ? ' ' + summary
            : ''
        ),
        true
      );


    } catch (error) {

      console.error(
        'generate-schedule Fehler:',
        error
      );


      msg(
        $('adminStatus'),
        '❌ ' +
        (
          error?.message ||
          'Unbekannter Fehler beim Erzeugen des Spielplans.'
        )
      );


    } finally {

      button.disabled = false;

      button.textContent =
        '📋 Spielplan jetzt erzeugen';
    }

  };
}
