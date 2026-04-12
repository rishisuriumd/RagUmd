# TerpDining — UMD Dining AI Assistant

A full-stack AI-powered app that helps University of Maryland students navigate campus dining. It scrapes the UMD Nutrition website, structures the data in SQLite, and exposes it through a LangGraph agent and a React frontend.

## Features

- **AI Chat** — Ask natural-language questions about menus, allergens, nutrition facts, and dining policies. Powered by a multi-step LangGraph agent that routes between policy and menu queries.
- **Menu Browser** — View today's menu for every dining hall, organized by meal and station. Filter by dietary tags (vegan, vegetarian, halal) and exclude allergens. Items are auto-grouped into categories (fruits, grains, desserts, etc.).
- **Recipe Creator** — Tell the AI what you're craving and your dietary goals. It pulls the *actual* menu items available at your chosen dining hall and generates creative meal combinations with full macro breakdowns.
- **Macro Tracker** — Log what you ate with serving amounts, track daily macros for breakfast/lunch/dinner, and view per-meal and daily nutrition totals. Works like a MyFitnessPal built on real dining hall data.

## Architecture

```
Scraper → SQLite → Query Tools → LangGraph Agent → FastAPI → React Frontend
```

| Layer | Tech |
|---|---|
| Scraping | `requests` + `BeautifulSoup4` with retry/backoff |
| Database | SQLite (normalized: halls, items, nutrition, menus, tags) |
| Query Tools | Python functions exposed as LangChain `@tool` objects |
| Agent | LangGraph `StateGraph` with router → hall resolver → specialized agents |
| Backend API | FastAPI with JWT auth, CORS, session-based chat persistence |
| Frontend | React + Vite + Tailwind CSS with UMD red/gold theming |

## Project Structure

```
src/
├── scraping/       # Web scraper + HTML parser for nutrition.umd.edu
├── db/             # SQLite schema, loader, and seeder
├── tools/          # Query functions (menu, nutrition, filters, dining info)
├── agent/          # LangGraph state, nodes, tools, and graph builder
└── api/            # FastAPI routers (auth, chat, menu, recipe, tracker)
frontend/
└── src/
    ├── pages/      # Chat, Menu, Recipe, Tracker, Login, Register
    ├── components/ # Navbar, ChatMessage, FoodSearch, MealSection, etc.
    └── context/    # Auth context provider
```

## Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- OpenAI API key

### Backend

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # Fill in your API keys
```

### Scrape data

```bash
python run_scraper.py          # Scrape menus + nutrition from UMD Dining
python run_loader.py           # Load JSON data into SQLite
python -m src.db.seed_dining_info  # Fetch dining policy pages
```

### Run the app

```bash
# Terminal 1 — Backend
python -m uvicorn server:app --reload

# Terminal 2 — Frontend
cd frontend && npm install && npm run dev
```

Open [http://localhost:5173](http://localhost:5173), create an account, and start chatting.

### CLI agent (optional)

```bash
python run_agent.py   # Interactive terminal chat with the LangGraph agent
```

## Environment Variables

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | OpenAI API key (required) |
| `LANGSMITH_API_KEY` | LangSmith key for tracing (optional) |
| `LANGSMITH_PROJECT` | LangSmith project name (optional) |
| `LANGSMITH_TRACING` | Enable LangSmith tracing (optional) |
