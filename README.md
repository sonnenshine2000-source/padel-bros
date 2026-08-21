# Padel Bros – modulare Version

Die App ist jetzt in einzelne Bereiche aufgeteilt:

- `index.html` – Seitenstruktur
- `css/style.css` – Design
- `js/config.js` – Supabase-Konfiguration
- `js/state.js` – gemeinsamer App-Zustand
- `js/supabase.js` – Supabase-Verbindung
- `js/auth.js` – Login, PIN, Abmelden
- `js/poll.js` – Umfrage und Namen
- `js/schedule.js` – Spielplan
- `js/matches.js` – Matches
- `js/payments.js` – Ersatzspieler/Zahlungen
- `js/admin.js` – Spielerverwaltung
- `js/app.js` – Start und Zusammenspiel der Module

## GitHub

Alle Dateien in derselben Struktur ins Repository kopieren/hochladen.

Danach sollte Vercel automatisch deployen.

## Künftige Änderungen

Nur den betroffenen Bereich ändern:
- Login/PIN → `js/auth.js`
- Umfrage → `js/poll.js`
- Spielplan → `js/schedule.js`
- Admin → `js/admin.js`
- Design → `css/style.css`
