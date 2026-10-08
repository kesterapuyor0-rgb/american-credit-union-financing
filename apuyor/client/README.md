# Apuyor Engine client

Vite, React, TypeScript, and Tailwind client for the Apuyor Engine API.

## Run locally

```sh
cp .env.example .env
npm install
npm run dev
```

The client expects the API at `VITE_API_URL` (defaults to `http://localhost:4000`). Authentication is handled by `/api/auth`; moderation screens call the protected `/api/admin` endpoints. The video call uses authenticated Socket.IO signaling and browser WebRTC. The likeness modal lists the signed-in user's active verified consent records and allows a reference photo/video upload. New profiles must be approved before the transform controls can use them.

AI stream adapters are injected into `VideoCall` so worker credentials stay server-side; until a trusted gateway supplies those adapters, transform actions safely fall back to the camera/microphone stream.
