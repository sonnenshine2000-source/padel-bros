import { supabase } from './supabase.js';
import { state } from './state.js';
import { $ } from './utils.js';

export async function loadMatches() {
  const q = await supabase
    .from('matches')
    .select('*')
    .eq('match_day_id', state.matchDay.id)
    .order('court');

  if (q.error) {
    $('matches').innerHTML =
      '<div class="sub">Matches konnten nicht geladen werden.</div>';
    return;
  }

  if (!q.data?.length) {
    $('matches').innerHTML =
      '<div class="sub">Noch keine Matches angelegt.</div>';
    return;
  }

  $('matches').innerHTML =
    '<div class="list">' +
    q.data.map(m => `
      <div class="item">
        <b>${m.court === 'court5' ? 'Court 5 · 18:30' : 'Court 1 · 19:00'}</b>
        <br>
        <span class="sub">
          Ergebnis: ${m.winner ? 'Team ' + m.winner : 'offen'}
        </span>
      </div>
    `).join('') +
    '</div>';
}
