# potatogamer.uk

Personal site for ThePotatoGamer. The homepage is a Material You bento grid with live Discord presence from Lanyard. Site copy, links, friends, and the guestbook are stored in Upstash Redis through Vercel Functions.

## Scripts

```bash
npm install
npm run dev
npm run build
```

`npm run dev` serves the SPA and `/api/config`, `/api/guestbook`, `/api/discord`, and `/api/media` at http://localhost:5173.

## Environment

Copy `.env.example` to `.env.local`.

- `ADMIN_PASSWORD` unlocks `/admin`, saving config, and deleting guestbook entries.
- `DISCORD_BOT_TOKEN` is a server-only bot token. It loads avatars, and when Lanyard has no presence it reads status from a server the bot has joined. Enable the bot's Presence Intent in the Discord developer portal. Add the token on Vercel as a Secret. Do not prefix it with `VITE_`.
- `DISCORD_GUILD_ID` is optional. Set it when the bot is in more than one server and statuses should come from one of them.
- `TMDB_API_KEY` is a server-only TMDB key. The admin page uses it to search, then saves the chosen poster with the site config. The homepage does not call TMDB. Add it on Vercel as a Secret. Do not prefix it with `VITE_`.
- `KV_REST_API_URL` and `KV_REST_API_TOKEN`, or `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.

If Redis isn’t configured, the API keeps config and guestbook entries in process memory so local development still runs. Set the variables on Vercel before relying on them in production.

## Routes

- `/` homepage
- `/admin` owner dashboard
- `/api/config`
- `/api/guestbook`
- `/api/discord`
- `/api/media`

Vercel rewrites non-file, non-API paths to `index.html` so `/admin` stays extensionless.
