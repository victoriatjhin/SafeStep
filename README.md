# SafeStep

SafeStep is a voice-first mobile app that helps blind and low-vision people get
around more independently: finding everyday objects, hearing spoken directions,
being warned about obstacles, and alerting a caretaker when something goes
wrong.

This fork holds my contributions to the Hack the Valley 11 team project
([therealsid19/SafeStep](https://github.com/therealsid19/SafeStep)).

## My work

I built SafeStep's emergency texting and its AI vision service. Both are
backend services the app calls, each with its own test suite.

**Highlights**

- Built two backend services in two languages: a TypeScript (Hono) SMS server
  and a Python (FastAPI) computer vision server
- Used YOLO object detection to give spoken guidance with direction and
  distance, so a blind user can find things and avoid obstacles
- Built the SMS path to keep working when parts fail: Twilio sends the text
  automatically, and if the server can't be reached the phone's Messages app
  opens with the alert pre-filled
- Added production basics to the SMS server: API key auth, rate limiting,
  input validation and a test mode
- Wrote 10 Vitest tests for the SMS server and 14 pytest tests for the vision
  server

| Feature | Branch | What it does |
|---|---|---|
| SMS alerts | [`sms-alerts`](../../tree/sms-alerts) | Texts the caretaker the patient's name and a map link to their location when they fall or ask for help |
| AI vision | [`ai-vision`](../../tree/ai-vision) | Uses YOLO to find objects, warn about obstacles and describe the scene, all spoken aloud |

### SMS alerts

- A TypeScript server (`backend/`) sends the alert through Twilio, so nobody
  has to tap Send.
- The app calls `sendEmergencyAlert(contacts, "fall" | "manual", userName)`.
- If the server can't send (for example on a Twilio free trial), the phone's
  Messages app opens with the alert ready as a backup.
- Runs on Node or Bun. Includes an API key, a rate limit and a test mode that
  logs alerts instead of sending them.

Example text:

> SafeStep alert: Jeffrey may have fallen and did not respond. Please check on
> them now.
> Location: https://maps.google.com/?q=43.472300,-80.544900

### AI vision

A Python (FastAPI) server in `vision/` runs YOLO on photos from the phone's
camera and returns a sentence for the app to speak with Expo Speech.

| Mode | Example of what the user hears |
|---|---|
| Find an object | "Your phone is slightly to your right, a few steps away." |
| Obstacles | "Stop. A person is right in front of you." |
| What's around? | "I see 2 people, a chair and a cup." |

Each answer includes the direction (left, ahead, right) and a rough distance
(within reach, a few steps away, far away).

## Running it

### SMS server

```bash
git checkout sms-alerts
cd backend
npm install
cp .env.example .env
npm run dev
```

Fill in `backend/.env` with `SAFESTEP_API_KEY` and your Twilio Account SID,
Auth Token and phone number. Without Twilio details it runs in test mode.

### Vision server

```bash
git checkout ai-vision
cd vision
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

### The app

In the main folder, create `.env.local`:

```
EXPO_PUBLIC_SAFESTEP_API_URL=http://YOUR_COMPUTER_IP:8000
EXPO_PUBLIC_VISION_API_URL=http://YOUR_COMPUTER_IP:8001
EXPO_PUBLIC_SAFESTEP_API_KEY=your-api-key
```

Then:

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go. The phone must be on the same Wi-Fi as the
computer running the servers.

## Tests

```bash
cd backend && npm test
cd vision && pytest
```

## Tech stack

- **App:** React Native, Expo, TypeScript
- **SMS server:** TypeScript, Hono, Twilio
- **Vision server:** Python, FastAPI, YOLO (Ultralytics), OpenCV
- **Voice:** Expo Speech
