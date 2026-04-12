import os
from pathlib import Path

from dotenv import load_dotenv
from langsmith import Client


def main() -> None:
    env_path = Path(__file__).resolve().parent / ".env"
    # Ensure values in .env are loaded even if shell vars exist.
    load_dotenv(dotenv_path=env_path, override=True)
    required = ["LANGSMITH_API_KEY", "LANGSMITH_TRACING", "LANGSMITH_PROJECT"]
    missing = [key for key in required if not (os.getenv(key) or "").strip()]
    if missing:
        print(f"Loaded env file: {env_path}")
        print(f"Missing required env vars: {', '.join(missing)}")
        return

    client = Client()
    # This call verifies API key/auth without exposing secrets.
    _ = client.info
    print("LangSmith is configured and reachable.")
    print(f"Project: {os.getenv('LANGSMITH_PROJECT')}")


if __name__ == "__main__":
    main()
