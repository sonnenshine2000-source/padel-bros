import { supabase, SUPABASE_URL } from './supabase.js';
import { state } from './state.js';
import { $, escapeHtml, msg } from './utils.js';

export function showLogin(text = '') {
  $('appView').classList.add('hidden');
  $('loginView').classList.remove('hidden');

  $('loginStatus').innerHTML = text
    ? '<div class="denied">' + escapeHtml(text) + '</div>'
    : '';
}

export async function loadLoginPlayers() {
  const q = await supabase
    .from('players')
    .select('id,name,active')
    .eq('active', true)
    .order('name');

  if (q.error) {
    $('playerSelect').innerHTML =
      '<option value="">Spielerliste konnte nicht geladen werden</option>';
    return;
  }

  $('playerSelect').innerHTML =
    '<option value="">Spieler auswählen …</option>' +
    (q.data || [])
      .map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`)
      .join('');
}

export async function loadSession(loadAll) {
  const { data: { session } } = await supabase.auth.getSession();
  state.currentUser = session?.user || null;

  if (!state.currentUser) {
    showLogin();
    await loadLoginPlayers();
    return;
  }

  const { data: player, error } = await supabase
    .from('players')
    .select('id,name,is_admin,is_stammspieler,paypal_email,auth_user_id,active,login_email')
    .eq('auth_user_id', state.currentUser.id)
    .maybeSingle();

  if (error || !player || player.active === false) {
    await supabase.auth.signOut();
    showLogin('Dein Zugang ist nicht freigeschaltet.');
    await loadLoginPlayers();
    return;
  }

  state.currentPlayer = player;

  $('who').textContent = player.name + (player.is_admin ? ' 👑' : '');
  $('adminCard').classList.toggle('hidden', !player.is_admin);
  $('loginView').classList.add('hidden');
  $('appView').classList.remove('hidden');

  await loadAll();
}

export function bindAuth(loadAll) {
  $('pinLogin').onclick = async () => {
    const select = $('playerSelect');
    const playerId = select.value;
    const name = select.options[select.selectedIndex]?.text || '';
    const pin = $('pinInput').value.trim();

    if (!playerId) {
      return msg($('loginStatus'), 'Bitte zuerst deinen Namen auswählen.');
    }

    if (!/^\d{6}$/.test(pin)) {
      return msg($('loginStatus'), 'Bitte eine 6-stellige PIN eingeben.');
    }

    $('pinLogin').disabled = true;
    $('pinLogin').textContent = '🔄 Anmeldung …';

    try {
      const res = await fetch(
        SUPABASE_URL + '/functions/v1/player-auth',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'login', name, pin })
        }
      );

      const body = await res.json();

      if (!res.ok) {
        msg($('loginStatus'), body.error || 'Anmeldung fehlgeschlagen.');
        return;
      }

      if (body.session) {
        await supabase.auth.setSession({
          access_token: body.session.access_token,
          refresh_token: body.session.refresh_token
        });
      }

      $('pinInput').value = '';
      await loadSession(loadAll);
    } catch (e) {
      msg($('loginStatus'), 'Anmeldung fehlgeschlagen.');
    } finally {
      $('pinLogin').disabled = false;
      $('pinLogin').textContent = '🔐 Anmelden';
    }
  };

  $('pinInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') $('pinLogin').click();
  });

  $('logout').onclick = async () => {
    await supabase.auth.signOut();
    location.reload();
  };

  supabase.auth.onAuthStateChange(() => loadSession(loadAll));
}
