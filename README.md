# Colorado Golf — group checklist

React + Vite map/list app for tracking Colorado golf courses. **~20 players** share progress via a small API (SQLite).

## Run locally (two terminals)

**Terminal 1 — API (shared data)**

```bash
cd ColoradoGolf
npm run api:install
npm run api
```

(If `pip` is not on PATH, use `python -m pip install -r server/requirements.txt` instead of `npm run api:install`.)

**Terminal 2 — web app**

```bash
npm install
npm run dev
```

Open the Vite URL (e.g. `http://localhost:5173`). **Create an account** (email + password) or log in. Up to **20 accounts**; everyone sees each other's played courses and custom additions.

## Accounts

- **No public sign-up** — only tour admins can create accounts
- Players log in with the email and password an admin gives them
- Cap: `COLORADOGOLF_MAX_USERS` (default 20 **approved** accounts)

### Admins

Set bootstrap admin emails before starting the API (comma-separated). The first account with that email can be created as admin (e.g. via DB seed) or use **Add player** with the admin checkbox:

```powershell
$env:COLORADOGOLF_ADMIN_EMAILS = "organizer@example.com,mike@example.com"
npm run api
```

On the **Tour** tab, admins use **Add player** to create accounts (name, username, email, password).

### Forgot password (email)

Players can use **Forgot password?** on the login screen. The API emails a temporary password and requires a new password on next login.

Configure SMTP on the API host (PowerShell example):

```powershell
$env:COLORADOGOLF_SMTP_HOST = "smtp.gmail.com"
$env:COLORADOGOLF_SMTP_PORT = "587"
$env:COLORADOGOLF_SMTP_USER = "your@gmail.com"
$env:COLORADOGOLF_SMTP_PASSWORD = "your-app-password"
$env:COLORADOGOLF_SMTP_FROM = "your@gmail.com"
npm run api
```

For **local dev without SMTP**, log the temporary password to the API console instead:

```powershell
$env:COLORADOGOLF_EMAIL_DEV_LOG = "1"
npm run api
```

## Production / LAN

1. Run API on a host reachable by all 20 users: `uvicorn server.main:app --host 0.0.0.0 --port 8765`
2. Build the frontend with API URL: `VITE_API_BASE=http://your-server:8765 npm run build`
3. Serve `dist/` (static) and proxy `/api` to the Python service, or set `VITE_API_BASE` to the full API origin.

Optional shared secret (set on server and in frontend build):

```bash
set COLORADOGOLF_API_KEY=your-secret
set VITE_API_KEY=your-secret
```

## Data

| Store | Contents |
|--------|-----------|
| `src/data/courses.gpx` | Master course list (OSM) |
| `server/data/coloradogolf.db` | Per-user played state, field overrides, shared custom courses |

GPX is still bundled with the app; per-user progress lives in the database.
