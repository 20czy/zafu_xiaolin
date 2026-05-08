from pathlib import Path


FASTAPI_ROOT = Path(__file__).resolve().parents[2]
ENV_FILE = FASTAPI_ROOT / ".env"


def load_app_env() -> None:
    try:
        from dotenv import load_dotenv

        load_dotenv(ENV_FILE, override=True)
        return
    except ModuleNotFoundError:
        pass

    if not ENV_FILE.exists():
        return

    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key:
            import os

            os.environ[key] = value
