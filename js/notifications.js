import { supabase, SUPABASE_URL } from './supabase.js';
import { state } from './state.js';
import { $, msg } from './utils.js';
import { VAPID_PUBLIC_KEY } from './config.js';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(base64), c => c.charCodeAt(0));
}

export async function registerPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    return { ok: false, reason: 'Dieser Browser unterstützt Web-Push nicht.' };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { ok: false, reason: 'Benachrichtigungen wurden nicht erlaubt.' };
  }

  const registration = await navigator.serviceWorker.register('./sw.js');

  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
  }

  const json = subscription.toJSON();

  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      player_id: state.currentPlayer.id,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      user_agent: navigator.userAgent,
      enabled: true,
      updated_at: new Date().toISOString()
    }, { onConflict: 'endpoint' });

  if (error) return { ok: false, reason: error.message };

  return { ok: true };
}

export async function unregisterPush() {
  const registration = await navigator.serviceWorker.getRegistration('./sw.js');
  const subscription = await registration?.pushManager.getSubscription();

  if (subscription) {
    await supabase
      .from('push_subscriptions')
      .update({ enabled: false, updated_at: new Date().toISOString() })
      .eq('endpoint', subscription.endpoint);

    await subscription.unsubscribe();
  }
}

export async function loadPushStatus() {
  if (!state.currentPlayer) return;

  const q = await supabase
    .from('push_subscriptions')
    .select('id,enabled')
    .eq('player_id', state.currentPlayer.id)
    .eq('enabled', true)
    .limit(1);

  const enabled = !!q.data?.length;
  const button = $('pushEnable');
  if (!button) return;

  button.textContent = enabled ? '🔔 Push ist aktiv' : '🔕 Push aktivieren';
  button.dataset.enabled = enabled ? '1' : '0';
}

export function bindPush() {
  const button = $('pushEnable');
  if (!button) return;

  button.onclick = async () => {
    button.disabled = true;

    if (button.dataset.enabled === '1') {
      await unregisterPush();
      await loadPushStatus();
      button.disabled = false;
      return;
    }

    const result = await registerPush();

    if (!result.ok) {
      msg($('pushStatus'), result.reason);
    } else {
      msg($('pushStatus'), 'Push-Benachrichtigungen sind aktiviert.', true);
    }

    await loadPushStatus();
    button.disabled = false;
  };
}

export async function sendTestPush() {
  const { data: { session } } = await supabase.auth.getSession();

  const response = await fetch(SUPABASE_URL + '/functions/v1/send-push', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + session.access_token
    },
    body: JSON.stringify({
      type: 'test',
      title: '🎾 Padel Bros',
      body: 'Push-Benachrichtigungen funktionieren!'
    })
  });

  return response.json();
}
