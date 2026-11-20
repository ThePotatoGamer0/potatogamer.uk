# Personal site

A homepage you can run for more than one domain on the same server. Each domain has its own name, Discord presence, links, and guestbook. A new domain opens a setup page before the site is shown.

## Add a domain to this server

Point the domain at this project, then open it in a browser.

1. The first visit opens `/setup`.
2. Choose a password, add a Discord user ID if you want live presence, then enter a display name and site name.
3. Open `/admin` later with that password to change the quote, card titles, links, friends, media, and the password.

The first person to finish setup owns that domain. The home domain is the exception: it keeps the site that was already saved, and its first login is the starting password below.

`DISCORD_BOT_TOKEN` belongs to the server, not to a domain. Leave it alone unless you are running a separate copy.

## Run your own copy

```bash
npm install
npm run dev
npm run build
```

`npm run dev` serves the site and the API at http://localhost:5173. Copy `.env.example` to `.env.local` first.

- `PRIMARY_HOST` is the home domain, such as `potatogamer.uk` on this server. The starting password works only for that host, and the saved site is attached to it. Set this before the home domain is opened.
- `ADMIN_PASSWORD` is the starting password for the home domain. After that domain saves a new password in settings, this one no longer unlocks it.
- `KV_REST_API_URL` and `KV_REST_API_TOKEN`, or `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`, keep each domain’s settings. Without them, saves last only until the process restarts.
- `DISCORD_BOT_TOKEN` is optional. It loads avatars, and reads a status when live presence has nothing, for people who share a server with the bot. Enable the bot’s Presence Intent. Do not prefix it with `VITE_`.
- `DISCORD_GUILD_ID` is optional. Set it when the bot is in more than one server and statuses should come from one of them.
- `TMDB_API_KEY` and `STEAMGRIDDB_API_KEY` are optional search keys for the settings page. The homepage uses the artwork saved with the site.

Set the password, home domain, and Redis values on the host before relying on them. Store secrets as secrets, not as values that ship to the browser.

## Routes

- `/` homepage
- `/setup` first-visit setup for a domain that has no saved site, and the PC card after that
- `/admin` settings
- `/api/config`
- `/api/setup`
- `/api/password`
- `/api/guestbook`
- `/api/discord`
- `/api/media`
