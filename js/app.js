import { supabase } from './supabase.js';
import { state } from './state.js';
import { $, msg, niceDate, nextTuesday } from './utils.js';

import {
  loadSession,
  loadLoginPlayers,
  bindAuth
} from './auth.js';

import {
  loadPoll,
  bindPoll
} from './poll.js';

import {
  loadAssignments,
  bindSchedule
} from './schedule.js';

import {
  loadMatches
} from './matches.js';

import {
  loadPayments
} from './payments.js';

import {
  loadPlayerAdmin,
  bindAdmin
} from './admin.js';

import {
  bindPush,
  loadPushStatus
} from './notifications.js';


export async function loadAll() {

  /*
   * Sicherheitscheck:
   * Ohne Spieler nicht weiterladen.
   */

  if (!state.currentPlayer) {
    return;
  }


  /*
   * Spieltag bestimmen
   */

  const date =
    nextTuesday();


  const {
    data,
    error
  } = await supabase

    .from('match_days')

    .select(
      `
        id,
        match_date,
        poll_open,
        poll_closed,
        court_5_cancelled,
        court_1_cancelled
      `
    )

    .eq(
      'match_date',
      date
    )

    .maybeSingle();


  if (error) {

    console.error(
      'match_days Fehler:',
      error
    );

    msg(
      $('pollStatus'),
      error.message
    );

    return;
  }


  /*
   * Noch kein Spieltag
   */

  if (!data) {

    $('heroDate').textContent =
      niceDate(date);


    $('pollStatus').textContent =
      'Für diesen Dienstag wurde noch kein Spieltag angelegt.';


    /*
     * Admin-Bereich trotzdem anzeigen
     */

    updateAdminVisibility();


    return;
  }


  /*
   * Spieltag speichern
   */

  state.matchDay =
    data;


  $('heroDate').textContent =
    niceDate(
      data.match_date
    );


  /*
   * Normale Inhalte laden
   */

  await Promise.all([

    loadPoll(),

    loadAssignments(),

    loadMatches(),

    loadPayments()

  ]);


  /*
   * Push-Status
   */

  await loadPushStatus();


  /*
   * Admin-Bereich
   */

  updateAdminVisibility();

}


/*
 * ADMIN-BEREICH EIN-/AUSBLENDEN
 */

function updateAdminVisibility() {

  const adminCard =
    $('adminCard');


  if (!adminCard) {
    return;
  }


  const isAdmin =
    state.currentPlayer?.is_admin === true;


  if (isAdmin) {

    adminCard.classList.remove(
      'hidden'
    );


    /*
     * Spielerverwaltung laden
     */

    loadPlayerAdmin()
      .catch(error => {

        console.error(
          'Spielerverwaltung konnte nicht geladen werden:',
          error
        );

      });


  } else {

    adminCard.classList.add(
      'hidden'
    );

  }

}


/*
 * AUTH
 */

bindAuth(
  loadAll
);


/*
 * UMFRAGE
 */

bindPoll();


/*
 * SPIELPLAN
 */

bindSchedule();


/*
 * ADMIN
 */

bindAdmin();


/*
 * PUSH
 */

bindPush();


/*
 * LOGIN-SPIELER LADEN
 */

loadLoginPlayers();


/*
 * SESSION PRÜFEN
 */

loadSession(
  loadAll
);
