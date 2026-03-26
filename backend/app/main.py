"""FallVision FastAPI Backend
Main application entry point
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .routes import sleep, gait, residents, caregivers, adls, falls

# Initialize FastAPI app
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Backend API for FallVision - AI-powered fall prevention system"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(sleep.router, prefix=settings.API_V1_PREFIX)
app.include_router(gait.router, prefix=settings.API_V1_PREFIX)
app.include_router(adls.router, prefix=settings.API_V1_PREFIX)
app.include_router(residents.router, prefix=settings.API_V1_PREFIX)
app.include_router(caregivers.router, prefix=settings.API_V1_PREFIX)
app.include_router(falls.router, prefix=settings.API_V1_PREFIX)

@app.get("/")
async def root():
    """API root endpoint"""
    return {
        "message": "FallVision API",
        "version": settings.VERSION,
        "docs": "/docs",
                "endpoints": {
            "sleep": "/api/v1/sleep/{resident_id}",
            "gait": "/api/v1/gait/{resident_id}",
            "adls": "/api/v1/adls/{resident_id}",
            "residents": "/api/v1/residents",
            "caregivers": "/api/v1/caregivers",
            "falls": "/api/v1/falls",
            "fall_analytics": "/api/v1/falls/analytics"
        }
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "fallvision-api"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
