#!/usr/bin/env python3
"""Interactive CLI for the TerpDining Assistant.

Usage:
    python run_agent.py                  # default gpt-4o-mini
    python run_agent.py --model gpt-4o   # use a different model

Type your question and press Enter.  Type 'quit' or 'exit' to stop.
"""

from __future__ import annotations

import argparse
import os

from dotenv import load_dotenv


def main() -> None:
    load_dotenv(override=True)

    parser = argparse.ArgumentParser(description="TerpDining Assistant")
    parser.add_argument("--model", type=str, default="gpt-4o-mini", help="OpenAI model name")
    args = parser.parse_args()

    if not os.getenv("OPENAI_API_KEY"):
        print("Error: OPENAI_API_KEY not set. Add it to .env or export it.")
        return

    from src.agent.graph import build_agent

    agent = build_agent(model_name=args.model)

    print("TerpDining Assistant  (type 'quit' to exit)")
    print("=" * 50)

    messages: list = []

    while True:
        try:
            user_input = input("\nYou: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nGoodbye!")
            break

        if not user_input:
            continue
        if user_input.lower() in ("quit", "exit", "q"):
            print("Goodbye!")
            break

        messages.append({"role": "user", "content": user_input})

        result = agent.invoke({"messages": messages})

        messages = result["messages"]

        ai_message = messages[-1]
        content = ai_message.content if hasattr(ai_message, "content") else str(ai_message)
        print(f"\nAssistant: {content}")


if __name__ == "__main__":
    main()
