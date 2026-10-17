# SafeStep backend

FastAPI service that texts a user's emergency contacts when the app detects a
fall or the user asks for help. Texts go out through Twilio, so nobody has to
tap Send.

## Run it locally

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # fill in SAFESTEP_API_KEY (and Twilio, when ready)
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Without Twilio credentials the server runs in **test mode**: alerts are written
to the log instead of being texted. `GET /health` shows which mode it's in.

Then point the app at it: copy `../.env.example` to `../.env.local`, set
`EXPO_PUBLIC_SAFESTEP_API_URL` to `http://<your computer's local IP>:8000`
and `EXPO_PUBLIC_SAFESTEP_API_KEY` to the same key, and restart `npx expo start`.

## Turn on real texting (Twilio)

1. Create an account at https://console.twilio.com and buy a phone number that
   can send SMS.
2. Put the Account SID, Auth Token and that number in `backend/.env`.
3. On a Twilio trial account, texts only reach numbers you've verified in the
   console, and start with a trial notice.

## API

`POST /v1/alerts` with header `X-API-Key`:

```json
{
  "reason": "fall",
  "user_name": "Victoria",
  "contacts": [{ "name": "Mom", "phone": "+15195551234" }],
  "location": { "latitude": 43.4723, "longitude": -80.5449 }
}
```

`reason` is `"fall"` or `"manual"`. Phones must be in international format.
Returns `sent_count` and a result per contact. Errors: `401` bad key, `422`
invalid request, `429` too many alerts (default 5 per 10 minutes), `502` no
message could be sent.

## Tests

```bash
pytest
```

## Before a public release

The API key is built into the app, so it only stops casual abuse. Replace it
with Clerk session tokens verified on the server, and store contacts per user
in the database instead of sending them with each request.
