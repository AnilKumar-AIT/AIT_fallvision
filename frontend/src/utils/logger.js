const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  CRITICAL: 4,
};

// Current environment
const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

// Minimum log level (can be configured via environment variable)
const MIN_LOG_LEVEL = process.env.REACT_APP_LOG_LEVEL 
  ? LOG_LEVELS[process.env.REACT_APP_LOG_LEVEL.toUpperCase()]
  : (isDevelopment ? LOG_LEVELS.DEBUG : LOG_LEVELS.INFO);

// Log storage (for production error tracking)
const LOG_BUFFER = [];
const MAX_LOG_BUFFER_SIZE = 100;

/**
 * Format timestamp for logs
 */
const getTimestamp = () => {
  return new Date().toISOString();
};

/**
 * Format log message with metadata
 */
const formatLogMessage = (level, component, message, data) => {
  const timestamp = getTimestamp();
  const formattedMessage = `[${timestamp}] [${level}] [${component}] ${message}`;
  
  return {
    timestamp,
    level,
    component,
    message,
    data,
    formattedMessage,
  };
};

/**
 * Store log in buffer (for production error tracking)
 */
const storeLog = (logEntry) => {
  if (isProduction) {
    LOG_BUFFER.push(logEntry);
    
    // Keep buffer size limited
    if (LOG_BUFFER.length > MAX_LOG_BUFFER_SIZE) {
      LOG_BUFFER.shift();
    }
  }
};

/**
 * Send critical errors to backend (production only)
 */
const sendErrorToBackend = async (logEntry) => {
  if (!isProduction) return;
  
  try {
    // TODO: Implement error tracking endpoint
    // await fetch('/api/v1/logs/error', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     timestamp: logEntry.timestamp,
    //     level: logEntry.level,
    //     component: logEntry.component,
    //     message: logEntry.message,
    //     data: logEntry.data,
    //     userAgent: navigator.userAgent,
    //     url: window.location.href,
    //   }),
    // });
  } catch (err) {
    // Silent fail - don't crash app due to logging error
    console.error('Failed to send error to backend:', err);
  }
};

/**
 * Main Logger Class
 */
class Logger {
  constructor(componentName = 'App') {
    this.componentName = componentName;
  }

  /**
   * Debug level logging (development only)
   */
  debug(message, data = null) {
    if (LOG_LEVELS.DEBUG < MIN_LOG_LEVEL) return;
    
    const logEntry = formatLogMessage('DEBUG', this.componentName, message, data);
    
    if (isDevelopment) {
      console.debug(logEntry.formattedMessage, data || '');
    }
    
    storeLog(logEntry);
  }

  /**
   * Info level logging
   */
  info(message, data = null) {
    if (LOG_LEVELS.INFO < MIN_LOG_LEVEL) return;
    
    const logEntry = formatLogMessage('INFO', this.componentName, message, data);
    
    if (isDevelopment) {
      console.info(logEntry.formattedMessage, data || '');
    } else {
      // In production, only log to console for important info
      
    }
    
    storeLog(logEntry);
  }

  /**
   * Warning level logging
   */
  warn(message, data = null) {
    if (LOG_LEVELS.WARN < MIN_LOG_LEVEL) return;
    
    const logEntry = formatLogMessage('WARN', this.componentName, message, data);
    
    console.warn(logEntry.formattedMessage, data || '');
    
    storeLog(logEntry);
  }

  /**
   * Error level logging
   */
  error(message, error = null, data = null) {
    if (LOG_LEVELS.ERROR < MIN_LOG_LEVEL) return;
    
    const errorData = {
      ...data,
      error: error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : null,
    };
    
    const logEntry = formatLogMessage('ERROR', this.componentName, message, errorData);
    
    console.error(logEntry.formattedMessage, errorData);
    
    storeLog(logEntry);
    
    // Send to backend in production
    sendErrorToBackend(logEntry);
  }

  /**
   * Critical level logging (always logged and sent to backend)
   */
  critical(message, error = null, data = null) {
    const errorData = {
      ...data,
      error: error ? {
        message: error.message,
        stack: error.stack,
        name: error.name,
      } : null,
    };
    
    const logEntry = formatLogMessage('CRITICAL', this.componentName, message, errorData);
    
    console.error('🚨 CRITICAL:', logEntry.formattedMessage, errorData);
    
    storeLog(logEntry);
    
    // Always send critical errors to backend
    sendErrorToBackend(logEntry);
  }

  /**
   * API call logging
   */
  apiCall(method, endpoint, status, duration, data = null) {
    const message = `API ${method} ${endpoint} - ${status} (${duration}ms)`;
    
    if (status >= 500) {
      this.error(message, null, data);
    } else if (status >= 400) {
      this.warn(message, data);
    } else {
      this.debug(message, data);
    }
  }

  /**
   * Performance logging
   */
  performance(label, duration) {
    const message = `Performance: ${label} took ${duration}ms`;
    
    if (duration > 1000) {
      this.warn(message);
    } else {
      this.debug(message);
    }
  }

  /**
   * User action logging
   */
  userAction(action, data = null) {
    this.info(`User Action: ${action}`, data);
  }
}

/**
 * Create logger instance for a component
 * 
 * Usage:
 *   import { createLogger } from 'utils/logger';
 *   const logger = createLogger('SleepDiaryPage');
 *   logger.info('Loading sleep data');
 */
export const createLogger = (componentName) => {
  return new Logger(componentName);
};

/**
 * Global logger (for general use)
 */
export const logger = new Logger('Global');

/**
 * Get all logs from buffer (for debugging or sending to support)
 */
export const getLogBuffer = () => {
  return [...LOG_BUFFER];
};

/**
 * Clear log buffer
 */
export const clearLogBuffer = () => {
  LOG_BUFFER.length = 0;
};

/**
 * Export logs to file (for debugging)
 */
export const exportLogsToFile = () => {
  const logs = getLogBuffer();
  const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fallvision-logs-${new Date().toISOString()}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

/**
 * React Error Boundary helper
 */
export const logErrorBoundary = (error, errorInfo) => {
  const boundaryLogger = new Logger('ErrorBoundary');
  boundaryLogger.critical('React Error Boundary caught error', error, {
    componentStack: errorInfo.componentStack,
  });
};

export default logger;
