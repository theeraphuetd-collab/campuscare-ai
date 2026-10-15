# Deploy AI server

## Local verification

```powershell
npm.cmd ci
npm.cmd run lint
npm.cmd run build
npm.cmd run start -- --hostname 127.0.0.1 --port 3001
# In a second terminal:
node --env-file=.env.local scripts/smoke.mjs
```

Smoke test sends synthetic text and may use provider credits. A successful build does not verify model or voice access. Frontend can run separately on port 3000.

## Vercel

1. Put THIS directory in a private GitHub repository, excluding `.env.local`, `.next`, `node_modules` and logs. `.gitignore` already excludes these. Do not upload the parent Hackathon directory.
2. In Vercel, import that repository. Framework: Next.js. Root Directory must contain this package.json.
3. Add environment variables from the local `.env.local`: `GEMINI_API_KEY`, `GEMINI_MODEL`, `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`, `AI_SERVER_API_KEY`. The last key must match the backend shared secret. Enter secret values in Vercel only; never in source or chat.
4. Deploy, then set `$env:AI_TEST_URL='https://YOUR-REAL-DEPLOYMENT'` and run `node scripts/smoke.mjs` locally. Use a URL reachable from Supabase, not a login-protected preview.
5. Set `AI_SERVER_URL` in campuscare-backend/.env to that HTTPS BASE URL (without `/api/analyze`), then run the backend `deno task ai:test`.
6. Deploy Supabase Edge Function separately; deploying this Next.js project does not deploy Supabase migrations or functions.

No deployment was performed automatically: this workspace has no connected GitHub/Vercel account or repository configured. Gemini analysis must pass the provider smoke test before presenting the system as fully working. Model listing alone does not prove content-generation access.

Both AI endpoints now require `Authorization: Bearer AI_SERVER_API_KEY`. Frontend calls CampusCare Backend, not these endpoints directly. Without configured secret the AI server returns 503; missing/wrong auth returns 401. Never put this shared secret in NEXT_PUBLIC variables.
