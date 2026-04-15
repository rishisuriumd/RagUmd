# 🐢 TerpDining — UMD Dining Assistant

A full-stack web app that helps University of Maryland students navigate campus dining. It scrapes the UMD Nutrition website daily, stores structured data in SQLite, and serves it through a FastAPI backend and React frontend — themed to UMD's official brand.

---

## Features

### Smart Chat
Ask natural-language questions about menus, allergens, nutrition facts, and dining policies. Chat sessions persist so you can pick up where you left off.

### Menu Browser
View today's menu for every dining hall, organized by meal and station. Each item displays color-coded dietary and allergen badges (Vegan, Vegetarian, Halal Friendly, Dairy, Gluten, Nuts, etc.) with a tap-to-open icon legend. Date navigation is restricted to today and future dates only.

### Recipe Creator
Pick a dining hall, meal, cuisine preference, and dietary goals. The app pulls the *actual* menu items available and generates creative meal combinations with full macro breakdowns. Follow up with tweaks in a chat thread.

### Macro Tracker
Log what you ate with context-aware portion sizes — pizza by the slice, chicken by the piece, soup by the bowl. An interactive donut chart visualizes your daily macros (protein, fat, carbs) with hover/tap highlighting. Track per-meal and daily nutrition totals.

---

## Tech Stack

```
Scraper → SQLite → Backend API → React Frontend
```

| Layer | Tech |
|---|---|
| Scraping | `requests` + `BeautifulSoup4` with retry/backoff |
| Database | SQLite (normalized: halls, items, nutrition, menus, tags) |
| Backend | FastAPI with JWT auth, CORS, session-based chat |
| Frontend | React 18 + Vite + Tailwind CSS v4 |
| Auth | JWT (HS256) with `bcrypt` password hashing |

---

## UI & Design

- **UMD Brand Theming** — Maryland Red (#E21833), Gold (#FFD200), official gray palette
- **Typography** — Overpass, Barlow Condensed (hero titles), Crimson Text, Source Sans 3
- **Responsive** — Hamburger menu on mobile, collapsible sidebars, wrapped pill filters, stacked layouts on small screens
- **Dietary Badges** — Color-coded circles matching UMD's official nutrition site (11 badge types with legend popup)
- **Interactive Charts** — SVG donut chart with hover-to-highlight macros and synced card animations

---

## Project Structure

```
├── server.py               # FastAPI entry point
├── run_scraper.py           # Scrape menus + nutrition
├── requirements.txt         # Python dependencies
├── .env.example             # Environment variable template
│
├── src/
│   ├── scraping/            # Web scraper + HTML parser for nutrition.umd.edu
│   ├── db/                  # SQLite schema, loader, and seeder
│   ├── tools/               # Query functions (menu, nutrition, filters, dining info)
│   └── api/                 # FastAPI routers (auth, chat, menu, recipe, tracker)
│
└── frontend/
    ├── index.html           # Entry HTML with Google Fonts
    └── src/
        ├── index.css        # Tailwind config, UMD design tokens, utility classes
        ├── App.jsx          # Root component with routing
        ├── pages/           # Chat, Menu, Recipe, Tracker, Login, Register
        ├── components/      # Navbar, ChatMessage, FoodSearch, DailySummary, etc.
        └── context/         # Auth context provider
```

---

## Setup

### Prerequisites

- Python 3.11+
- Node.js 18+
- API key for your LLM provider

### 1. Clone & install backend

```bash
git clone https://github.com/rishisuriumd/RagUmd.git
cd RagUmd

python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 2. Configure environment

```bash
cp .env.example .env
# Fill in your API keys
```

### 3. Scrape dining data

```bash
python run_scraper.py
```

### 4. Install frontend

```bash
cd frontend
npm install
cd ..
```

### 5. Run the app

```bash
# Terminal 1 — Backend (port 8000)
python -m uvicorn server:app --reload

# Terminal 2 — Frontend (port 5173)
cd frontend && npm run dev
```

Open [http://localhost:5173](http://localhost:5173), create an account, and start exploring.

---

## Environment Variables

| Variable | Description |
|---|---|
| `OPENAI_API_KEY` | LLM provider API key (required) |
| `LANGSMITH_API_KEY` | Tracing key (optional) |
| `LANGSMITH_PROJECT` | Tracing project name (optional) |
| `LANGSMITH_TRACING` | Enable tracing (optional) |

---

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/register` | — | Create account |
| `POST` | `/api/auth/login` | — | Log in, get JWT |
| `GET` | `/api/auth/me` | Bearer | Current user profile |
| `GET` | `/api/menu/browse?dt=` | — | Browse menu by date |
| `GET` | `/api/nutrition/search?q=` | — | Search food nutrition |
| `GET` | `/api/chat/sessions` | Bearer | List chat sessions |
| `POST` | `/api/chat` | Bearer | Send chat message |
| `POST` | `/api/recipe` | Bearer | Generate / continue recipe |
| `POST` | `/api/tracker/logs` | Bearer | Log food |
| `GET` | `/api/tracker/summary?date=` | Bearer | Daily macro summary |

---

## Authors

Built for CMSC at the University of Maryland, College Park.
