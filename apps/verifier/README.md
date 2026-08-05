# NimiqEarn Quest — AI verifier (M3)

Modular layout:

```
apps/verifier/
  main.py              # uvicorn entry (`app = create_app()`)
  app/
    __init__.py        # create_app()
    auth.py / config.py / models.py / router.py
    text_signals.py    # spam + keyword overlap
    image_ops.py       # decode / phash / OCR
    checks/            # screenshot, text, link, transaction + dispatch
  tests/               # pytest
```

## Local

Requires **Python 3.11–3.13** (3.14 may fail building `pydantic-core`).

```bash
cd apps/verifier
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
# optional OCR: brew install tesseract
VERIFIER_SHARED_SECRET=dev uvicorn main:app --reload --port 8090
pytest
```

## Docker

```bash
docker build -t nimiqearn-verifier .
docker run --rm -p 8090:8090 -e VERIFIER_SHARED_SECRET=dev nimiqearn-verifier
```
