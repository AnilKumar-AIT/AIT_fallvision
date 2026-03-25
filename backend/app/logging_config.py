"""
FallVision Logging Configuration
Centralized logging setup for the entire backend application
"""
import logging
import sys
from datetime import datetime
from pathlib import Path
import json
from typing import Any, Dict

# Create logs directory if it doesn't exist
LOGS_DIR = Path(__file__).parent.parent.parent / "logs"
LOGS_DIR.mkdir(exist_ok=True)

# Log file paths
LOG_FILE_INFO = LOGS_DIR / f"fallvision_{datetime.now().strftime('%Y%m%d')}.log"
LOG_FILE_ERROR = LOGS_DIR / f"fallvision_error_{datetime.now().strftime('%Y%m%d')}.log"
LOG_FILE_API = LOGS_DIR / f"fallvision_api_{datetime.now().strftime('%Y%m%d')}.log"


class JSONFormatter(logging.Formatter):
    """
    Custom JSON formatter for structured logging
    Outputs logs in JSON format for easy parsing and analysis
    """
    def format(self, record: logging.LogRecord) -> str:
        log_data: Dict[str, Any] = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        
        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
        
        # Add extra fields if present
        if hasattr(record, "extra_data"):
            log_data["extra"] = record.extra_data
        
        return json.dumps(log_data)


class ColoredFormatter(logging.Formatter):
    """
    Colored formatter for console output (development)
    Makes logs easier to read in terminal
    """
    
    # ANSI color codes
    COLORS = {
        'DEBUG': '\033[36m',      # Cyan
        'INFO': '\033[32m',       # Green
        'WARNING': '\033[33m',    # Yellow
        'ERROR': '\033[31m',      # Red
        'CRITICAL': '\033[35m',   # Magenta
        'RESET': '\033[0m',       # Reset
    }
    
    def format(self, record: logging.LogRecord) -> str:
        # Add color to level name
        levelname = record.levelname
        if levelname in self.COLORS:
            record.levelname = f"{self.COLORS[levelname]}{levelname}{self.COLORS['RESET']}"
        
        # Format the message
        formatted = super().format(record)
        
        # Reset color at the end
        return formatted


def setup_logging(
    log_level: str = "INFO",
    use_json: bool = False,
    console_output: bool = True
) -> None:
    """
    Configure logging for the entire application
    
    Args:
        log_level: Minimum log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        use_json: If True, use JSON formatter (production), else use colored formatter (dev)
        console_output: If True, also log to console
    """
    
    # Convert log level string to logging constant
    numeric_level = getattr(logging, log_level.upper(), logging.INFO)
    
    # Create formatters
    if use_json:
        formatter = JSONFormatter()
    else:
        # Detailed format for development
        formatter = ColoredFormatter(
            fmt='%(asctime)s | %(levelname)-8s | %(name)-20s | %(funcName)-15s | %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
    
    # Simple format for file output
    file_formatter = logging.Formatter(
        fmt='%(asctime)s | %(levelname)-8s | %(name)-20s | %(funcName)-15s | %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(numeric_level)
    
    # Remove existing handlers
    root_logger.handlers.clear()
    
    # ========== Console Handler ==========
    if console_output:
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setLevel(numeric_level)
        console_handler.setFormatter(formatter)
        root_logger.addHandler(console_handler)
    
    # ========== File Handler (All logs) ==========
    file_handler = logging.FileHandler(LOG_FILE_INFO, mode='a', encoding='utf-8')
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(file_formatter)
    root_logger.addHandler(file_handler)
    
    # ========== File Handler (Errors only) ==========
    error_handler = logging.FileHandler(LOG_FILE_ERROR, mode='a', encoding='utf-8')
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(file_formatter)
    root_logger.addHandler(error_handler)
    
    # ========== API Access Logger (separate file) ==========
    api_logger = logging.getLogger("api.access")
    api_handler = logging.FileHandler(LOG_FILE_API, mode='a', encoding='utf-8')
    api_handler.setLevel(logging.INFO)
    api_handler.setFormatter(file_formatter)
    api_logger.addHandler(api_handler)
    api_logger.setLevel(logging.INFO)
    api_logger.propagate = False  # Don't propagate to root logger
    
    # ========== Suppress noisy third-party loggers ==========
    logging.getLogger("boto3").setLevel(logging.WARNING)
    logging.getLogger("botocore").setLevel(logging.WARNING)
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    
    # Log startup message
    root_logger.info("="*70)
    root_logger.info("FallVision Backend Logger Initialized")
    root_logger.info(f"Log Level: {log_level}")
    root_logger.info(f"Log Directory: {LOGS_DIR}")
    root_logger.info(f"Console Output: {console_output}")
    root_logger.info(f"JSON Format: {use_json}")
    root_logger.info("="*70)


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger instance with the given name
    
    Args:
        name: Logger name (typically __name__ from calling module)
    
    Returns:
        Logger instance
    
    Example:
        logger = get_logger(__name__)
        logger.info("Something happened")
    """
    return logging.getLogger(name)


# API Access Logger helper
def log_api_access(
    method: str,
    path: str,
    status_code: int,
    duration_ms: float,
    user_id: str = None,
    facility_id: str = None
) -> None:
    """
    Log API access with structured data
    
    Args:
        method: HTTP method (GET, POST, etc.)
        path: Request path
        status_code: HTTP status code
        duration_ms: Request duration in milliseconds
        user_id: Optional user ID
        facility_id: Optional facility ID
    """
    api_logger = logging.getLogger("api.access")
    
    log_msg = (
        f"{method} {path} | Status: {status_code} | "
        f"Duration: {duration_ms:.2f}ms"
    )
    
    if user_id:
        log_msg += f" | User: {user_id}"
    if facility_id:
        log_msg += f" | Facility: {facility_id}"
    
    if status_code >= 500:
        api_logger.error(log_msg)
    elif status_code >= 400:
        api_logger.warning(log_msg)
    else:
        api_logger.info(log_msg)


# Initialize logging on module import
# This ensures logging is set up when the app starts
setup_logging(
    log_level="INFO",
    use_json=False,  # Set to True in production
    console_output=True
)
