"""FallVision Logging Configuration - DISABLED"""
import logging

def get_logger(name: str) -> logging.Logger:
    """Get a minimal logger that does nothing"""
    logger = logging.getLogger(name)
    logger.setLevel(logging.CRITICAL + 1)  # Higher than CRITICAL = nothing logs
    logger.addHandler(logging.NullHandler())
    return logger

def log_api_access(*args, **kwargs):
    """No-op function"""
    pass

def setup_logging(*args, **kwargs):
    """No-op function"""
    pass
