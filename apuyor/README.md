# Apuyor Engine backend

Standalone TypeScript, Express, MongoDB, and Socket.IO backend project.

## Start

Copy `.env.example` to `.env`, set `MONGODB_URI` and `CLIENT_ORIGINS`, then run:

```sh
npm install
npm run dev
```

For production, run `npm run build` and then `npm start`. The server exposes `GET /health` and Socket.IO signaling events `signal:join`, `signal:offer`, `signal:answer`, and `signal:ice`.

Likeness uploads are private files under `LIKELINESS_UPLOAD_DIR` (default `private_uploads`) and require the signed-in user to have an active, verified consent record. Store this directory on a durable private volume in deployment. New profiles remain pending until admin approval.

The live Face & Video and Voice studios upload target images and 5–15 second WAV/MP3 voice samples through the authenticated API. Media remains private, profiles require admin approval, and owners can preview only their own uploads. Configure `AI_WORKER_URL` and the same `AI_WORKER_API_KEY` on the API and worker to request embeddings. The worker's face and speaker embedding adapter methods in `ai-worker/app/inference.py` must be backed by vetted models; without one, uploads are retained with an explicit unavailable embedding status and live conversion stays disabled.

For local testing, when `NODE_ENV=development`, the authenticated `GET /api/likeness/consents` request creates a synthetic, 24-hour verified consent record for the current account if it has no active verified record. This removes the separate seed step; it still requires the configured MongoDB database to be reachable. Uploaded likeness profiles remain pending until admin approval.

The React client is in `client/`; run it separately with `cd client`, `npm install`, and `npm run dev`. Set `CLIENT_ORIGINS` to the exact frontend origins and set the client's `VITE_API_URL` to this API origin.
