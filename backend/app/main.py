from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.cases import router as cases_router
from app.api.conversations import router as conversations_router
from app.api.ai_analysis import router as ai_analysis_router
from app.api.customers import router as customers_router

app = FastAPI(
    title="Conversation & Case Summarization API",
    description="Backend API for the Conversation & Case Summarization application.",
    version="0.1.0",
)

# CORS: allow the Next.js frontend (http://localhost:3000) to call this API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(customers_router)
app.include_router(cases_router)
app.include_router(conversations_router)
app.include_router(ai_analysis_router)


@app.get("/")
def root():
    return {"message": "Conversation & Case Summarization API"}


@app.get("/health")
def health():
    return {"status": "healthy"}
