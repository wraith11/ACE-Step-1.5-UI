"""Model lifecycle management for the ACE-Step API server.

Adds two safeguards on top of the existing lazy-loading behaviour:

1. **RAM check before load** — refuse to load models if there is not enough
   free system memory, so the process does not OOM the host (and, on macOS,
   does not starve the OrbStack/Docker VM).

2. **Auto-unload after inactivity** — when no generation job has run for a
   configurable timeout, the loaded DiT / VAE / LM references are released and
   caches are flushed, returning memory to the OS.

Everything is controlled by environment variables:

    ACESTEP_MODEL_MIN_FREE_RAM_GB   minimum free RAM required to load (default 8)
    ACESTEP_MODEL_IDLE_TIMEOUT_MIN  minutes of inactivity before unload (default 20,
                                    0 disables auto-unload)
    ACESTEP_MODEL_FORCE_UNLOAD      set to "false" to disable unloading entirely

This module only touches API-level state (app.state) and the public attributes
the handlers expose (model, vae, text_encoder, text_tokenizer, silence_latent),
so it does not depend on internal handler details.
"""

from __future__ import annotations

import asyncio
import gc
import os
import time
from typing import Any, Callable, Optional

try:
    import psutil  # type: ignore
    _HAS_PSUTIL = True
except Exception:  # pragma: no cover - optional
    _HAS_PSUTIL = False


def _env_float(name: str, default: float) -> float:
    raw = os.getenv(name, "").strip()
    try:
        return float(raw) if raw else default
    except ValueError:
        return default


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name, "").strip()
    try:
        return int(raw) if raw else default
    except ValueError:
        return default


def get_available_ram_gb() -> float:
    """Return the amount of currently free system RAM in GB (best effort)."""
    try:
        if _HAS_PSUTIL:
            return round(psutil.virtual_memory().available / (1024 ** 3), 2)
    except Exception:
        pass
    # stdlib fallback (Linux / macOS)
    try:
        import resource  # noqa: F401  (needed below)

        pages = os.sysconf("SC_AVPHYS_PAGES")
        page_size = os.sysconf("SC_PAGE_SIZE")
        if pages > 0 and page_size > 0:
            return round((pages * page_size) / (1024 ** 3), 2)
    except Exception:
        pass
    return -1.0  # unknown


def min_free_ram_gb() -> float:
    """Minimum free RAM (GB) required before loading models."""
    return _env_float("ACESTEP_MODEL_MIN_FREE_RAM_GB", 8.0)


def check_ram_before_load() -> Optional[str]:
    """Return an error message if there is not enough free RAM, else None."""
    threshold = min_free_ram_gb()
    if threshold <= 0:
        return None
    available = get_available_ram_gb()
    if available < 0:
        return None  # cannot determine — do not block on unknown
    if available < threshold:
        return (
            f"Not enough free RAM to load models: {available:.1f} GB available, "
            f"need at least {threshold:.1f} GB. Free up memory (e.g. reduce the "
            f"OrbStack/Docker VM) or lower ACESTEP_MODEL_MIN_FREE_RAM_GB."
        )
    return None


def unload_models(app_state: Any) -> None:
    """Best-effort release of loaded model references and caches.

    Sets the handler's big tensor attributes to ``None``, forces a garbage
    collection, and flushes the active accelerator memory cache (MPS / CUDA).
    Does not raise — unloading is best effort.
    """
    try:
        for attr in ("handler", "handler2", "handler3"):
            handler = getattr(app_state, attr, None)
            if handler is None:
                continue
            for field in ("model", "vae", "text_encoder", "text_tokenizer", "silence_latent"):
                try:
                    if hasattr(handler, field):
                        setattr(handler, field, None)
                except Exception:
                    pass
            try:
                handler.last_init_params = None
            except Exception:
                pass

        # LLM handler carries its own model references
        llm = getattr(app_state, "llm_handler", None)
        if llm is not None:
            for field in ("llm_model", "lm_model", "model", "llm_tokenizer"):
                try:
                    if hasattr(llm, field):
                        setattr(llm, field, None)
                except Exception:
                    pass
    except Exception as exc:  # pragma: no cover
        print(f"[ModelLifecycle] unload error: {exc}")

    gc.collect()

    # Flush accelerator caches
    try:
        import torch

        if hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
            torch.mps.empty_cache()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    except Exception:
        pass

    app_state._initialized = False
    app_state._initialized2 = False
    app_state._initialized3 = False
    app_state._llm_initialized = False
    print("[ModelLifecycle] Models unloaded (memory returned to OS).")


def should_auto_unload() -> bool:
    """Whether auto-unload is enabled (default yes, disable with FORCE_UNLOAD=false)."""
    raw = os.getenv("ACESTEP_MODEL_FORCE_UNLOAD", "").strip().lower()
    if raw in ("0", "false", "no", "off"):
        return False
    timeout = idle_timeout_minutes()
    return timeout > 0


def idle_timeout_minutes() -> int:
    """Inactivity timeout in minutes before models are unloaded (0 = disabled)."""
    return _env_int("ACESTEP_MODEL_IDLE_TIMEOUT_MIN", 20)


class ModelIdleMonitor:
    """Tracks last activity and triggers model unload after a timeout."""

    def __init__(self, app_state: Any) -> None:
        self.app_state = app_state
        self.last_activity = time.time()
        self._task: Optional[asyncio.Task] = None

    def touch(self) -> None:
        self.last_activity = time.time()

    async def run(self) -> None:
        timeout_sec = idle_timeout_minutes() * 60
        if timeout_sec <= 0:
            return
        while True:
            await asyncio.sleep(60)
            if not getattr(self.app_state, "_initialized", False) and not getattr(
                self.app_state, "_llm_initialized", False
            ):
                # Nothing loaded — keep the timestamp fresh.
                self.touch()
                continue
            elapsed = time.time() - self.last_activity
            if elapsed >= timeout_sec:
                print(
                    f"[ModelLifecycle] No activity for {elapsed / 60:.0f} min "
                    f"(limit {timeout_sec / 60:.0f} min) — unloading models."
                )
                # Run blocking unload in the executor to avoid blocking the loop.
                loop = asyncio.get_running_loop()
                await loop.run_in_executor(
                    getattr(self.app_state, "executor", None),
                    unload_models,
                    self.app_state,
                )

    def start(self, loop: asyncio.AbstractEventLoop) -> None:
        if not should_auto_unload():
            return
        if self._task is None or self._task.done():
            self._task = loop.create_task(self.run())

    def stop(self) -> None:
        if self._task is not None:
            self._task.cancel()
            self._task = None