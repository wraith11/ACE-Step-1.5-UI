# ACE-Step Music

A fully-local AI music generation studio for your own hardware — headless Apple
Silicon Macs (M3 and up) and Linux. It pairs the ACE-Step 1.5 diffusion model
with a clean, web-based interface that runs in your browser and is reachable
from any device on your local network.

No cloud APIs. No API keys. Everything — model, language model, and UI — runs
on your machine.

---

## What this is

This repository is a self-contained, end-user-oriented project built on top of
two excellent open-source components:

| Layer | Source | License |
|-------|--------|---------|
| **AI engine** | [ACE-Step 1.5](https://github.com/ace-step/ACE-Step-1.5) | MIT |
| **Web UI base** | [Saganaki22 / ACE-Step-1.5-UI_AIO](https://github.com/Saganaki22/ACE-Step-1.5-UI_AIO) | MIT |

The ACE-Step backend is kept as an upstream-tracking sub-tree so you can keep
pulling improvements from the original model project. The web interface was
adapted from Saganaki22's UI and reworked into an end-user-friendly,
fully-local experience (the Gemini integration was replaced with ACE-Step's own
local language model).

---

## Quick Start (macOS Apple Silicon / Linux)

Requirements: **Node 18+** and the ACE-Step Python environment (see the
[ACE-Step docs](https://github.com/ace-step/ACE-Step-1.5) for installing models).

```bash
# 1. Install UI dependencies (once)
./setup.sh

# 2. Start everything (ACE-Step API with MLX + UI backend + frontend)
./start.sh
```

Open **http://localhost:3000** — or from another device on your network:
**http://YOUR_MACHINE_IP:3000**.

> **Port 3000 taken?** Open WebUI and other tools often use it. Run the UI on a
> different port instead:
> ```bash
> UI_PORT=3005 ./start.sh      # then open http://localhost:3005
> ```

On first use you'll pick a username (stored locally). Then just describe a song
and hit **Create**.

### Stop everything

```bash
./stop.sh
```

---

## Architecture

```
Browser (LAN)
   │  http://<machine-ip>:3000
   ▼
Vite dev server (port 3000)        React + TypeScript (webui/)
   │  /api, /audio proxied
   ▼
Express backend (port 3001)        SQLite, auth, jobs, audio storage (webui/server/)
   │  /release_task, /query_result, /v1/audio,
   │  /v1/create_sample, /format_input, /create_random_sample
   ▼
ACE-Step REST API (port 8001)      Python/FastAPI (acestep/)
   │
   ▼
Local models (DiT + 5Hz LM)        GPU + Neural Engine (MLX on M-series)
```

- **Frontend** never talks to the ACE-Step API directly. It uses simple relative
  URLs against the Express backend, which keeps auth, audio storage, and the
  database in one place.
- **Local AI** — the "AI" helpers (song suggestion, enhance, random example)
  call ACE-Step's own language model through the API, so nothing leaves your
  machine.

---

## Usage

### End-user flow
The default view is intentionally clean:
- **Optional "Describe your song"** — type a description, click **Generate
  suggestion**, and the caption, lyrics, and metadata are auto-filled by the
  local AI. A dice button loads a random example.
- **Caption / Style** and **Lyrics** fields (with ✨ enhance buttons) — always
  visible.
- **Optional Parameters** — BPM, key, time signature, duration, and variations,
  all defaulting to **Auto**.
- **Create** button.

### Expert flow
Expand **Advanced Settings** to reach the full parameter surface of the
original ACE-Step UI:
- **Diffusion**: inference steps, guidance scale, method (ODE/SDE), sampler,
  velocity controls, shift, custom timesteps, CFG interval, ADG, seed.
- **DCW**: differential-wavelet correction.
- **Language Model**: temperature, CFG, top-k/p, negative prompt, CoT toggles,
  batch chunking.
- **Output**: audio format (MP3/FLAC/Opus/AAC/WAV), MP3 bitrate, normalization,
  fades, latent shift/rescale.
- **Repaint / Cover**: repaint range & mode, cover strength, no-FSQ.
- **Track / Codes**: track selection, complete-track classes, LM audio codes.

The mode selector (Custom / Remix / Cover / Repaint) switches the generation
task type and reveals the relevant source-audio controls.

---

## Performance on Apple Silicon

The largest single performance win is wired in by default: the language-model
backend runs through **MLX** (`ACESTEP_LM_BACKEND=mlx`), using the GPU and
Neural Engine directly instead of only PyTorch's MPS path. Defaults are tuned
for the M-series (`acestep-v15-turbo` DiT + MLX LM). The API server handles
reference-audio, cover, and repaint workloads; the UI just streams results.

---

## Project layout

```
├── acestep/            # ACE-Step backend (upstream-tracking, keep for merges)
├── webui/              # Our web interface (React + Express)
│   ├── src/            #   frontend (App, components, services)
│   └── server/         #   backend (Express, SQLite, routes)
├── start.sh            # launch everything
├── stop.sh             # stop everything
├── setup.sh            # install UI dependencies once
├── pyproject.toml      # ACE-Step Python deps (upstream)
└── ...                 # remaining upstream ACE-Step files
```

---

## Updating the ACE-Step backend

Because the backend is tracked as an upstream sub-tree, you can pull new commits
from the original model project:

```bash
git remote add upstream https://github.com/ace-step/ACE-Step-1.5.git
git fetch upstream
git merge upstream/main
```

---

## Credits & License

- **AI engine:** [ACE-Step 1.5](https://github.com/ace-step/ACE-Step-1.5) (MIT)
- **Web UI base:** [Saganaki22 / ACE-Step-1.5-UI_AIO](https://github.com/Saganaki22/ACE-Step-1.5-UI_AIO)
  which in turn builds on [fspecii / ace-step-ui](https://github.com/fspecii/ace-step-ui)
- **Audio editor:** [AudioMass](https://github.com/pkalogiros/AudioMass)

This project is MIT licensed.

---

*This project was created and adapted with the assistance of AI (Claude) as a
development aid. The resulting code is MIT licensed and provided as-is.*