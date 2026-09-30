# Apuyor Engine backend

Standalone TypeScript, Express, MongoDB, and Socket.IO backend project.

## Start

Copy `.env.example` to `.env`, set `MONGODB_URI` and `CLIENT_ORIGINS`, then run:

```sh
npm install
npm run dev
```

For production, run `npm run build` and then `npm start`. The server exposes `GET /health` and Socket.IO signaling events `signal:join`, `signal:offer`, `signal:answer`, and `signal:ice`.
