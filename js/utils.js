export const $ = id => document.getElementById(id);

export const escapeHtml = s =>
  String(s ?? '').replace(
    /[&<>"']/g,
    c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c])
  );

export function msg(el, text, ok = false) {
  el.className = 'status ' + (ok ? 'ok' : 'err');
  el.textContent = text;
}

export function label(v) {
  return {
    '18:30': '18:30 Uhr · Court 5',
    '19:00': '19:00 Uhr · Court 1',
    'egal': 'Egal wann',
    'nein': 'Kann nicht'
  }[v] || v;
}

export function nextTuesday() {
  const d = new Date();
  const day = d.getDay();
  let add = (2 - day + 7) % 7;

  if (add === 0 && d.getHours() >= 17) add = 7;

  const x = new Date(d);
  x.setDate(d.getDate() + add);
  return x.toISOString().slice(0, 10);
}

export function niceDate(s) {
  const [y, m, d] = s.split('-').map(Number);

  return new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  }).format(new Date(y, m - 1, d));
}

export function isPollClosed(matchDay) {
  if (!matchDay) return false;
  if (matchDay.poll_closed) return true;

  const [y, m, d] = matchDay.match_date.split('-').map(Number);

  return new Date() >= new Date(y, m - 1, d, 17, 0, 0);
}
