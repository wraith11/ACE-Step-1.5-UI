# ACE-Step 1.5 Web UI

A clean, end-user-friendly web interface for [ACE-Step 1.5](https://github.com/ace-step/ACE-Step-1.5)
local music generation. Designed to run fully offline on a headless Apple Silicon
Mac (e.g. M3 Ultra) and be reachable from any device on your local network.

> **Fully local.** No cloud APIs, no API keys. The "AI assist" features (generate
> a song suggestion, enhance lyrics/caption, random example) are powered by the
> built-in ACE-Step language model running locally via the MLX backend.

![architecture](../assets/ACE-Step_framework.png)

---

## Quick Start (macOS / Apple Silicon)

From the `ace-step-ui/` folder:

```bash
# 1. Install UI dependencies (Node 18+ required)
./setup.sh

# 2. Start everything (ACE-Step API with MLX + UI backend + frontend)
./start-all-macos.sh
```

Open **http://localhost:3000** — or from another device on your network
**http://YOUR_MAC_IP:3000**.

> **Port conflict?** If another service (e.g. Open WebUI) already uses port
> 3000, run the frontend on a different port:
> ```bash
> UI_PORT=3005 ./start-all-macos.sh
> # then open http://localhost:3005
> ```

On first use you'll be asked for a username (stored locally). Then just describe
a song and hit **Create**.

### What `start-all-macos.sh` does
1. Starts the ACE-Step REST API server on port **8001** with `ACESTEP_LM_BACKEND=mlx`
   (native Apple Silicon acceleration — GPU + Neural Engine).
2. Starts the UI backend on port **3001** (Express + SQLite).
3. Starts the Vite frontend on port **3000**.

All three bind to `0.0.0.0`, so the UI is reachable across your LAN.

> If your ACE-Step environment is set up differently, point `ACESTEP_PATH` at the
> repo root: `ACESTEP_PATH=/path/to/repo ./start-all-macos.sh`.

---

## Architecture

```
Browser (LAN)
   │  http://<mac-ip>:3000
   ▼
Vite dev server (port 3000)        React + TypeScript
   │  /api, /audio proxied
   ▼
Express backend (port 3001)        SQLite, auth, jobs, audio storage
   │  /release_task, /query_result, /v1/audio,
   │  /v1/create_sample, /format_input, /create_random_sample
   ▼
ACE-Step REST API (port 8001)      Python/FastAPI, MLX backend on M-series
   ▼
Local models (DiT + 5Hz LM)        run on your GPU / Neural Engine
```

- **Frontend** — never talks to the ACE-Step API directly. It talks to the
  Express backend with simple relative URLs (LAN-friendly).
- **Backend** — proxies generation, polls job status, downloads audio into
  local storage, and exposes the local-AI endpoints.
- **Local AI** — the "AI" helpers call ACE-Step's own language model via the
  API, so everything stays on your machine.

---

## Usage

### End-user flow
The default view is intentionally clean:
- **Optional "Describe your song"** — type a description, click **Generate
  suggestion**, and the caption/lyrics/metadata are auto-filled by the local AI.
  The dice button loads a random example.
- **Caption / Style** and **Lyrics** fields (with ✨ enhance buttons) — always
  visible.
- **Optional Parameters** — BPM, key, time signature, duration, and variations,
  all defaulting to **Auto**.
- **Create** button.

### Expert flow
Expand **Advanced Settings** for the full parameter surface of the original
ACE-Step UI:
- **Diffusion**: inference steps, guidance scale, method (ODE/SDE), sampler,
  velocity controls, shift, custom timesteps, CFG interval, ADG, seed.
- **DCW**: differential-wavelet correction settings.
- **Language Model**: temperature, CFG, top-k/p, negative prompt, CoT toggles,
  batch chunking.
- **Output**: audio format (MP3/FLAC/Opus/AAC/WAV), MP3 bitrate, normalization,
  fades, latent shift/rescale.
- **Repaint / Cover**: repaint range & mode, cover strength, no-FSQ.
- **Track / Codes**: track selection, complete-track classes, LM audio codes.

The mode selector (Custom / Remix / Cover / Repaint) switches the generation
task type and reveals the relevant source-audio controls.

---

## Performance on M3 / Apple Silicon

The largest single performance win is already wired in: the language-model
backend runs through **MLX** (`ACESTEP_LM_BACKEND=mlx`), which uses the GPU and
Neural Engine directly instead of only PyTorch's MPS path. Defaults are tuned
for the M-series: `acestep-v15-turbo` DiT + MLX LM.

For reference audio / cover / repaint tasks the API server handles the heavy
lifting; the UI just streams results.

---

## Notes
- Audio and your SQLite database are stored under `server/data/` and
  `server/public/audio/` (git-ignored).
- This is a reduced-scope port of the [Saganaki22 UI](https://github.com/Saganaki22/ACE-Step-1.5-UI_AIO):
  the social layer (public feeds, profiles, followers, video generator, Demucs)
  was removed. Every generation control from the original ACE-Step UI is present.
- Gemini integration was replaced with the local ACE-Step LLM — nothing leaves
  your machine.