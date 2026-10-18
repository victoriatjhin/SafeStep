# SafeStep vision server

Python server that looks at camera frames from the app with YOLO and returns
spoken guidance: where a named object is, and what's in the way.

## Run it

```bash
cd vision
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8001
```

The first start downloads the YOLO model (about 5 MB).

Then in the main `SafeStep` folder, create `.env.local`:

```
EXPO_PUBLIC_VISION_API_URL=http://YOUR_COMPUTER_IP:8001
```

and restart `npx expo start`. Your phone must be on the same Wi-Fi.

## What it does

`POST /v1/detect` (multipart form): `image` (JPEG), `mode`, and `target`.

| mode | what you get back in `speech` |
|---|---|
| `find` | "Your phone is slightly to your right, a few steps away." |
| `obstacles` | "Stop. A person is right in front of you." (empty when the path is clear) |
| `scene` | "I see 2 people, a chair and a cup." |

In `find` mode, an obstacle that is very close is announced first.

## Finding things YOLO doesn't know

The default model knows 80 everyday objects (cup, bottle, phone, chair,
laptop, backpack, person...) but not keys, wallets or glasses. To find
anything by name, use the open-vocabulary model. Add to `vision/.env`:

```
VISION_MODEL=yolov8s-worldv2.pt
```

and install its extra package:

```bash
pip install "git+https://github.com/ultralytics/CLIP.git"
```

## Tests

```bash
pytest
```
