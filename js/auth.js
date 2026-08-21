import { supabase, SUPABASE_URL } from './supabase.js';
import { state } from './state.js';
import { $, msg, escapeHtml } from './utils.js';


function showLogin() {
  $('loginView')?.classList.remove('hidden');
  $('appView')?.classList.add('hidden');
}


function showApp() {
  $('loginView')?.classList.add('hidden');
  $('appView')?.classList.remove('hidden');
}


function getSession() {
  return supabase.auth.getSession();
}


/*
 * SPIELER LADEN
 */

export async function loadLoginPlayers() {

  const select =
    $('playerSelect');

  if (!select) return;


  const q =
    await supabase
      .from('players')
      .select(
        'id,name,active'
      )
      .eq(
        'active',
        true
      )
      .order(
        'name'
      );


  if (q.error) {

    msg(
      $('loginStatus'),
      q.error.message
    );

    return;
  }


  select.innerHTML =
    '<option value="">Spieler auswählen …</option>';


  (q.data || []).forEach(
    player => {

      const option =
        document.createElement(
          'option'
        );

      option.value =
        player.name;

      option.textContent =
        player.name;

      select.appendChild(
        option
      );

    }
  );
}



/*
 * AKTUELLEN SPIELER AUS SESSION LADEN
 */

async function loadCurrentPlayerFromSession() {

  const {
    data: { session }
  } = await getSession();


  if (!session?.user?.id) {
    state.currentPlayer = null;
    return null;
  }


  const q =
    await supabase
      .from('players')
      .select(
        'id,name,active,is_admin,is_stammspieler,paypal_email,auth_user_id,login_email,password_initialized'
      )
      .eq(
        'auth_user_id',
        session.user.id
      )
      .maybeSingle();


  if (q.error) {

    console.error(
      'Spieler konnte nicht geladen werden:',
      q.error
    );

    return null;
  }


  if (!q.data || q.data.active === false) {

    state.currentPlayer = null;

    await supabase.auth.signOut();

    return null;
  }


  state.currentPlayer =
    q.data;


  return q.data;
}



/*
 * PASSWORT-EINRICHTUNG
 */

function showPasswordSetup() {

  $('loginView')?.classList.remove(
    'hidden'
  );

  $('appView')?.classList.add(
    'hidden'
  );


  const box =
    document.querySelector(
      '.loginbox'
    );


  if (!box) return;


  let setup =
    $('passwordSetup');


  if (setup) {

    setup.classList.remove(
      'hidden'
    );

    return;
  }


  setup =
    document.createElement(
      'div'
    );


  setup.id =
    'passwordSetup';


  setup.innerHTML = `

    <div
      style="
        margin-top:20px;
        padding-top:20px;
        border-top:1px solid #e5e7eb
      "
    >

      <h2
        style="
          margin:0 0 8px;
        "
      >
        🔐 Eigenes Passwort festlegen
      </h2>


      <p
        style="
          color:#6b7280;
          margin:0 0 15px;
        "
      >
        Deine Initial-PIN war nur für die
        Ersteinrichtung gedacht.
        Bitte lege jetzt dein persönliches
        Passwort fest.
      </p>


      <label
        for="newPassword"
      >
        Neues Passwort
      </label>


      <input
        id="newPassword"
        class="logininput"
        type="password"
        autocomplete="new-password"
        placeholder="Mindestens 8 Zeichen"
      >


      <label
        for="newPassword2"
      >
        Passwort wiederholen
      </label>


      <input
        id="newPassword2"
        class="logininput"
        type="password"
        autocomplete="new-password"
        placeholder="Passwort wiederholen"
      >


      <button
        id="setPassword"
        class="google"
        style="margin-top:10px"
      >
        🔐 Passwort speichern
      </button>


      <div
        id="passwordSetupStatus"
        style="margin-top:10px"
      ></div>

    </div>

  `;


  box.appendChild(
    setup
  );


  $('setPassword').onclick =
    setInitialPassword;
}



/*
 * PASSWORT SETZEN
 */

async function setInitialPassword() {

  const password =
    $('newPassword')?.value || '';


  const password2 =
    $('newPassword2')?.value || '';


  const status =
    $('passwordSetupStatus');


  const button =
    $('setPassword');


  if (!password) {

    msg(
      status,
      'Bitte ein Passwort eingeben.'
    );

    return;
  }


  if (password.length < 8) {

    msg(
      status,
      'Das Passwort muss mindestens 8 Zeichen haben.'
    );

    return;
  }


  if (!/[A-Za-z]/.test(password)) {

    msg(
      status,
      'Das Passwort muss mindestens einen Buchstaben enthalten.'
    );

    return;
  }


  if (!/[0-9]/.test(password)) {

    msg(
      status,
      'Das Passwort muss mindestens eine Zahl enthalten.'
    );

    return;
  }


  if (password !== password2) {

    msg(
      status,
      'Die Passwörter stimmen nicht überein.'
    );

    return;
  }


  button.disabled =
    true;

  button.textContent =
    '⏳ Wird gespeichert …';


  try {

    const {
      data: { session }
    } = await getSession();


    if (!session?.access_token) {

      msg(
        status,
        'Sitzung abgelaufen. Bitte erneut anmelden.'
      );

      return;
    }


    const response =
      await fetch(
        SUPABASE_URL +
        '/functions/v1/player-auth',
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
            action:
              'set_password',

            password
          })
        }
      );


    const result =
      await response
        .json()
        .catch(
          () => ({})
        );


    if (!response.ok) {

      msg(
        status,
        result.error ||
        result.message ||
        'Passwort konnte nicht gespeichert werden.'
      );

      return;
    }


    msg(
      status,
      '✅ Passwort erfolgreich eingerichtet.',
      true
    );


    if ($('passwordSetup')) {

      $('passwordSetup')
        .classList.add(
          'hidden'
        );

    }


    showApp();


    const player =
      await loadCurrentPlayerFromSession();


    if (player) {

      if ($('who')) {

        $('who').textContent =
          player.name +
          (
            player.is_admin
              ? ' 👑'
              : ''
          );

      }

      /*
       * app.js übernimmt anschließend
       * den normalen Seitenaufbau.
       */

      window.dispatchEvent(
        new CustomEvent(
          'padel-password-ready'
        )
      );

    }


  } catch (error) {

    msg(
      status,
      error?.message ||
      'Fehler beim Speichern des Passworts.'
    );

  } finally {

    button.disabled =
      false;

    button.textContent =
      '🔐 Passwort speichern';

  }
}



/*
 * LOGIN MIT INITIAL-PIN
 */

async function loginWithPin(
  onLogin
) {

  const name =
    $('playerSelect')?.value || '';


  const pin =
    $('pinInput')?.value || '';


  if (!name) {

    msg(
      $('loginStatus'),
      'Bitte zuerst einen Spieler auswählen.'
    );

    return;
  }


  if (!/^[0-9]{6}$/.test(pin)) {

    msg(
      $('loginStatus'),
      'Bitte die 6-stellige PIN eingeben.'
    );

    return;
  }


  const button =
    $('pinLogin');


  button.disabled =
    true;

  button.textContent =
    '⏳ Anmeldung …';


  try {

    const response =
      await fetch(
        SUPABASE_URL +
        '/functions/v1/player-auth',
        {
          method: 'POST',

          headers: {
            'Content-Type':
              'application/json'
          },

          body: JSON.stringify({
            action: 'login',
            name,
            pin
          })
        }
      );


    const result =
      await response
        .json()
        .catch(
          () => ({})
        );


    if (!response.ok) {

      msg(
        $('loginStatus'),
        result.error ||
        'Anmeldung fehlgeschlagen.'
      );

      return;
    }


    if (!result.session) {

      msg(
        $('loginStatus'),
        'Keine gültige Sitzung erhalten.'
      );

      return;
    }


    /*
     * Supabase Session speichern
     */

    const sessionResult =
      await supabase.auth.setSession({
        access_token:
          result.session.access_token,

        refresh_token:
          result.session.refresh_token
      });


    if (sessionResult.error) {

      msg(
        $('loginStatus'),
        sessionResult.error.message
      );

      return;
    }


    state.currentPlayer =
      result.player;


    /*
     * ERSTER LOGIN
     */

    if (
      result.must_set_password === true
    ) {

      msg(
        $('loginStatus'),
        '✅ PIN akzeptiert. Bitte jetzt dein persönliches Passwort festlegen.',
        true
      );


      showPasswordSetup();

      return;
    }


    /*
     * NORMALER LOGIN
     */

    showApp();


    if ($('who')) {

      $('who').textContent =
        result.player.name +
        (
          result.player.is_admin
            ? ' 👑'
            : ''
        );

    }


    if (
      typeof onLogin ===
      'function'
    ) {

      await onLogin();

    }

  } catch (error) {

    msg(
      $('loginStatus'),
      error?.message ||
      'Anmeldung fehlgeschlagen.'
    );

  } finally {

    button.disabled =
      false;

    button.textContent =
      '🔐 Anmelden';

  }
}



/*
 * AUTH BINDINGS
 */

export function bindAuth(
  onLogin
) {

  const loginButton =
    $('pinLogin');


  if (loginButton) {

    loginButton.onclick =
      () =>
        loginWithPin(
          onLogin
        );

  }


  const pinInput =
    $('pinInput');


  if (pinInput) {

    pinInput.addEventListener(
      'keydown',
      e => {

        if (
          e.key === 'Enter'
        ) {

          loginWithPin(
            onLogin
          );

        }

      }
    );

  }


  const logout =
    $('logout');


  if (logout) {

    logout.onclick =
      async () => {

        await supabase.auth.signOut();

        state.currentPlayer =
          null;

        showLogin();

        if ($('pinInput')) {

          $('pinInput').value =
            '';

        }

        if ($('playerSelect')) {

          $('playerSelect').value =
            '';

        }

        msg(
          $('loginStatus'),
          'Du wurdest abgemeldet.',
          true
        );

      };

  }
}



/*
 * SESSION BEIM START
 */

export async function loadSession(
  onLogin
) {

  await loadLoginPlayers();


  const player =
    await loadCurrentPlayerFromSession();


  if (!player) {

    showLogin();

    return;
  }


  /*
   * Falls noch kein persönliches Passwort
   * eingerichtet wurde.
   */

  if (
    player.password_initialized !== true
  ) {

    showPasswordSetup();

    msg(
      $('loginStatus'),
      'Bitte zuerst dein persönliches Passwort festlegen.'
    );

    return;
  }


  showApp();


  if ($('who')) {

    $('who').textContent =
      player.name +
      (
        player.is_admin
          ? ' 👑'
          : ''
      );

  }


  if (
    typeof onLogin ===
    'function'
  ) {

    await onLogin();

  }
}
