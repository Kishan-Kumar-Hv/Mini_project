# MedCareGuardianApp

Medicare guardian-patient medication reminder platform.

## Features
- Guardian and patient authentication
- Medication scheduling and adherence tracking
- Reminder escalation workflow (SMS/call integration ready)
- Karnataka medical directory and health news

## Local Run
- Backend defaults to `127.0.0.1:8787`
- Frontend dev server defaults to `127.0.0.1`

Start the backend:

```bash
npm run server
```

The server command automatically rebuilds `better-sqlite3` for the active Node.js version before startup, which avoids the common native module mismatch error after switching Node versions.
Demo seed data is off by default. Set `SEED_DEMO_DATA=true` in `.env` only if you want the sample guardian and patient accounts back.

Start the frontend:

```bash
npm run dev
```

Then open the local URL printed by Vite. If port `5173` is already in use, Vite will automatically use the next available localhost port.

## Run
- `npm run build`
- `npm run start`

## Twilio
- `TWILIO_MESSAGING_SERVICE_SID` can power reminder SMS without a fixed sender number.
- `TWILIO_PHONE_NUMBER` is still required for voice escalation calls.
