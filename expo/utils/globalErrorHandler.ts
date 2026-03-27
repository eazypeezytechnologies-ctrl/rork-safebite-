import { Platform } from 'react-native';
import { globalErrorCounter } from './safeFetch';

export interface GlobalError {
  message: string;
  stack?: string;
  timestamp: number;
  type: 'unhandled-rejection' | 'uncaught-error' | 'react-error';
  platform: string;
}

class GlobalErrorHandler {
  private errors: GlobalError[] = [];
  private maxErrors = 100;
  private listeners: ((error: GlobalError) => void)[] = [];

  constructor() {
    this.setupHandlers();
  }

  private setupHandlers(): void {
    if (Platform.OS === 'web') {
      this.setupWebHandlers();
    } else {
      this.setupNativeHandlers();
    }
  }

  private setupWebHandlers(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('error', (event: ErrorEvent) => {
      console.error('[GlobalErrorHandler] Uncaught error:', event.error);
      
      const error: GlobalError = {
        message: event.error?.message || event.message || 'Unknown error',
        stack: event.error?.stack,
        timestamp: Date.now(),
        type: 'uncaught-error',
        platform: 'web',
      };

      this.recordError(error);
      globalErrorCounter.recordError('global', error.message);
    });

    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
      console.error('[GlobalErrorHandler] Unhandled rejection:', event.reason);
      
      const error: GlobalError = {
        message: event.reason?.message || String(event.reason) || 'Unhandled promise rejection',
        stack: event.reason?.stack,
        timestamp: Date.now(),
        type: 'unhandled-rejection',
        platform: 'web',
      };

      this.recordError(error);
      globalErrorCounter.recordError('global', error.message);
    });
  }

  private setupNativeHandlers(): void {
    const originalErrorHandler = ErrorUtils.getGlobalHandler();

    ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
      console.error('[GlobalErrorHandler] Native error:', error, 'isFatal:', isFatal);
      
      const globalError: GlobalError = {
        message: error.message || 'Unknown native error',
        stack: error.stack,
        timestamp: Date.now(),
        type: 'uncaught-error',
        platform: Platform.OS,
      };

      this.recordError(globalError);
      globalErrorCounter.recordError('global', globalError.message);

      if (originalErrorHandler) {
        originalErrorHandler(error, isFatal);
      }
    });

    if (typeof Promise !== 'undefined' && typeof (global as any).__handlingUnhandledRejection === 'undefined') {
      (global as any).__handlingUnhandledRejection = true;
      
      const handleUnhandledRejection = (reason: any) => {
        console.error('[GlobalErrorHandler] Unhandled rejection:', reason);
        
        const error: GlobalError = {
          message: reason?.message || String(reason) || 'Unhandled promise rejection',
          stack: reason?.stack,
          timestamp: Date.now(),
          type: 'unhandled-rejection',
          platform: Platform.OS,
        };

        this.recordError(error);
        globalErrorCounter.recordError('global', error.message);
      };

      if (typeof (global as any).onunhandledrejection !== 'undefined') {
        const originalHandler = (global as any).onunhandledrejection;
        (global as any).onunhandledrejection = (event: any) => {
          handleUnhandledRejection(event.reason);
          if (originalHandler) {
            originalHandler.call(global, event);
          }
        };
      }
    }
  }

  private recordError(error: GlobalError): void {
    this.errors.push(error);
    
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }

    this.notifyListeners(error);
  }

  addListener(listener: (error: GlobalError) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notifyListeners(error: GlobalError): void {
    this.listeners.forEach(listener => {
      try {
        listener(error);
      } catch (err) {
        console.error('[GlobalErrorHandler] Error in listener:', err);
      }
    });
  }

  getErrors(): GlobalError[] {
    return [...this.errors];
  }

  getRecentErrors(limit: number = 10): GlobalError[] {
    return this.errors.slice(-limit);
  }

  clearErrors(): void {
    this.errors = [];
    console.log('[GlobalErrorHandler] Cleared all global errors');
  }
}

export const globalErrorHandler = new GlobalErrorHandler();
