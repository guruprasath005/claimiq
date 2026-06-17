from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.config import settings
from backend.routers import upload, schemes, evaluate
from backend.routers import cases, reports, settings_router

app = FastAPI(title="Insurance Claim Assistant", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Existing pipeline routes
app.include_router(upload.router)
app.include_router(schemes.router)
app.include_router(evaluate.router)

# New data/dashboard routes
app.include_router(cases.router)
app.include_router(reports.router)
app.include_router(settings_router.router)


@app.get("/health")
async def health():
    return {"status": "ok"}
