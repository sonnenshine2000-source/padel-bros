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

## Web-Push

Die Datenbanktabelle `push_subscriptions` ist angelegt. Jeder Spieler aktiviert Push einmal auf seinem Gerät über **🔕 Push aktivieren**.

Für das eigentliche Senden braucht die Supabase-Edge-Function `send-push` noch die VAPID-Schlüssel als Secrets:
- `VAPID_PUBLIC_KEY` = der öffentliche Schlüssel aus `js/config.js`
- `VAPID_PRIVATE_KEY` = `lEEIsZ0OFZXamPrYdjmOyGYiTafHa6snUQ1BUvT7Hf4`
- `VAPID_SUBJECT` = eine Kontakt-Mailadresse, z.B. `mailto:admin@padel-bros.de`

Der private Schlüssel darf **nicht** in GitHub oder Frontend-Code stehen.
