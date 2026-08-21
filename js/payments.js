import { supabase } from './supabase.js';
import { state } from './state.js';
import { $, escapeHtml } from './utils.js';

export async function loadPayments() {
  const q = await supabase
    .from('payments')
    .select(
      'amount,paid,substitute_id,stammspieler_id,' +
      'players_sub:substitute_id(name),' +
      'players_main:stammspieler_id(name,paypal_email)'
    )
    .eq('match_day_id', state.matchDay.id);

  if (q.error || !q.data?.length) {
    $('payments').innerHTML =
      '<div class="sub">Keine offenen Zahlungen.</div>';
    return;
  }

  $('payments').innerHTML =
    '<div class="list">' +
    q.data.map(p => `
      <div class="item pay">
        <div>
          <b>${escapeHtml(p.players_sub?.name || 'Ersatzspieler')}</b>
          →
          ${escapeHtml(p.players_main?.name || 'Stammspieler')}
          <br>
          <small>
            ${Number(p.amount).toFixed(2)} €
            · PayPal:
            ${escapeHtml(p.players_main?.paypal_email || '—')}
          </small>
        </div>
        <span class="${p.paid ? 'paid' : 'open'}">
          ${p.paid ? '✓ Bezahlt' : 'Offen'}
        </span>
      </div>
    `).join('') +
    '</div>';
}
