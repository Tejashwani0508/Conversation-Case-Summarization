from fastapi import FastAPI

from app.api.cases import router as cases_router
from app.api.conversations import router as conversations_router
from app.api.ai_analysis import router as ai_analysis_router
from app.api.customers import router as customers_router

app = FastAPI(
    title="Conversation & Case Summarization API",
    description="Backend API for the Conversation & Case Summarization application.",
    version="0.1.0",
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
