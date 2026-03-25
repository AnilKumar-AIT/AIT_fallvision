"""FallVision FastAPI Backend
Main application entry point
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .routes import sleep, gait, residents, caregivers, adls
from .logging_config import get_logger

# Initialize logger
logger = get_logger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="Backend API for FallVision - AI-powered fall prevention system"
)

logger.info(f"Initializing {settings.PROJECT_NAME} v{settings.VERSION}")

# Configure CORS
logger.info(f"Configuring CORS for origins: {settings.CORS_ORIGINS}")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
logger.info("Registering API routers")
app.include_router(sleep.router, prefix=settings.API_V1_PREFIX)
app.include_router(gait.router, prefix=settings.API_V1_PREFIX)
app.include_router(adls.router, prefix=settings.API_V1_PREFIX)
app.include_router(residents.router, prefix=settings.API_V1_PREFIX)
app.include_router(caregivers.router, prefix=settings.API_V1_PREFIX)
logger.info("All routers registered successfully")

@app.get("/")
async def root():
    """API root endpoint"""
    logger.debug("Root endpoint accessed")
    return {
        "message": "FallVision API",
        "version": settings.VERSION,
        "docs": "/docs",
        "endpoints": {
            "sleep": "/api/v1/sleep/{resident_id}",
            "gait": "/api/v1/gait/{resident_id}",
            "adls": "/api/v1/adls/{resident_id}",
            "residents": "/api/v1/residents",
            "caregivers": "/api/v1/caregivers"
        }
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    logger.debug("Health check endpoint accessed")
    return {"status": "healthy", "service": "fallvision-api"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
