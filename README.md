# Conversation & Case Summarization

## Overview

An AI-powered customer service foundation that analyzes customer-agent conversations and service cases to produce concise summaries, key details, sentiment insights, priority recommendations, pending actions, and next-action guidance.

This initial setup creates a clean, separated frontend and backend architecture ready for later AI and case management implementation.

## Technology Stack

- Frontend: Next.js, TypeScript, Tailwind CSS, ESLint
- Backend: Python, FastAPI, SQLAlchemy, Pydantic
- Database: PostgreSQL
- AI: OpenAI API (integration planned later)

## Project Structure

- `frontend/` - Next.js application with App Router, Tailwind CSS, and TypeScript
- `backend/` - FastAPI application with configuration, database setup, and modular package layout
- `database/` - reserved for database-related scripts and assets
- `docs/` - documentation and design assets

## Local Development

### 1. Clone the repository

```bash
git clone <repository-url>
cd "Conversation-Case-Summarization"
```

### 2. Set up the backend virtual environment

```bash
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### 3. Install backend dependencies

```bash
.venv\Scripts\activate
pip install -r requirements.txt
```

### 4. Configure environment variables

Create a `.env` file in `backend/` based on `.env.example`.

### 5. Start FastAPI

```bash
uvicorn app.main:app --reload
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

### 6. Install frontend dependencies

```bash
cd ../frontend
npm install
```

### 7. Start Next.js

```bash
npm run dev
```
