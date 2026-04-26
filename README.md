# AI Startup Idea Validator

> Transform raw business concepts into investor-ready strategies in under 10 minutes — powered by Google Gemini AI with real-time web search grounding.

## Architecture

```
Next.js Frontend (localhost:3000)
    ↕ Server-Sent Events (SSE)
Python FastAPI Backend (localhost:8000)
    ├── Critic Agent (Gemini 2.0 Flash)
    ├── Market Research Agent (Gemini + Google Search)
    ├── Competitor Intel Agent (Gemini + Google Search)
    ├── Financial Model Agent (TAM/SAM/SOM + Viability Score)
    └── Asset Generator Agent (Business Plan + Brand Kit)
```

## Quick Start

### 1. Backend Setup

```powershell
cd backend

# Copy and fill in your API key
copy .env.example .env
# Edit .env and set: GEMINI_API_KEY=your_key_here

# Install dependencies
pip install fastapi uvicorn python-dotenv pydantic google-genai sse-starlette

# Start backend (port 8000)
python main.py
```

### 2. Frontend Setup

```powershell
cd frontend

# Install dependencies (already done)
npm install

# Start frontend (port 3000)
npm run dev
```

### 3. Open the App

Navigate to http://localhost:3000

## Get a Gemini API Key

1. Go to https://aistudio.google.com/app/apikey
2. Create a new API key
3. Paste it into `backend/.env` as `GEMINI_API_KEY=your_key`

## Pages

| Page | URL | Description |
|------|-----|-------------|
| Landing | `/` | Hero, features, how-it-works |
| Validate | `/validate` | 4-step hypothesis input wizard with live agent streaming |
| Report | `/report/[id]` | Full validation report with 5 tabbed sections |

## Agent Pipeline

| Agent | Model | Role |
|-------|-------|------|
| Critic Agent | Gemini 2.0 Flash | Challenges hypothesis, forces problem-first thinking |
| Market Research | Gemini 2.0 Flash + Google Search | TAM/SAM, trends, "Why Now?" signals |
| Competitor Intel | Gemini 2.0 Flash + Google Search | SWOT, 3-star review gaps, Blue Ocean strategy |
| Financial Model | Gemini 2.0 Flash | TAM/SAM/SOM calculation, Viability Score (Vs formula) |
| Asset Generator | Gemini 2.0 Flash | Business plan, Jungian brand archetypes, marketing |

## Viability Score Formula

```
Vs = (Wd × D + Wc × C + Wf × F) / ΣW

Where:
  D = Demand Signal (40% weight)
  C = Competitive Gap Score (35% weight)  
  F = Feasibility Score (25% weight)

Traffic Lights:
  🟢 ≥ 70 = High Viability
  🟡 40-69 = Moderate Viability
  🔴 < 40 = Low Viability
```

## Project Structure

```
AI Startup Idea Validator/
├── frontend/                   # Next.js 16 App Router
│   ├── app/
│   │   ├── page.tsx            # Landing page
│   │   ├── validate/page.tsx   # Validation wizard (SSE streaming)
│   │   ├── report/[id]/page.tsx # Full report with 5 tabs
│   │   └── globals.css         # Design system tokens
│   └── lib/firebase.ts         # Firebase SDK (optional)
│
└── backend/                    # Python FastAPI
    ├── main.py                 # FastAPI server + SSE endpoint
    └── src/
        ├── agents/
        │   ├── orchestrator.py     # Master coordinator
        │   ├── critic_agent.py     # Problem challenger
        │   ├── market_research.py  # Google Search grounding
        │   ├── competitor_intel.py # SWOT analysis
        │   ├── financial_model.py  # TAM/SAM/SOM + Vs
        │   └── asset_generator.py  # Business plan + brand
        └── tools/
            └── calculator_tool.py  # Viability Score math
```
