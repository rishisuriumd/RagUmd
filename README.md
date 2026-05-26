# 🐢 TerpDining

UMD dining hall app. Check menus, track macros, get recipe ideas, and ask questions about dining — all from one place.

## Screenshots

> Drop screenshots into `docs/screenshots/` and they'll render here.

| Menu | Tracker |
|---|---|
| ![Menu](docs/screenshots/menu.png) | ![Tracker](docs/screenshots/tracker.png) |

| Chat | Recipe Creator |
|---|---|
| ![Chat](docs/screenshots/chat.png) | ![Recipe](docs/screenshots/recipe.png) |

## What it does

- **Menu** — see what's at each dining hall by meal and station. Badges flag dietary tags (vegan, halal, allergens, etc.). Date picker lets you browse any day; out-of-semester dates show a friendly summer message.
- **Favorites** — heart any menu item to track it across days. Get an alert when a favorite is back on the menu.
- **Chat** — ask questions about menus, nutrition, hours, whatever. Remembers your conversation.
- **Recipes** — pick a dining hall and meal, it suggests recipes you can actually make from what's available right now.
- **Tracker** — log food with portion sizes that make sense (slices of pizza, scoops of ice cream — not just "servings"). Donut chart shows your macros. Daily goals persist server-side across devices.

## Stack

| | |
|---|---|
| Backend  | FastAPI, SQLite, JWT auth, bcrypt |
| Frontend | React 19, Vite, Tailwind v4, React Router |
| Agent    | LangChain + LangGraph, OpenAI |
| Scraping | BeautifulSoup, requests |
| Data     | nutrition.umd.edu |
| iOS      | SwiftUI client in `ios/` |

## Structure

```
src/
├── scraping/     # pulls menu + nutrition data from the UMD site
├── db/           # sqlite schema, seeding, migrations
├── tools/        # query helpers for menu / nutrition lookups
├── agent/        # langgraph nodes, tools, chat context
└── api/          # FastAPI routes (auth, chat, menu, recipe, tracker, favorites)

frontend/src/
├── pages/        # Chat, Menu, Recipe, Tracker, Login, Register
├── components/   # Navbar, FoodSearch, DailySummary, ErrorBoundary, etc.
└── context/      # AuthProvider, NavigationStateProvider

ios/              # SwiftUI app that talks to the same FastAPI backend
```

## Running it locally

Need Python 3.11+, Node 18+, and an OpenAI key.

```bash
# clone
git clone https://github.com/rishisuriumd/RagUmd.git
cd RagUmd

# backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# env
cp .env.example .env
# fill in OPENAI_API_KEY (LangSmith keys are optional — leave the placeholder
# and tracing will auto-disable so you don't get 403 spam in logs)

# scrape menu data (skip if you already have umd_dining.db)
python run_scraper.py

# frontend
cd frontend && npm install && cd ..

# run both (in separate terminals)
python -m uvicorn server:app --reload   # http://127.0.0.1:8000
cd frontend && npm run dev              # http://localhost:5173
```

Then open http://localhost:5173.

## Env vars

| Var | Required? | What |
|---|---|---|
| `OPENAI_API_KEY`    | yes | powers the chat + recipe agent |
| `LANGSMITH_API_KEY` | no  | optional tracing; tracing auto-disables when the value is missing or still the example placeholder |
| `LANGSMITH_PROJECT` | no  | LangSmith project name |
| `LANGSMITH_TRACING` | no  | set to `false` to force-disable tracing |

## Endpoints

| Method | Path | Auth | |
|---|---|---|---|
| POST   | `/api/auth/register`            | no  | create account |
| POST   | `/api/auth/login`               | no  | get token |
| GET    | `/api/auth/me`                  | yes | who am i |
| GET    | `/api/menu/browse?dt=`          | no  | menu for a date |
| GET    | `/api/nutrition/search?q=`      | no  | search foods |
| GET    | `/api/favorites`                | yes | list favorite food names |
| POST   | `/api/favorites`                | yes | add a favorite |
| DELETE | `/api/favorites/{name}`         | yes | remove a favorite |
| GET    | `/api/chat/sessions`            | yes | list chats |
| POST   | `/api/chat`                     | yes | send message |
| POST   | `/api/recipe`                   | yes | make recipe |
| GET    | `/api/tracker/logs?date=`       | yes | logs for a day |
| POST   | `/api/tracker/logs`             | yes | log food |
| DELETE | `/api/tracker/logs/{id}`        | yes | delete a log |
| GET    | `/api/tracker/summary?date=`    | yes | daily macros |
| GET    | `/api/tracker/goals`            | yes | current macro goals |
| PUT    | `/api/tracker/goals`            | yes | upsert macro goals |

## Notes

- Menu data only goes as far back as the most recent scrape (`run_scraper.py`). UMD doesn't publish menus during summer break, so out-of-semester dates render a friendly "Terps are enjoying their summer!" empty state.
- Macro goals previously lived in browser localStorage; they now persist in the `user_goals` table and are migrated up automatically on first login.
- The frontend wraps the router in an `ErrorBoundary` so a single page crash falls back to a friendly screen instead of a white page.
