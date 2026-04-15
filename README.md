# 🐢 TerpDining

UMD dining hall app. Lets you check menus, track macros, get recipe ideas, and ask questions about dining — all from one place.

## What it does

- **Menu** — see what's at each dining hall by meal/station. Badges show dietary stuff (vegan, halal, allergens etc). Only shows today + future dates
- **Chat** — ask questions about menus, nutrition, hours, whatever. Remembers your conversation
- **Recipes** — pick a dining hall and meal, it'll suggest recipes you can actually make from what's available
- **Tracker** — log food with portion sizes that make sense (slices of pizza, scoops of ice cream, not just "servings"). Donut chart shows your macros

## Stack

| | |
|---|---|
| Backend | FastAPI, SQLite, JWT auth, bcrypt |
| Frontend | React, Vite, Tailwind v4 |
| Scraping | BeautifulSoup, requests |
| Data | nutrition.umd.edu |

## Structure

```
src/
├── scraping/     # pulls menu + nutrition data from umd site
├── db/           # sqlite schema, seeding
├── tools/        # query helpers for menu/nutrition lookups
├── agent/        # handles chat routing and responses
└── api/          # fastapi routes (auth, chat, menu, recipe, tracker)

frontend/src/
├── pages/        # Chat, Menu, Recipe, Tracker, Login, Register
├── components/   # Navbar, FoodSearch, DailySummary, etc
└── context/      # auth provider
```

## Running it

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
# put your api key in .env

# scrape the menu data
python run_scraper.py

# frontend
cd frontend && npm install && cd ..

# run both
python -m uvicorn server:app --reload   # terminal 1
cd frontend && npm run dev              # terminal 2
```

Then go to http://localhost:5173

## Env vars

| Var | What |
|---|---|
| `OPENAI_API_KEY` | required |
| `LANGSMITH_API_KEY` | optional, for tracing |
| `LANGSMITH_PROJECT` | optional |

## Endpoints

| Method | Path | Auth? | |
|---|---|---|---|
| POST | `/api/auth/register` | no | create account |
| POST | `/api/auth/login` | no | get token |
| GET | `/api/auth/me` | yes | who am i |
| GET | `/api/menu/browse?dt=` | no | menu for a date |
| GET | `/api/nutrition/search?q=` | no | search foods |
| GET | `/api/chat/sessions` | yes | list chats |
| POST | `/api/chat` | yes | send message |
| POST | `/api/recipe` | yes | make recipe |
| POST | `/api/tracker/logs` | yes | log food |
| GET | `/api/tracker/summary?date=` | yes | daily macros |
