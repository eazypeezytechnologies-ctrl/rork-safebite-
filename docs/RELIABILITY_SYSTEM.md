# Reliability System Documentation

## Overview

This application includes a comprehensive reliability system with the following components:

1. **Global Error Boundary** - Catches and displays React errors gracefully
2. **Global Error Handlers** - Captures uncaught errors and unhandled promise rejections
3. **safeFetch Utility** - Network request wrapper with retry logic and circuit breaker
4. **Error Counter** - Tracks errors over time and trips circuit breaker on threshold
5. **Diagnostics Screen** - Real-time error monitoring and system health
6. **Automated Tests** - Jest tests for error handling and network reliability
7. **CI Pipeline** - TypeScript, ESLint, and test validation on every commit

---

## Components

### 1. Global Error Boundary

**Location**: `components/ErrorBoundary.tsx`

**Purpose**: Catches React component errors and prevents app crashes

**Features**:
- Displays user-friendly error message
- Shows error details in development mode
- Provides "Try Again" button to reset error state
- Automatically logs errors to console

**Usage**: Already integrated at the root level in `app/_layout.tsx`

---

### 2. Global Error Handler

**Location**: `utils/globalErrorHandler.ts`

**Purpose**: Captures all uncaught errors and unhandled promise rejections

**Features**:
- Platform-specific handlers (web vs native)
- Records errors with timestamp and stack trace
- Maintains error history (last 100 errors)
- Listener system for error notifications
- Integrates with error counter for circuit breaker

**Automatic Setup**: Imported in `app/_layout.tsx`, automatically initializes on app start

**API**:
```typescript
import { globalErrorHandler } from '@/utils/globalErrorHandler';

// Get all errors
const errors = globalErrorHandler.getErrors();

// Get recent errors
const recentErrors = globalErrorHandler.getRecentErrors(10);

// Clear errors
globalErrorHandler.clearErrors();

// Add listener
const unsubscribe = globalErrorHandler.addListener((error) => {
  console.log('New error:', error);
});
```

---

### 3. safeFetch Utility

**Location**: `utils/safeFetch.ts`

**Purpose**: Robust network request wrapper with automatic retry and circuit breaker

**Features**:

#### Automatic Retry
- Retries on 5xx server errors
- Retries on network failures
- Exponential backoff (1s, 2s, 4s, up to 10s)
- Configurable retry count (default: 3)

#### Rate Limiting
- Detects 429 status codes
- Respects `Retry-After` header
- Automatic retry after cooldown

#### Circuit Breaker
- Monitors error rate over 10-minute window
- Opens circuit after 3 errors
- Blocks requests when circuit is open
- Half-open state for recovery testing
- Automatic reset after 60 seconds

#### Error Counter
- Tracks all network errors
- Records timestamp, URL, status code
- Auto-cleanup of old errors
- Queryable error history

**Usage**:
```typescript
import { safeFetch } from '@/utils/safeFetch';

// Basic usage (same as fetch)
const data = await safeFetch('https://api.example.com/data');

// With options
const data = await safeFetch('https://api.example.com/data', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ foo: 'bar' }),
  timeout: 5000, // 5 second timeout
  retryConfig: {
    maxRetries: 5,
    initialDelay: 2000,
    maxDelay: 20000,
    backoffFactor: 2,
  },
  skipCircuitBreaker: false, // bypass circuit breaker if needed
});

// Get error statistics
import { getErrorStats } from '@/utils/safeFetch';
const stats = getErrorStats();
console.log('Total errors:', stats.totalErrors);
console.log('Circuit state:', stats.circuitBreakerState);
console.log('Recent errors:', stats.recentErrors);

// Reset circuit breaker manually
import { resetCircuitBreaker } from '@/utils/safeFetch';
resetCircuitBreaker();
```

**Configuration**:
```typescript
// Default retry config
{
  maxRetries: 3,
  initialDelay: 1000,  // 1 second
  maxDelay: 10000,     // 10 seconds
  backoffFactor: 2,    // exponential backoff
}

// Default circuit breaker config
{
  failureThreshold: 3,         // errors before opening
  resetTimeout: 60000,         // 60 seconds before half-open
  monitorWindow: 600000,       // 10 minutes
}
```

---

### 4. Diagnostics Screen

**Location**: `app/diagnostics.tsx`

**Purpose**: Real-time monitoring of system health and error history

**Features**:
- Circuit breaker status with color coding
- Error count over last 10 minutes
- Network error history with timestamps
- Global error history with stack traces
- Manual circuit reset button
- Clear errors button
- Auto-refresh every 2 seconds
- Pull-to-refresh support

**Access**: Navigate to `/diagnostics` in the app

**Status Indicators**:
- 🟢 CLOSED (green) - System operational
- 🟡 HALF_OPEN (yellow) - Testing recovery
- 🔴 OPEN (red) - Circuit breaker active

---

## Network Call Migration

All network calls have been migrated to use `safeFetch`:

### Migrated Files:
- ✅ `api/products.ts` - Product database searches
- ✅ `api/recalls.ts` - FDA recall searches

### Migration Pattern:
```typescript
// Before
const response = await fetch(url);
const data = await response.json();

// After
import { safeFetch } from '@/utils/safeFetch';
const data = await safeFetch(url);
```

---

## Testing

### Test Files:
- `__tests__/utils/safeFetch.test.ts` - safeFetch utility tests
- `__tests__/components/ErrorBoundary.test.tsx` - Error boundary tests

### Running Tests:
```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

### Test Coverage:
- ✅ Successful fetch operations
- ✅ Retry logic on 5xx errors
- ✅ Retry logic on network errors
- ✅ Error counter recording
- ✅ Request timeout handling
- ✅ Rate limiting with Retry-After
- ✅ Circuit breaker threshold
- ✅ Circuit breaker skip option
- ✅ Content-type handling
- ✅ Error clearing
- ✅ Error boundary rendering
- ✅ Error boundary recovery

---

## CI/CD Pipeline

**Location**: `.github/workflows/ci.yml`

### Pipeline Steps:

1. **Type Check**
   - Runs TypeScript compiler
   - Fails on type errors

2. **Lint**
   - Runs ESLint with expo config
   - Fails on lint errors

3. **Test**
   - Runs Jest test suite
   - Generates coverage report
   - Uploads to Codecov (optional)

4. **Build Check**
   - Verifies dependencies
   - Runs on successful tests

### Trigger Events:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`

### Local CI Simulation:
```bash
# Run all CI checks locally
npm run ci

# Or run individually
npm run type-check
npm run lint
npm run test
```

---

## Error Monitoring Best Practices

### 1. Regular Monitoring
- Check Diagnostics screen periodically
- Monitor circuit breaker state
- Review error patterns

### 2. Error Thresholds
- Circuit opens at 3 errors in 10 minutes
- Adjust thresholds in `utils/safeFetch.ts` if needed

### 3. Error Response
- If circuit opens, investigate root cause
- Check network connectivity
- Verify API endpoints
- Review error messages in Diagnostics

### 4. Manual Intervention
- Use "Reset Circuit" to manually recover
- Use "Clear Errors" to reset error history
- Review errors before clearing

---

## Configuration

### Adjust Circuit Breaker Thresholds:

Edit `utils/safeFetch.ts`:
```typescript
const defaultCircuitConfig: CircuitBreakerConfig = {
  failureThreshold: 3,         // Change to 5 for more tolerance
  resetTimeout: 60000,         // Change to 30000 for faster recovery
  monitorWindow: 10 * 60 * 1000, // Change to 5 * 60 * 1000 for 5-min window
};
```

### Adjust Retry Logic:

```typescript
const defaultRetryConfig: RetryConfig = {
  maxRetries: 3,              // Change to 5 for more retries
  initialDelay: 1000,         // Change to 500 for faster first retry
  maxDelay: 10000,            // Change to 30000 for longer max wait
  backoffFactor: 2,           // Keep at 2 for exponential backoff
};
```

---

## Troubleshooting

### Circuit Breaker Won't Close
- Wait for reset timeout (default 60 seconds)
- Check if errors are continuing
- Manually reset using Diagnostics screen
- Verify network connectivity

### Too Many Retries
- Reduce `maxRetries` in safeFetch config
- Increase timeout value
- Check API endpoint health

### Missing Errors in Diagnostics
- Errors auto-cleanup after 10 minutes
- Check if errors occurred in last 10 minutes
- Use error logging for long-term storage

### Tests Failing
- Ensure all dependencies installed
- Clear node_modules and reinstall
- Check for timeouts in async tests
- Verify mock implementations

---

## Future Enhancements

Potential improvements:
1. Error logging to external service (Sentry, LogRocket)
2. Error analytics and reporting dashboard
3. Custom error recovery strategies per API
4. Offline request queueing
5. Error notification system
6. A/B testing for retry strategies
7. Performance metrics collection
8. Automated error alerting

---

## Support

For issues or questions about the reliability system:
1. Check error details in Diagnostics screen
2. Review error logs in console
3. Check CI pipeline status
4. Review this documentation
5. Check test coverage reports

---

## Version History

- **v1.0.0** - Initial reliability system
  - Global error boundary
  - Global error handlers
  - safeFetch with circuit breaker
  - Error counter
  - Diagnostics screen
  - Test suite
  - CI pipeline
