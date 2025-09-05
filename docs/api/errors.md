---
title: Error Handling
description: Complete guide to understanding and handling errors in the Altus 4 API, including error codes, troubleshooting, and best practices.
---

# Error Handling

Comprehensive Error Handling Guide

Altus 4 uses structured error responses with specific error codes to help you understand and handle different failure scenarios. This guide covers all error types, troubleshooting steps, and implementation best practices.

## Error Response Format

### Standard Error Structure

All API errors follow a consistent response format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error description",
    "details": {
      "field": "specific_field",
      "reason": "detailed_explanation",
      "context": {}
    }
  },
  "meta": {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "requestId": "req_abc123def456",
    "version": "0.2.1"
  }
}
```

### Error Response Fields

| Field            | Type    | Description                                       |
| ---------------- | ------- | ------------------------------------------------- |
| `success`        | boolean | Always `false` for error responses                |
| `error.code`     | string  | Specific error code for programmatic handling     |
| `error.message`  | string  | Human-readable error description                  |
| `error.details`  | object  | Additional context and specific error information |
| `meta.timestamp` | string  | ISO timestamp when error occurred                 |
| `meta.requestId` | string  | Unique request identifier for debugging           |
| `meta.version`   | string  | API version that generated the error              |

## HTTP Status Codes

### Status Code Overview

| Status | Code                  | Description              | Common Use Cases                               |
| ------ | --------------------- | ------------------------ | ---------------------------------------------- |
| 200    | OK                    | Request successful       | Successful API calls                           |
| 201    | Created               | Resource created         | Database connection added, API key created     |
| 400    | Bad Request           | Invalid request data     | Validation errors, malformed requests          |
| 401    | Unauthorized          | Authentication required  | Missing or invalid API key                     |
| 403    | Forbidden             | Insufficient permissions | API key lacks required permissions             |
| 404    | Not Found             | Resource not found       | Invalid database ID, non-existent endpoint     |
| 409    | Conflict              | Resource conflict        | Duplicate database name, existing API key      |
| 422    | Unprocessable Entity  | Validation failed        | Invalid request data format                    |
| 429    | Too Many Requests     | Rate limit exceeded      | API rate limit hit                             |
| 500    | Internal Server Error | Server error             | Database connectivity, unexpected errors       |
| 502    | Bad Gateway           | External service error   | OpenAI API issues, database connection failure |
| 503    | Service Unavailable   | Service temporarily down | Maintenance mode, overload                     |

## Error Categories

### Authentication Errors (401)

Authentication-related failures involving API keys or tokens.

#### `INVALID_API_KEY`

```json
{
  "success": false,
  "error": {
    "code": "INVALID_API_KEY",
    "message": "The provided API key is invalid or has been revoked",
    "details": {
      "keyPrefix": "altus4_sk_live_abc...",
      "reason": "Key not found in active keys",
      "suggestion": "Verify your API key or create a new one"
    }
  }
}
```

**Common Causes:**

- API key was revoked or deleted
- Incorrect API key format
- Typo in API key
- Using test key in production environment

**Resolution:**

1. Verify API key format and correctness
2. Check if key was revoked in dashboard
3. Create new API key if necessary

#### `EXPIRED_API_KEY`

```json
{
  "success": false,
  "error": {
    "code": "EXPIRED_API_KEY",
    "message": "API key has expired",
    "details": {
      "expiredAt": "2024-01-10T00:00:00.000Z",
      "keyId": "key_abc123",
      "suggestion": "Regenerate your API key"
    }
  }
}
```

### Authorization Errors (403)

Permission and access-related failures.

#### `INSUFFICIENT_PERMISSIONS`

```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_PERMISSIONS",
    "message": "API key lacks required permissions for this operation",
    "details": {
      "requiredPermissions": ["database:write"],
      "currentPermissions": ["search", "database:read"],
      "operation": "add_database",
      "suggestion": "Update API key permissions or upgrade tier"
    }
  }
}
```

**Common Causes:**

- API key missing required permission scope
- Tier limitations (free tier restrictions)
- Attempting admin operations with limited key

**Resolution:**

1. Update API key permissions
2. Use API key with appropriate permissions
3. Upgrade to higher tier if needed

#### `TIER_LIMITATION`

```json
{
  "success": false,
  "error": {
    "code": "TIER_LIMITATION",
    "message": "Operation not available for current tier",
    "details": {
      "currentTier": "free",
      "requiredTier": "pro",
      "feature": "advanced_analytics",
      "upgradeUrl": "https://altus4.dev/pricing"
    }
  }
}
```

### Validation Errors (400, 422)

Request validation and formatting errors.

#### `VALIDATION_ERROR`

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "field": "query",
      "reason": "Query cannot be empty",
      "received": "",
      "expected": "string (1-500 characters)"
    }
  }
}
```

**Common Validation Errors:**

| Field       | Error               | Description                        |
| ----------- | ------------------- | ---------------------------------- |
| `query`     | Empty query         | Search query cannot be empty       |
| `databases` | Invalid database ID | Database ID format invalid         |
| `limit`     | Out of range        | Limit must be between 1-100        |
| `email`     | Invalid format      | Email format validation failed     |
| `password`  | Too weak            | Password doesn't meet requirements |

#### `MALFORMED_REQUEST`

```json
{
  "success": false,
  "error": {
    "code": "MALFORMED_REQUEST",
    "message": "Request body is not valid JSON",
    "details": {
      "error": "Unexpected token } in JSON at position 45",
      "suggestion": "Check JSON syntax and formatting"
    }
  }
}
```

### Resource Errors (404, 409)

Resource-related errors including not found and conflicts.

#### `RESOURCE_NOT_FOUND`

```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Requested resource was not found",
    "details": {
      "resource": "database",
      "id": "db_invalid123",
      "suggestion": "Verify the resource ID exists and you have access"
    }
  }
}
```

#### `RESOURCE_CONFLICT`

```json
{
  "success": false,
  "error": {
    "code": "RESOURCE_CONFLICT",
    "message": "Resource already exists with the same identifier",
    "details": {
      "resource": "database",
      "field": "name",
      "value": "Production Database",
      "suggestion": "Use a different name or update the existing resource"
    }
  }
}
```

### Rate Limiting Errors (429)

Rate limiting and quota-related errors.

#### `RATE_LIMIT_EXCEEDED`

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "API rate limit exceeded. Try again in 45 seconds.",
    "details": {
      "limit": 1000,
      "remaining": 0,
      "resetTime": "2024-01-15T10:31:00.000Z",
      "tier": "free",
      "retryAfter": 45,
      "upgradeMessage": "Upgrade to Pro or Enterprise for higher rate limits"
    }
  }
}
```

### Service Errors (500, 502, 503)

Internal service and external dependency errors.

#### `DATABASE_ERROR`

```json
{
  "success": false,
  "error": {
    "code": "DATABASE_ERROR",
    "message": "Database operation failed",
    "details": {
      "operation": "search",
      "databaseId": "db_abc123",
      "error": "Connection timeout",
      "retryable": true,
      "suggestion": "Retry the request or check database connectivity"
    }
  }
}
```

#### `AI_SERVICE_ERROR`

```json
{
  "success": false,
  "error": {
    "code": "AI_SERVICE_ERROR",
    "message": "AI service temporarily unavailable",
    "details": {
      "service": "openai",
      "error": "Rate limit exceeded",
      "fallback": "disabled",
      "retryAfter": 60,
      "suggestion": "Retry with semantic search disabled or wait for service recovery"
    }
  }
}
```

#### `CACHE_ERROR`

```json
{
  "success": false,
  "error": {
    "code": "CACHE_ERROR",
    "message": "Cache service error",
    "details": {
      "operation": "get",
      "error": "Redis connection failed",
      "impact": "Performance may be degraded",
      "fallback": "direct_database_query"
    }
  }
}
```

## Error Handling Best Practices

### Client-Side Error Handling

```javascript
class Altus4Client {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.altus4.dev';
  }

  async makeRequest(endpoint, options = {}) {
    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Altus4Error(
          data.error,
          response.status,
          data.meta?.requestId
        );
      }

      return data;
    } catch (error) {
      if (error instanceof Altus4Error) {
        throw error;
      }

      // Handle network errors
      throw new Altus4Error(
        {
          code: 'NETWORK_ERROR',
          message: 'Network request failed',
          details: { originalError: error.message },
        },
        0
      );
    }
  }

  async searchWithRetry(query, databases, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.makeRequest('/api/v1/search', {
          method: 'POST',
          body: JSON.stringify({ query, databases }),
        });
      } catch (error) {
        if (this.isRetryableError(error) && attempt < maxRetries) {
          const delay = this.calculateRetryDelay(attempt, error);
          await this.sleep(delay);
          continue;
        }
        throw error;
      }
    }
  }

  isRetryableError(error) {
    const retryableCodes = [
      'DATABASE_ERROR',
      'AI_SERVICE_ERROR',
      'CACHE_ERROR',
      'NETWORK_ERROR',
    ];

    const retryableStatuses = [500, 502, 503, 504];

    return (
      retryableCodes.includes(error.code) ||
      retryableStatuses.includes(error.status)
    );
  }

  calculateRetryDelay(attempt, error) {
    // Exponential backoff with jitter
    const baseDelay = 1000 * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 1000;

    // Use retry-after header if available
    if (error.details?.retryAfter) {
      return error.details.retryAfter * 1000;
    }

    return baseDelay + jitter;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

class Altus4Error extends Error {
  constructor(errorData, status, requestId) {
    super(errorData.message);
    this.name = 'Altus4Error';
    this.code = errorData.code;
    this.status = status;
    this.details = errorData.details;
    this.requestId = requestId;
  }

  isAuthenticationError() {
    return this.status === 401;
  }

  isAuthorizationError() {
    return this.status === 403;
  }

  isRateLimitError() {
    return this.code === 'RATE_LIMIT_EXCEEDED';
  }

  isValidationError() {
    return this.status === 400 || this.status === 422;
  }

  getRetryAfter() {
    return this.details?.retryAfter || null;
  }
}

// Usage example
const client = new Altus4Client('altus4_sk_live_abc123...');

try {
  const results = await client.searchWithRetry('database optimization', [
    'db_abc123',
  ]);
  console.log('Search completed:', results.data.summary.totalResults);
} catch (error) {
  if (error.isRateLimitError()) {
    console.log(`Rate limited. Retry after ${error.getRetryAfter()} seconds`);
  } else if (error.isAuthenticationError()) {
    console.error('Authentication failed. Check your API key.');
  } else if (error.isValidationError()) {
    console.error('Validation error:', error.details);
  } else {
    console.error('Unexpected error:', error.message);
  }
}
```

### Python Error Handling

```python
import requests
import time
import random
from typing import Optional, Dict, Any

class Altus4Error(Exception):
    def __init__(self, error_data: dict, status_code: int, request_id: Optional[str] = None):
        super().__init__(error_data.get('message', 'Unknown error'))
        self.code = error_data.get('code')
        self.status = status_code
        self.details = error_data.get('details', {})
        self.request_id = request_id

    def is_authentication_error(self) -> bool:
        return self.status == 401

    def is_authorization_error(self) -> bool:
        return self.status == 403

    def is_rate_limit_error(self) -> bool:
        return self.code == 'RATE_LIMIT_EXCEEDED'

    def is_retryable(self) -> bool:
        retryable_codes = [
            'DATABASE_ERROR', 'AI_SERVICE_ERROR',
            'CACHE_ERROR', 'NETWORK_ERROR'
        ]
        retryable_statuses = [500, 502, 503, 504]

        return (self.code in retryable_codes or
                self.status in retryable_statuses)

    def get_retry_after(self) -> Optional[int]:
        return self.details.get('retryAfter')

class Altus4Client:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = 'https://api.altus4.dev'
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        })

    def make_request(self, endpoint: str, method: str = 'GET', **kwargs) -> dict:
        """Make API request with error handling"""
        try:
            response = self.session.request(
                method,
                f'{self.base_url}{endpoint}',
                **kwargs
            )

            data = response.json()

            if not response.ok:
                raise Altus4Error(
                    data.get('error', {}),
                    response.status_code,
                    data.get('meta', {}).get('requestId')
                )

            return data

        except requests.RequestException as e:
            raise Altus4Error(
                {
                    'code': 'NETWORK_ERROR',
                    'message': 'Network request failed',
                    'details': {'originalError': str(e)}
                },
                0
            )

    def search_with_retry(self, query: str, databases: list, max_retries: int = 3) -> dict:
        """Execute search with automatic retries"""
        for attempt in range(1, max_retries + 1):
            try:
                return self.make_request('/api/v1/search', 'POST', json={
                    'query': query,
                    'databases': databases
                })

            except Altus4Error as e:
                if e.is_retryable() and attempt < max_retries:
                    delay = self._calculate_retry_delay(attempt, e)
                    time.sleep(delay)
                    continue
                raise e

    def _calculate_retry_delay(self, attempt: int, error: Altus4Error) -> float:
        """Calculate delay before retry with exponential backoff"""
        # Use retry-after if provided
        if error.get_retry_after():
            return error.get_retry_after()

        # Exponential backoff with jitter
        base_delay = 2 ** (attempt - 1)
        jitter = random.uniform(0, 1)
        return base_delay + jitter

# Usage example
client = Altus4Client('altus4_sk_live_abc123...')

try:
    results = client.search_with_retry('database optimization', ['db_abc123'])
    print(f"Search completed: {results['data']['summary']['totalResults']} results")

except Altus4Error as e:
    if e.is_rate_limit_error():
        retry_after = e.get_retry_after()
        print(f"Rate limited. Retry after {retry_after} seconds")
    elif e.is_authentication_error():
        print("Authentication failed. Check your API key.")
    elif e.is_authorization_error():
        print(f"Permission denied: {e.details}")
    else:
        print(f"API Error: {e.code} - {e.message}")
        if e.request_id:
            print(f"Request ID: {e.request_id}")

except Exception as e:
    print(f"Unexpected error: {e}")
```

## Troubleshooting Guide

### Common Issues and Solutions

#### Authentication Issues

**Problem**: `INVALID_API_KEY` error
**Solutions**:

1. Verify API key format: `altus4_sk_(live|test)_[token]`
2. Check for typos or extra spaces
3. Ensure using correct environment (live vs test)
4. Verify key hasn't been revoked

**Problem**: `INSUFFICIENT_PERMISSIONS` error
**Solutions**:

1. Check required permissions for the endpoint
2. Update API key permissions
3. Use different API key with appropriate permissions
4. Upgrade tier if feature requires higher tier

#### Connection Issues

**Problem**: `DATABASE_ERROR` - connection timeout
**Solutions**:

1. Check database server status
2. Verify network connectivity
3. Check database connection settings
4. Review database server logs

**Problem**: `AI_SERVICE_ERROR` - OpenAI API issues
**Solutions**:

1. Check OpenAI service status
2. Verify API key has sufficient credits
3. Implement fallback to non-semantic search
4. Retry with exponential backoff

#### Performance Issues

**Problem**: Slow response times
**Solutions**:

1. Check database indexes and optimization
2. Review query complexity
3. Enable caching
4. Monitor database performance

**Problem**: High error rates
**Solutions**:

1. Review error patterns in logs
2. Check database connectivity
3. Monitor service dependencies
4. Implement proper retry logic

### Debug Information

When reporting issues, include:

1. **Request ID** from error response
2. **Timestamp** of the error
3. **API key prefix** (first 20 characters)
4. **Complete error response**
5. **Request parameters** (without sensitive data)

### Error Logging

Implement comprehensive error logging:

```javascript
const logError = (error, context = {}) => {
  const logData = {
    timestamp: new Date().toISOString(),
    requestId: error.requestId,
    errorCode: error.code,
    errorMessage: error.message,
    statusCode: error.status,
    details: error.details,
    context: context,
    stack: error.stack,
  };

  console.error('Altus4 API Error:', JSON.stringify(logData, null, 2));

  // Send to monitoring service
  if (window.analytics) {
    window.analytics.track('API Error', logData);
  }
};
```

### Monitoring and Alerting

Set up monitoring for:

1. **Error Rates** - Alert when error rate exceeds threshold
2. **Authentication Failures** - Monitor for potential security issues
3. **Rate Limiting** - Track rate limit usage and patterns
4. **Service Errors** - Alert on external service failures
5. **Response Times** - Monitor performance degradation

---

**Next Steps**: [Rate Limiting](./rate-limiting.md) | [Search Operations](./search.md)
