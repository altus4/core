# 🔍 API Contract Testing Suite

This directory contains comprehensive API testing scripts that validate the Altus 4 API against its OpenAPI 3.0 specification.

## Scripts

### `api-contract-test.sh`

A comprehensive bash script that:

1. **Builds and starts** the Altus 4 application
2. **Loads the OpenAPI 3.0 specification** from `openapi/altus4.openapi.yaml`
3. **Tests every endpoint systematically** with both valid and invalid requests
4. **Validates request/response contracts** against the OpenAPI schema
5. **Generates detailed reports** in both JSON and HTML formats

## Features

- ✅ **Complete endpoint coverage** - Tests all 25+ API endpoints
- ✅ **Authentication testing** - Validates JWT and API key authentication flows
- ✅ **Input validation** - Tests field validation, length limits, and data types
- ✅ **Error handling** - Verifies proper HTTP status codes and error responses
- ✅ **Schema validation** - Ensures responses match OpenAPI specifications
- ✅ **Edge case testing** - Tests malformed requests, large payloads, invalid auth
- ✅ **Comprehensive reporting** - HTML dashboard and JSON results
- ✅ **Automated setup** - Handles database setup, test data creation, and cleanup

## Usage

### Quick Start

```bash
# Run the complete API contract test suite
./bin/test/api-contract-test.sh
```

### Advanced Usage

```bash
# Run with debug output
DEBUG=true ./bin/test/api-contract-test.sh

# Use custom API base URL
API_BASE_URL=https://staging-api.altus4.com ./bin/test/api-contract-test.sh

# Run tests against local development server
API_BASE_URL=http://localhost:3000 ./bin/test/api-contract-test.sh
```

## Environment Variables

| Variable            | Default                         | Description                             |
| ------------------- | ------------------------------- | --------------------------------------- |
| `API_BASE_URL`      | `http://localhost:3000`         | Base URL for the API server             |
| `OPENAPI_SPEC_FILE` | `./openapi/altus4.openapi.yaml` | Path to OpenAPI specification           |
| `DEBUG`             | `false`                         | Enable debug output for troubleshooting |

## Test Coverage

The script systematically tests:

### 🔐 Authentication Endpoints

- `POST /api/v1/auth/register` - User registration (valid/invalid/duplicate)
- `POST /api/v1/auth/login` - User login (valid/invalid credentials)
- `GET /api/v1/auth/profile` - Profile retrieval (with/without token)
- `PUT /api/v1/auth/profile` - Profile updates
- `POST /api/v1/auth/change-password` - Password changes
- `POST /api/v1/auth/refresh` - Token refresh
- `POST /api/v1/auth/logout` - User logout
- `DELETE /api/v1/auth/account` - Account deletion

### 🗄️ Database Endpoints

- `GET /api/v1/databases` - List database connections
- `POST /api/v1/databases` - Add new database connection
- `GET /api/v1/databases/{id}` - Get specific connection
- `PUT /api/v1/databases/{id}` - Update connection
- `DELETE /api/v1/databases/{id}` - Remove connection
- `POST /api/v1/databases/{id}/test` - Test connection
- `GET /api/v1/databases/{id}/schema` - Discover schema
- `GET /api/v1/databases/status` - Connection status

### 🔑 API Key Endpoints

- `POST /api/v1/keys` - Create API key (valid/invalid data)
- `GET /api/v1/keys` - List API keys
- `PUT /api/v1/keys/{id}` - Update API key
- `DELETE /api/v1/keys/{id}` - Revoke API key
- `POST /api/v1/keys/{id}/regenerate` - Regenerate key
- `GET /api/v1/keys/{id}/usage` - Get usage statistics

### 🔍 Search Endpoints

- `POST /api/v1/search` - Execute search (natural/boolean/semantic modes)
- `GET /api/v1/search/suggestions` - Get search suggestions
- `POST /api/v1/search/analyze` - Analyze search queries
- `GET /api/v1/search/trends` - Get search trends
- `GET /api/v1/search/history` - Get search history

### 📊 Analytics Endpoints

- `GET /api/v1/analytics/search-trends` - Search trend analysis
- `GET /api/v1/analytics/performance` - Performance metrics
- `GET /api/v1/analytics/popular-queries` - Popular query analysis
- `GET /api/v1/analytics/search-history` - Search history analytics
- `GET /api/v1/analytics/insights` - AI-generated insights
- `GET /api/v1/analytics/dashboard` - Dashboard data
- `GET /api/v1/analytics/admin/*` - Admin-only analytics

### 🎯 Edge Cases & Error Conditions

- **404 handling** - Non-existent endpoints
- **Malformed JSON** - Invalid request bodies
- **Large payloads** - Oversized requests
- **Invalid authentication** - Expired/malformed tokens
- **Permission validation** - Insufficient privileges
- **Rate limiting** - Request throttling
- **Input validation** - Field length limits, data types

## Output Reports

### HTML Report (`test-results/api-coverage-*.html`)

- **Visual dashboard** with pass/fail statistics
- **Progress bars** showing test completion percentage
- **Detailed test results table** with endpoints, methods, and errors
- **OpenAPI coverage summary** highlighting validated aspects
- **Mobile-responsive design** for easy viewing

### JSON Report (`test-results/api-contract-*.json`)

- **Machine-readable results** for CI/CD integration
- **Detailed test metadata** including timestamps and error details
- **Structured format** for automated analysis and reporting
- **Integration-friendly** for build pipelines and monitoring

## Test Data Setup

The script automatically creates:

- **Admin user** (`admin@test.com`) with full privileges
- **Regular user** (`user@test.com`) with standard permissions
- **API keys** with different permission sets and tiers
- **Database connections** for integration testing
- **Test data cleanup** after test completion

## Requirements

### System Dependencies

- **bash** (4.0+) - Shell environment
- **curl** - HTTP client for API requests
- **jq** - JSON parsing and manipulation
- **npm** - Node.js package manager

### Application Dependencies

- **Node.js** (20.0+) - Runtime environment
- **MySQL** - Database server for testing
- **Redis** - Cache server for sessions
- **All project dependencies** - Installed via `npm install`

### Optional Tools

- **swagger-codegen** - For OpenAPI specification validation
- **ajv-cli** - For advanced JSON schema validation

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: API Contract Tests
on: [push, pull_request]

jobs:
  api-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Start test services
        run: ./bin/dev-start

      - name: Run API contract tests
        run: ./bin/test/api-contract-test.sh

      - name: Upload test reports
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: api-test-reports
          path: test-results/
```

### Jenkins Pipeline Example

```groovy
pipeline {
    agent any
    stages {
        stage('API Contract Tests') {
            steps {
                sh 'npm ci'
                sh './bin/dev-start'
                sh './bin/test/api-contract-test.sh'
            }
            post {
                always {
                    publishHTML([
                        allowMissing: false,
                        alwaysLinkToLastBuild: true,
                        keepAll: true,
                        reportDir: 'test-results',
                        reportFiles: 'api-coverage-*.html',
                        reportName: 'API Contract Test Report'
                    ])
                }
            }
        }
    }
}
```

## Troubleshooting

### Common Issues

**Server startup timeout:**

```bash
# Increase timeout for slow environments
STARTUP_TIMEOUT=120 ./bin/test/api-contract-test.sh
```

**Database connection issues:**

```bash
# Ensure development environment is running
./bin/dev-start
# Check database credentials in .env
```

**Permission errors:**

```bash
# Ensure script is executable
chmod +x ./bin/test/api-contract-test.sh
```

**Missing dependencies:**

```bash
# Install required system packages
brew install jq curl        # macOS
apt-get install jq curl     # Ubuntu/Debian
```

### Debug Mode

Enable detailed debug output:

```bash
DEBUG=true ./bin/test/api-contract-test.sh
```

This shows:

- Detailed HTTP request/response logs
- JSON parsing and validation steps
- Authentication token handling
- Database connection attempts
- Test data creation process

## Extending the Test Suite

### Adding New Endpoint Tests

1. **Add test function** in the script:

```bash
test_new_endpoint() {
    print_header "🆕 TESTING NEW ENDPOINTS"

    local response
    response=$(make_request "GET" "/api/v1/new-endpoint" "Bearer ${TEST_TOKENS["admin"]}")

    # Add validation logic...
    log_test_result "GET /api/v1/new-endpoint" "PASS" "/api/v1/new-endpoint" "GET"
}
```

2. **Call the function** in `main()`:

```bash
test_new_endpoint
```

3. **Update OpenAPI spec** in `openapi/altus4.openapi.yaml`

### Custom Validation Rules

Extend the `validate_json_schema()` function:

```bash
validate_custom_schema() {
    local json_data="$1"
    local endpoint="$2"

    # Add custom validation logic
    if [[ "$endpoint" == "/api/v1/custom" ]]; then
        # Custom validation for specific endpoint
    fi
}
```

## Performance Considerations

- **Parallel execution** - Tests run sequentially for reliability
- **Connection reuse** - HTTP keep-alive for faster requests
- **Minimal test data** - Only essential data created
- **Automatic cleanup** - Resources freed after testing
- **Timeout handling** - Prevents hanging tests

## Security Testing

The script includes security-focused tests:

- **Authentication bypass attempts**
- **Authorization privilege escalation**
- **Input injection testing**
- **Rate limiting validation**
- **Token expiration handling**
- **CORS header validation**

## Maintenance

### Regular Updates

- **OpenAPI specification** - Keep in sync with API changes
- **Test data** - Update sample data as schemas evolve
- **Validation rules** - Enhance checks for new requirements
- **Error handling** - Add tests for new error conditions

### Version Compatibility

The script is designed to work with:

- **Altus 4 v0.3.0+** - Current version support
- **OpenAPI 3.0.3** - Specification format
- **Node.js 20+** - Runtime compatibility
- **MySQL 8.0+** - Database compatibility
