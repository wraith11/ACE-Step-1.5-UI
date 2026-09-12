# ACE-Step Music — Web UI

This folder contains the web interface for **ACE-Step Music**. It is a React
(TypeScript + Vite) frontend paired with an Express + SQLite backend.

> **Start the whole app from the repo root:** `./setup.sh` then `./start.sh`
> (or `UI_PORT=3005 ./start.sh` for a different frontend port). See the main
> [README](../README.md).

## Layout

```
webui/
├── App.tsx            # main app shell (create + library, player)
├── components/        # React UI components
├── context/           # auth + responsive contexts
├── services/          # API client + local-AI service
├── index.html         # Vite entry
├── package.json       # frontend deps / scripts
└── server/            # Express + SQLite backend
    ├── package.json
    └── src/
        ├── routes/    # auth, songs, playlists, generate, reference-tracks
        ├── services/  # ACE-Step API adapter + local storage
        └── db/        # node:sqlite layer + migrations
```

## Local AI

All "AI" helpers (generate suggestion, enhance, random example) are backed by
the ACE-Step REST API's own language model (`/v1/create_sample`,
`/format_input`, `/create_random_sample`). No external API keys, no cloud.

## Ports

| Service | Port | Override |
|---------|------|----------|
| Frontend (Vite) | 3000 | `UI_PORT` |
| UI backend (Express) | 3001 | `PORT` |
| ACE-Step API | 8001 | `ACESTEP_API_URL` |

## Note

This is an adapted, reduced-scope port of
[Saganaki22/ACE-Step-1.5-UI_AIO](https://github.com/Saganaki22/ACE-Step-1.5-UI_AIO)
(itself based on [fspecii/ace-step-ui](https://github.com/fspecii/ace-step-ui)),
reworked for fully-local operation on the ACE-Step backend.