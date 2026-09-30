# Apuyor Engine AI Worker

An isolated FastAPI service for trusted backend jobs that transform frames, videos, or voice. The API accepts opaque object identifiers rather than arbitrary URLs or uploaded paths. The main Apuyor API should authenticate users, verify consent and likeness status, and authorize each job before calling this private service.

## Run locally

```sh
python -m venv .venv
# Activate the virtual environment, then:
pip install -r requirements.txt
```

Set `AI_WORKER_API_KEY` to a long random secret and optionally set `INFERENCE_TIMEOUT_SECONDS`. Run with `uvicorn app.main:app --host 0.0.0.0 --port 8000`. `/health` is public for platform health checks; job endpoints require `Authorization: Bearer <AI_WORKER_API_KEY>`.

## Inference integration

The service intentionally ships with an unavailable adapter rather than pretending to transform media. Connect vetted frame, video, and voice models in `app/inference.py`. A model exception or timeout returns a structured `fallback_code` and `manual_review` action; the process stays available. The worker always reports `safety_label_applied: true` in successful job responses. Use a trusted storage adapter and consent authorization before loading any media.
