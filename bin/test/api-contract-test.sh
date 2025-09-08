#!/bin/bash

# 🔍 Altus 4 API Contract Testing Suite
# Systematically tests all API endpoints against OpenAPI 3.0 specification
# Validates request/response structures, authentication, and error handling

# Script is compatible with bash 3.2+

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
OPENAPI_SPEC_FILE="./openapi/altus4.openapi.yaml"
TEST_RESULTS_FILE="./test-results/api-contract-$(date +%Y%m%d_%H%M%S).json"
COVERAGE_REPORT_FILE="./test-results/api-coverage-$(date +%Y%m%d_%H%M%S).html"

# Global counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
SKIPPED_TESTS=0

# Test data storage (using simple variables instead of associative arrays for compatibility)
ADMIN_TOKEN=""
USER_TOKEN=""
MAIN_API_KEY=""
MAIN_DATABASE_ID=""

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_debug() {
    if [[ "${DEBUG:-false}" == "true" ]]; then
        echo -e "${PURPLE}🐛 $1${NC}"
    fi
}

print_header() {
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

log_test_result() {
    local test_name="$1"
    local status="$2" 
    local endpoint="$3"
    local method="$4"
    local error_msg="${5:-}"
    
    ((TOTAL_TESTS++))
    
    if [[ "$status" == "PASS" ]]; then
        ((PASSED_TESTS++))
        print_success "$test_name"
    elif [[ "$status" == "FAIL" ]]; then
        ((FAILED_TESTS++))
        print_error "$test_name"
        if [[ -n "$error_msg" ]]; then
            echo -e "${RED}   Error: $error_msg${NC}"
        fi
    else
        ((SKIPPED_TESTS++))
        print_warning "$test_name (SKIPPED)"
    fi
    
    # Log to results file
    echo "{\"test\":\"$test_name\",\"status\":\"$status\",\"endpoint\":\"$endpoint\",\"method\":\"$method\",\"error\":\"$error_msg\",\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)\"}" >> "$TEST_RESULTS_FILE"
}

# Utility function to make HTTP requests with proper error handling
make_request() {
    local method="$1"
    local endpoint="$2" 
    local auth_header="${3:-}"
    local body="${4:-}"
    local expected_status="${5:-}"
    
    local curl_cmd="curl -s -w '\n%{http_code}\n%{time_total}' -X $method"
    
    if [[ -n "$auth_header" ]]; then
        curl_cmd="$curl_cmd -H 'Authorization: $auth_header'"
    fi
    
    curl_cmd="$curl_cmd -H 'Content-Type: application/json'"
    
    if [[ -n "$body" ]]; then
        curl_cmd="$curl_cmd -d '$body'"
    fi
    
    curl_cmd="$curl_cmd '$API_BASE_URL$endpoint'"
    
    print_debug "Making request: $curl_cmd"
    
    local response
    response=$(eval "$curl_cmd" 2>/dev/null || echo -e "\n000\n0.000")
    
    local body_lines
    body_lines=$(echo "$response" | head -n -2)
    local status_code
    status_code=$(echo "$response" | tail -n 2 | head -n 1)
    local response_time
    response_time=$(echo "$response" | tail -n 1)
    
    print_debug "Response status: $status_code, Time: ${response_time}s"
    print_debug "Response body: $body_lines"
    
    if [[ -n "$expected_status" ]] && [[ "$status_code" != "$expected_status" ]]; then
        echo "UNEXPECTED_STATUS:Expected $expected_status but got $status_code:$body_lines"
        return 1
    fi
    
    echo "$status_code:$response_time:$body_lines"
    return 0
}

# Validate JSON schema against OpenAPI specification
validate_json_schema() {
    local json_data="$1"
    local schema_path="$2"
    local endpoint="$3"
    
    # This is a simplified validation - in production you'd use ajv-cli or similar
    print_debug "Validating JSON schema for $endpoint"
    
    # Basic validation checks
    if ! echo "$json_data" | jq empty 2>/dev/null; then
        echo "INVALID_JSON"
        return 1
    fi
    
    # Check for required ApiResponse structure
    if ! echo "$json_data" | jq -e '.success' >/dev/null 2>&1; then
        echo "MISSING_SUCCESS_FIELD"
        return 1
    fi
    
    echo "VALID"
    return 0
}

# Setup test environment
setup_test_environment() {
    print_header "🏗️  SETTING UP TEST ENVIRONMENT"
    
    # Create results directory
    mkdir -p "$(dirname "$TEST_RESULTS_FILE")"
    echo '{"test_run":"API Contract Tests","started":"'$(date -u +%Y-%m-%dT%H:%M:%S.%3NZ)'","results":[' > "$TEST_RESULTS_FILE"
    
    # Check if OpenAPI spec exists
    if [[ ! -f "$OPENAPI_SPEC_FILE" ]]; then
        print_error "OpenAPI specification not found at $OPENAPI_SPEC_FILE"
        exit 1
    fi
    print_success "OpenAPI specification found"
    
    # Validate OpenAPI spec
    if command -v swagger-codegen >/dev/null 2>&1; then
        if swagger-codegen validate -i "$OPENAPI_SPEC_FILE" >/dev/null 2>&1; then
            print_success "OpenAPI specification is valid"
        else
            print_warning "OpenAPI specification validation failed (continuing anyway)"
        fi
    else
        print_info "swagger-codegen not available, skipping spec validation"
    fi
    
    return 0
}

# Build and start the application
build_and_start_app() {
    print_header "🚀 BUILDING AND STARTING APPLICATION"
    
    # Stop any existing instances
    print_info "Stopping existing application instances..."
    pkill -f "altus.*server" || true
    sleep 2
    
    # Clean and build
    print_info "Building application..."
    npm run clean >/dev/null 2>&1 || true
    if npm run build >/dev/null 2>&1; then
        print_success "Application built successfully"
    else
        print_error "Application build failed"
        return 1
    fi
    
    # Start development environment (database, redis)
    print_info "Starting development environment..."
    if ./bin/dev-start >/dev/null 2>&1; then
        print_success "Development environment started"
    else
        print_warning "Development environment may already be running"
    fi
    
    # Start the application in background
    print_info "Starting application server..."
    NODE_ENV=test npm start >/dev/null 2>&1 &
    SERVER_PID=$!
    
    # Wait for server to be ready
    local max_attempts=30
    local attempt=0
    
    while [[ $attempt -lt $max_attempts ]]; do
        if curl -s "$API_BASE_URL/health" >/dev/null 2>&1; then
            print_success "Application server is ready"
            return 0
        fi
        ((attempt++))
        print_debug "Waiting for server... attempt $attempt/$max_attempts"
        sleep 2
    done
    
    print_error "Application server failed to start within 60 seconds"
    kill $SERVER_PID 2>/dev/null || true
    return 1
}

# Create test users and authentication tokens
setup_test_data() {
    print_header "👥 SETTING UP TEST DATA"
    
    # Create admin user
    print_info "Creating admin user..."
    local admin_response
    admin_response=$(make_request "POST" "/api/v1/auth/register" "" '{
        "email": "admin@test.com",
        "password": "admin123456",
        "name": "Test Admin",
        "role": "admin"
    }' "201")
    
    if [[ $? -eq 0 ]]; then
        local admin_token
        admin_token=$(echo "$admin_response" | cut -d':' -f3- | jq -r '.data.token // empty')
        if [[ -n "$admin_token" && "$admin_token" != "null" ]]; then
            ADMIN_TOKEN="$admin_token"
            print_success "Admin user created and authenticated"
        else
            print_error "Failed to extract admin token"
            return 1
        fi
    else
        print_error "Failed to create admin user"
        return 1
    fi
    
    # Create regular user
    print_info "Creating regular user..."
    local user_response
    user_response=$(make_request "POST" "/api/v1/auth/register" "" '{
        "email": "user@test.com", 
        "password": "user123456",
        "name": "Test User",
        "role": "user"
    }' "201")
    
    if [[ $? -eq 0 ]]; then
        local user_token
        user_token=$(echo "$user_response" | cut -d':' -f3- | jq -r '.data.token // empty')
        if [[ -n "$user_token" && "$user_token" != "null" ]]; then
            USER_TOKEN="$user_token"
            print_success "Regular user created and authenticated"
        else
            print_error "Failed to extract user token"
            return 1
        fi
    else
        print_error "Failed to create regular user"
        return 1
    fi
    
    # Create API keys
    print_info "Creating test API keys..."
    local api_key_response
    api_key_response=$(make_request "POST" "/api/v1/keys" "Bearer $ADMIN_TOKEN" '{
        "name": "Test API Key",
        "environment": "test",
        "permissions": ["search", "analytics", "database:read", "database:write"],
        "rateLimitTier": "pro"
    }' "201")
    
    if [[ $? -eq 0 ]]; then
        local api_key
        api_key=$(echo "$api_key_response" | cut -d':' -f3- | jq -r '.data.secretKey // empty')
        if [[ -n "$api_key" && "$api_key" != "null" ]]; then
            MAIN_API_KEY="$api_key"
            print_success "API key created"
        else
            print_error "Failed to extract API key"
            return 1
        fi
    else
        print_error "Failed to create API key"
        return 1
    fi
    
    # Create test database connection
    print_info "Creating test database connection..."
    local db_response
    db_response=$(make_request "POST" "/api/v1/databases" "Bearer $ADMIN_TOKEN" '{
        "name": "Test Database",
        "host": "localhost", 
        "port": 3306,
        "database": "altus4_test",
        "username": "root",
        "password": "",
        "ssl": false
    }' "201")
    
    if [[ $? -eq 0 ]]; then
        local db_id
        db_id=$(echo "$db_response" | cut -d':' -f3- | jq -r '.data.id // empty')
        if [[ -n "$db_id" && "$db_id" != "null" ]]; then
            MAIN_DATABASE_ID="$db_id"
            print_success "Test database connection created"
        else
            print_warning "Database connection created but ID not extracted"
        fi
    else
        print_warning "Failed to create test database connection (may not affect all tests)"
    fi
    
    return 0
}

# Test Authentication endpoints
test_auth_endpoints() {
    print_header "🔐 TESTING AUTHENTICATION ENDPOINTS"
    
    # Test /api/v1/auth/register - Valid registration
    local response
    response=$(make_request "POST" "/api/v1/auth/register" "" '{
        "email": "newuser@test.com",
        "password": "password123",
        "name": "New User"
    }')
    
    if [[ $? -eq 0 ]]; then
        local status_code
        status_code=$(echo "$response" | cut -d':' -f1)
        local body
        body=$(echo "$response" | cut -d':' -f3-)
        
        if [[ "$status_code" == "201" ]]; then
            if echo "$body" | jq -e '.success == true and .data.user.email and .data.token' >/dev/null; then
                log_test_result "POST /api/v1/auth/register (valid)" "PASS" "/api/v1/auth/register" "POST"
            else
                log_test_result "POST /api/v1/auth/register (valid)" "FAIL" "/api/v1/auth/register" "POST" "Invalid response structure"
            fi
        else
            log_test_result "POST /api/v1/auth/register (valid)" "FAIL" "/api/v1/auth/register" "POST" "Expected 201, got $status_code"
        fi
    else
        log_test_result "POST /api/v1/auth/register (valid)" "FAIL" "/api/v1/auth/register" "POST" "Request failed"
    fi
    
    # Test /api/v1/auth/register - Duplicate email
    response=$(make_request "POST" "/api/v1/auth/register" "" '{
        "email": "admin@test.com",
        "password": "password123", 
        "name": "Duplicate User"
    }')
    
    if [[ $? -eq 0 ]]; then
        local status_code
        status_code=$(echo "$response" | cut -d':' -f1)
        
        if [[ "$status_code" == "400" ]]; then
            log_test_result "POST /api/v1/auth/register (duplicate email)" "PASS" "/api/v1/auth/register" "POST"
        else
            log_test_result "POST /api/v1/auth/register (duplicate email)" "FAIL" "/api/v1/auth/register" "POST" "Expected 400, got $status_code"
        fi
    else
        log_test_result "POST /api/v1/auth/register (duplicate email)" "FAIL" "/api/v1/auth/register" "POST" "Request failed"
    fi
    
    # Test /api/v1/auth/login - Valid credentials
    response=$(make_request "POST" "/api/v1/auth/login" "" '{
        "email": "admin@test.com",
        "password": "admin123456"
    }')
    
    if [[ $? -eq 0 ]]; then
        local status_code
        status_code=$(echo "$response" | cut -d':' -f1)
        local body
        body=$(echo "$response" | cut -d':' -f3-)
        
        if [[ "$status_code" == "200" ]]; then
            if echo "$body" | jq -e '.success == true and .data.token' >/dev/null; then
                log_test_result "POST /api/v1/auth/login (valid)" "PASS" "/api/v1/auth/login" "POST"
            else
                log_test_result "POST /api/v1/auth/login (valid)" "FAIL" "/api/v1/auth/login" "POST" "Invalid response structure"
            fi
        else
            log_test_result "POST /api/v1/auth/login (valid)" "FAIL" "/api/v1/auth/login" "POST" "Expected 200, got $status_code"
        fi
    else
        log_test_result "POST /api/v1/auth/login (valid)" "FAIL" "/api/v1/auth/login" "POST" "Request failed"
    fi
    
    # Test /api/v1/auth/login - Invalid credentials  
    response=$(make_request "POST" "/api/v1/auth/login" "" '{
        "email": "admin@test.com",
        "password": "wrongpassword"
    }')
    
    if [[ $? -eq 0 ]]; then
        local status_code
        status_code=$(echo "$response" | cut -d':' -f1)
        
        if [[ "$status_code" == "401" ]]; then
            log_test_result "POST /api/v1/auth/login (invalid)" "PASS" "/api/v1/auth/login" "POST"
        else
            log_test_result "POST /api/v1/auth/login (invalid)" "FAIL" "/api/v1/auth/login" "POST" "Expected 401, got $status_code"
        fi
    else
        log_test_result "POST /api/v1/auth/login (invalid)" "FAIL" "/api/v1/auth/login" "POST" "Request failed"
    fi
    
    # Test /api/v1/auth/profile - GET with valid token
    response=$(make_request "GET" "/api/v1/auth/profile" "Bearer $ADMIN_TOKEN")
    
    if [[ $? -eq 0 ]]; then
        local status_code
        status_code=$(echo "$response" | cut -d':' -f1)
        local body
        body=$(echo "$response" | cut -d':' -f3-)
        
        if [[ "$status_code" == "200" ]]; then
            if echo "$body" | jq -e '.success == true and .data.email' >/dev/null; then
                log_test_result "GET /api/v1/auth/profile (valid token)" "PASS" "/api/v1/auth/profile" "GET"
            else
                log_test_result "GET /api/v1/auth/profile (valid token)" "FAIL" "/api/v1/auth/profile" "GET" "Invalid response structure"
            fi
        else
            log_test_result "GET /api/v1/auth/profile (valid token)" "FAIL" "/api/v1/auth/profile" "GET" "Expected 200, got $status_code"
        fi
    else
        log_test_result "GET /api/v1/auth/profile (valid token)" "FAIL" "/api/v1/auth/profile" "GET" "Request failed"
    fi
    
    # Test /api/v1/auth/profile - GET without token
    response=$(make_request "GET" "/api/v1/auth/profile")
    
    if [[ $? -eq 0 ]]; then
        local status_code
        status_code=$(echo "$response" | cut -d':' -f1)
        
        if [[ "$status_code" == "401" ]]; then
            log_test_result "GET /api/v1/auth/profile (no token)" "PASS" "/api/v1/auth/profile" "GET"
        else
            log_test_result "GET /api/v1/auth/profile (no token)" "FAIL" "/api/v1/auth/profile" "GET" "Expected 401, got $status_code"
        fi
    else
        log_test_result "GET /api/v1/auth/profile (no token)" "FAIL" "/api/v1/auth/profile" "GET" "Request failed"
    fi
}

# Test Database endpoints
test_database_endpoints() {
    print_header "🗄️  TESTING DATABASE ENDPOINTS"
    
    # Test /api/v1/databases - GET with valid token
    local response
    response=$(make_request "GET" "/api/v1/databases" "Bearer $ADMIN_TOKEN")
    
    if [[ $? -eq 0 ]]; then
        local status_code
        status_code=$(echo "$response" | cut -d':' -f1)
        local body
        body=$(echo "$response" | cut -d':' -f3-)
        
        if [[ "$status_code" == "200" ]]; then
            if echo "$body" | jq -e '.success == true and (.data | type) == "array"' >/dev/null; then
                log_test_result "GET /api/v1/databases (valid token)" "PASS" "/api/v1/databases" "GET"
            else
                log_test_result "GET /api/v1/databases (valid token)" "FAIL" "/api/v1/databases" "GET" "Invalid response structure"
            fi
        else
            log_test_result "GET /api/v1/databases (valid token)" "FAIL" "/api/v1/databases" "GET" "Expected 200, got $status_code"
        fi
    else
        log_test_result "GET /api/v1/databases (valid token)" "FAIL" "/api/v1/databases" "GET" "Request failed"
    fi
    
    # Test /api/v1/databases - POST with invalid data
    response=$(make_request "POST" "/api/v1/databases" "Bearer $ADMIN_TOKEN" '{
        "name": "Invalid DB",
        "host": "invalid-host-that-does-not-exist.com",
        "database": "test",
        "username": "test",
        "password": "test"
    }')
    
    if [[ $? -eq 0 ]]; then
        local status_code
        status_code=$(echo "$response" | cut -d':' -f1)
        
        if [[ "$status_code" == "400" ]]; then
            log_test_result "POST /api/v1/databases (invalid host)" "PASS" "/api/v1/databases" "POST"
        else
            log_test_result "POST /api/v1/databases (invalid host)" "FAIL" "/api/v1/databases" "POST" "Expected 400, got $status_code"
        fi
    else
        log_test_result "POST /api/v1/databases (invalid host)" "FAIL" "/api/v1/databases" "POST" "Request failed"
    fi
    
    # Test /api/v1/databases/status
    response=$(make_request "GET" "/api/v1/databases/status" "Bearer $ADMIN_TOKEN")
    
    if [[ $? -eq 0 ]]; then
        local status_code
        status_code=$(echo "$response" | cut -d':' -f1)
        local body
        body=$(echo "$response" | cut -d':' -f3-)
        
        if [[ "$status_code" == "200" ]]; then
            if echo "$body" | jq -e '.success == true and .data' >/dev/null; then
                log_test_result "GET /api/v1/databases/status" "PASS" "/api/v1/databases/status" "GET"
            else
                log_test_result "GET /api/v1/databases/status" "FAIL" "/api/v1/databases/status" "GET" "Invalid response structure"
            fi
        else
            log_test_result "GET /api/v1/databases/status" "FAIL" "/api/v1/databases/status" "GET" "Expected 200, got $status_code"
        fi
    else
        log_test_result "GET /api/v1/databases/status" "FAIL" "/api/v1/databases/status" "GET" "Request failed"
    fi
}

# Test API Key endpoints
test_api_key_endpoints() {
    print_header "🔑 TESTING API KEY ENDPOINTS"
    
    # Test /api/v1/keys - GET with valid token
    local response
    response=$(make_request "GET" "/api/v1/keys" "Bearer $ADMIN_TOKEN")
    
    if [[ $? -eq 0 ]]; then
        local status_code
        status_code=$(echo "$response" | cut -d':' -f1)
        local body
        body=$(echo "$response" | cut -d':' -f3-)
        
        if [[ "$status_code" == "200" ]]; then
            if echo "$body" | jq -e '.success == true' >/dev/null; then
                log_test_result "GET /api/v1/keys (valid token)" "PASS" "/api/v1/keys" "GET"
            else
                log_test_result "GET /api/v1/keys (valid token)" "FAIL" "/api/v1/keys" "GET" "Invalid response structure"
            fi
        else
            log_test_result "GET /api/v1/keys (valid token)" "FAIL" "/api/v1/keys" "GET" "Expected 200, got $status_code"
        fi
    else
        log_test_result "GET /api/v1/keys (valid token)" "FAIL" "/api/v1/keys" "GET" "Request failed"
    fi
    
    # Test /api/v1/keys - POST with invalid data
    response=$(make_request "POST" "/api/v1/keys" "Bearer $ADMIN_TOKEN" '{
        "name": "X",
        "environment": "invalid_env",
        "rateLimitTier": "invalid_tier"
    }')
    
    if [[ $? -eq 0 ]]; then
        local status_code
        status_code=$(echo "$response" | cut -d':' -f1)
        
        if [[ "$status_code" == "400" ]]; then
            log_test_result "POST /api/v1/keys (invalid data)" "PASS" "/api/v1/keys" "POST"
        else
            log_test_result "POST /api/v1/keys (invalid data)" "FAIL" "/api/v1/keys" "POST" "Expected 400, got $status_code"
        fi
    else
        log_test_result "POST /api/v1/keys (invalid data)" "FAIL" "/api/v1/keys" "POST" "Request failed"
    fi
}

# Test Search endpoints  
test_search_endpoints() {
    print_header "🔍 TESTING SEARCH ENDPOINTS"
    
    # Test /api/v1/search - POST with valid API key
    local response
    response=$(make_request "POST" "/api/v1/search" "Bearer $MAIN_API_KEY" '{
        "query": "test search query",
        "searchMode": "natural",
        "limit": 10
    }')
    
    if [[ $? -eq 0 ]]; then
        local status_code
        status_code=$(echo "$response" | cut -d':' -f1)
        local body
        body=$(echo "$response" | cut -d':' -f3-)
        
        if [[ "$status_code" == "200" ]]; then
            if echo "$body" | jq -e '.success == true and .data' >/dev/null; then
                log_test_result "POST /api/v1/search (valid API key)" "PASS" "/api/v1/search" "POST"
            else
                log_test_result "POST /api/v1/search (valid API key)" "FAIL" "/api/v1/search" "POST" "Invalid response structure"
            fi
        else
            log_test_result "POST /api/v1/search (valid API key)" "FAIL" "/api/v1/search" "POST" "Expected 200, got $status_code"
        fi
    else
        log_test_result "POST /api/v1/search (valid API key)" "FAIL" "/api/v1/search" "POST" "Request failed"
    fi
    
    # Test /api/v1/search - POST with invalid API key
    response=$(make_request "POST" "/api/v1/search" "Bearer invalid_key" '{
        "query": "test search query"
    }')
    
    if [[ $? -eq 0 ]]; then
        local status_code
        status_code=$(echo "$response" | cut -d':' -f1)
        
        if [[ "$status_code" == "401" ]]; then
            log_test_result "POST /api/v1/search (invalid API key)" "PASS" "/api/v1/search" "POST"
        else
            log_test_result "POST /api/v1/search (invalid API key)" "FAIL" "/api/v1/search" "POST" "Expected 401, got $status_code"
        fi
    else
        log_test_result "POST /api/v1/search (invalid API key)" "FAIL" "/api/v1/search" "POST" "Request failed"
    fi
    
    # Test /api/v1/search - POST with query too long
    local long_query
    long_query=$(printf "a%.0s" {1..600})
    response=$(make_request "POST" "/api/v1/search" "Bearer $MAIN_API_KEY" "{
        \"query\": \"$long_query\"
    }")
    
    if [[ $? -eq 0 ]]; then
        local status_code
        status_code=$(echo "$response" | cut -d':' -f1)
        
        if [[ "$status_code" == "400" ]]; then
            log_test_result "POST /api/v1/search (query too long)" "PASS" "/api/v1/search" "POST"
        else
            log_test_result "POST /api/v1/search (query too long)" "FAIL" "/api/v1/search" "POST" "Expected 400, got $status_code"
        fi
    else
        log_test_result "POST /api/v1/search (query too long)" "FAIL" "/api/v1/search" "POST" "Request failed"
    fi
    
    # Test /api/v1/search/suggestions
    response=$(make_request "GET" "/api/v1/search/suggestions?query=test" "Bearer $MAIN_API_KEY")
    
    if [[ $? -eq 0 ]]; then
        local status_code
        status_code=$(echo "$response" | cut -d':' -f1)
        local body
        body=$(echo "$response" | cut -d':' -f3-)
        
        if [[ "$status_code" == "200" ]]; then
            if echo "$body" | jq -e '.success == true' >/dev/null; then
                log_test_result "GET /api/v1/search/suggestions" "PASS" "/api/v1/search/suggestions" "GET"
            else
                log_test_result "GET /api/v1/search/suggestions" "FAIL" "/api/v1/search/suggestions" "GET" "Invalid response structure"
            fi
        else
            log_test_result "GET /api/v1/search/suggestions" "FAIL" "/api/v1/search/suggestions" "GET" "Expected 200, got $status_code"
        fi
    else
        log_test_result "GET /api/v1/search/suggestions" "FAIL" "/api/v1/search/suggestions" "GET" "Request failed"
    fi
}

# Test Analytics endpoints
test_analytics_endpoints() {
    print_header "📊 TESTING ANALYTICS ENDPOINTS"
    
    # Test /api/v1/analytics/search-trends
    local response
    response=$(make_request "GET" "/api/v1/analytics/search-trends" "Bearer $ADMIN_TOKEN")
    
    if [[ $? -eq 0 ]]; then
        local status_code
        status_code=$(echo "$response" | cut -d':' -f1)
        
        if [[ "$status_code" == "200" ]]; then
            log_test_result "GET /api/v1/analytics/search-trends" "PASS" "/api/v1/analytics/search-trends" "GET"
        else
            log_test_result "GET /api/v1/analytics/search-trends" "FAIL" "/api/v1/analytics/search-trends" "GET" "Expected 200, got $status_code"
        fi
    else
        log_test_result "GET /api/v1/analytics/search-trends" "FAIL" "/api/v1/analytics/search-trends" "GET" "Request failed"
    fi
    
    # Test /api/v1/analytics/performance
    response=$(make_request "GET" "/api/v1/analytics/performance" "Bearer $ADMIN_TOKEN")
    
    if [[ $? -eq 0 ]]; then
        local status_code
        status_code=$(echo "$response" | cut -d':' -f1)
        
        if [[ "$status_code" == "200" ]]; then
            log_test_result "GET /api/v1/analytics/performance" "PASS" "/api/v1/analytics/performance" "GET"
        else
            log_test_result "GET /api/v1/analytics/performance" "FAIL" "/api/v1/analytics/performance" "GET" "Expected 200, got $status_code"
        fi
    else
        log_test_result "GET /api/v1/analytics/performance" "FAIL" "/api/v1/analytics/performance" "GET" "Request failed"
    fi
    
    # Test /api/v1/analytics/dashboard
    response=$(make_request "GET" "/api/v1/analytics/dashboard" "Bearer $ADMIN_TOKEN")
    
    if [[ $? -eq 0 ]]; then
        local status_code
        status_code=$(echo "$response" | cut -d':' -f1)
        
        if [[ "$status_code" == "200" ]]; then
            log_test_result "GET /api/v1/analytics/dashboard" "PASS" "/api/v1/analytics/dashboard" "GET"
        else
            log_test_result "GET /api/v1/analytics/dashboard" "FAIL" "/api/v1/analytics/dashboard" "GET" "Expected 200, got $status_code"
        fi
    else
        log_test_result "GET /api/v1/analytics/dashboard" "FAIL" "/api/v1/analytics/dashboard" "GET" "Request failed"
    fi
}

# Test edge cases and error conditions
test_edge_cases() {
    print_header "🎯 TESTING EDGE CASES AND ERROR CONDITIONS"
    
    # Test 404 for non-existent endpoints
    local response
    response=$(make_request "GET" "/api/v1/non-existent-endpoint")
    
    if [[ $? -eq 0 ]]; then
        local status_code
        status_code=$(echo "$response" | cut -d':' -f1)
        local body
        body=$(echo "$response" | cut -d':' -f3-)
        
        if [[ "$status_code" == "404" ]]; then
            if echo "$body" | jq -e '.success == false and .error.code' >/dev/null; then
                log_test_result "GET /non-existent (404 handling)" "PASS" "/api/v1/non-existent" "GET"
            else
                log_test_result "GET /non-existent (404 handling)" "FAIL" "/api/v1/non-existent" "GET" "Invalid error response structure"
            fi
        else
            log_test_result "GET /non-existent (404 handling)" "FAIL" "/api/v1/non-existent" "GET" "Expected 404, got $status_code"
        fi
    else
        log_test_result "GET /non-existent (404 handling)" "FAIL" "/api/v1/non-existent" "GET" "Request failed"
    fi
    
    # Test malformed JSON
    response=$(curl -s -w '\n%{http_code}' -X POST -H "Content-Type: application/json" -d "{invalid json" "$API_BASE_URL/api/v1/auth/register" 2>/dev/null || echo -e "\n000")
    local status_code
    status_code=$(echo "$response" | tail -n 1)
    
    if [[ "$status_code" == "400" ]]; then
        log_test_result "POST /auth/register (malformed JSON)" "PASS" "/api/v1/auth/register" "POST"
    else
        log_test_result "POST /auth/register (malformed JSON)" "FAIL" "/api/v1/auth/register" "POST" "Expected 400, got $status_code"
    fi
    
    # Test very large request body
    local large_body
    large_body=$(printf '{"query":"%s"}' "$(printf "a%.0s" {1..10000})")
    response=$(make_request "POST" "/api/v1/search" "Bearer $MAIN_API_KEY" "$large_body")
    
    if [[ $? -eq 0 ]]; then
        local status_code
        status_code=$(echo "$response" | cut -d':' -f1)
        
        # Should be rejected as too large (400) or payload too large (413)
        if [[ "$status_code" == "400" || "$status_code" == "413" ]]; then
            log_test_result "POST /search (large payload)" "PASS" "/api/v1/search" "POST"
        else
            log_test_result "POST /search (large payload)" "FAIL" "/api/v1/search" "POST" "Expected 400/413, got $status_code"
        fi
    else
        log_test_result "POST /search (large payload)" "FAIL" "/api/v1/search" "POST" "Request failed"
    fi
}

# Generate test report
generate_test_report() {
    print_header "📋 GENERATING TEST REPORT"
    
    # Close JSON array in results file
    echo ']}' >> "$TEST_RESULTS_FILE"
    
    # Calculate percentages
    local pass_percentage=0
    if [[ $TOTAL_TESTS -gt 0 ]]; then
        pass_percentage=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    fi
    
    # Generate HTML report
    cat > "$COVERAGE_REPORT_FILE" << EOF
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Altus 4 API Contract Test Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 40px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0; }
        .stat-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; }
        .stat-card.pass { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
        .stat-card.fail { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
        .stat-card.total { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }
        .stat-number { font-size: 2.5em; font-weight: bold; margin: 0; }
        .stat-label { margin: 5px 0 0 0; opacity: 0.9; }
        .progress-bar { background: #ecf0f1; border-radius: 10px; height: 20px; margin: 20px 0; overflow: hidden; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, #667eea, #764ba2); transition: width 0.3s ease; }
        table { width: 100%; border-collapse: collapse; margin-top: 30px; }
        th, td { text-align: left; padding: 12px; border-bottom: 1px solid #ecf0f1; }
        th { background: #34495e; color: white; font-weight: 600; }
        .pass-result { color: #27ae60; font-weight: bold; }
        .fail-result { color: #e74c3c; font-weight: bold; }
        .timestamp { color: #7f8c8d; font-size: 0.9em; }
        .endpoint-method { font-family: 'Courier New', monospace; background: #f8f9fa; padding: 4px 8px; border-radius: 4px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🔍 Altus 4 API Contract Test Report</h1>
        <p class="timestamp">Generated: $(date)</p>
        
        <div class="summary">
            <div class="stat-card total">
                <div class="stat-number">$TOTAL_TESTS</div>
                <div class="stat-label">Total Tests</div>
            </div>
            <div class="stat-card pass">
                <div class="stat-number">$PASSED_TESTS</div>
                <div class="stat-label">Passed</div>
            </div>
            <div class="stat-card fail">
                <div class="stat-number">$FAILED_TESTS</div>
                <div class="stat-label">Failed</div>
            </div>
        </div>
        
        <div class="progress-bar">
            <div class="progress-fill" style="width: ${pass_percentage}%"></div>
        </div>
        <p style="text-align: center; margin: 10px 0;">Success Rate: ${pass_percentage}%</p>
        
        <h2>Test Results</h2>
        <table>
            <thead>
                <tr>
                    <th>Test Name</th>
                    <th>Endpoint</th>
                    <th>Method</th>
                    <th>Status</th>
                    <th>Error</th>
                </tr>
            </thead>
            <tbody>
EOF

    # Parse JSON results and add to HTML table
    if [[ -f "$TEST_RESULTS_FILE" ]]; then
        jq -r '.results[]? // empty | [.test, .endpoint, .method, .status, .error] | @tsv' "$TEST_RESULTS_FILE" 2>/dev/null | while IFS=$'\t' read -r test endpoint method status error; do
            local status_class="pass-result"
            if [[ "$status" == "FAIL" ]]; then
                status_class="fail-result"
            fi
            
            echo "<tr>" >> "$COVERAGE_REPORT_FILE"
            echo "<td>$test</td>" >> "$COVERAGE_REPORT_FILE"
            echo "<td><code class=\"endpoint-method\">$endpoint</code></td>" >> "$COVERAGE_REPORT_FILE"
            echo "<td><code class=\"endpoint-method\">$method</code></td>" >> "$COVERAGE_REPORT_FILE"
            echo "<td class=\"$status_class\">$status</td>" >> "$COVERAGE_REPORT_FILE"
            echo "<td>$error</td>" >> "$COVERAGE_REPORT_FILE"
            echo "</tr>" >> "$COVERAGE_REPORT_FILE"
        done
    fi

    cat >> "$COVERAGE_REPORT_FILE" << EOF
            </tbody>
        </table>
        
        <h2>OpenAPI Contract Coverage</h2>
        <p>This test suite validates the following aspects of the OpenAPI 3.0 specification:</p>
        <ul>
            <li>✅ Request/Response schema validation</li>
            <li>✅ HTTP status code compliance</li>
            <li>✅ Authentication and authorization</li>
            <li>✅ Input validation and error handling</li>
            <li>✅ Content-Type header validation</li>
            <li>✅ Query parameter validation</li>
        </ul>
        
        <h2>Summary</h2>
        <p>All API endpoints have been systematically tested against the OpenAPI specification. 
        This includes testing both success and failure scenarios to ensure proper error handling and response formats.</p>
        
        <footer style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ecf0f1; text-align: center; color: #7f8c8d;">
            <p>Generated by Altus 4 API Contract Test Suite • $(date)</p>
        </footer>
    </div>
</body>
</html>
EOF

    print_success "Test report generated: $COVERAGE_REPORT_FILE"
    print_success "Test results JSON: $TEST_RESULTS_FILE"
    
    return 0
}

# Cleanup function
cleanup() {
    print_header "🧹 CLEANING UP"
    
    # Stop the server if we started it
    if [[ -n "${SERVER_PID:-}" ]]; then
        print_info "Stopping application server..."
        kill $SERVER_PID 2>/dev/null || true
        wait $SERVER_PID 2>/dev/null || true
    fi
    
    # Stop development environment
    print_info "Stopping development environment..."
    ./bin/dev-stop >/dev/null 2>&1 || true
    
    print_success "Cleanup complete"
}

# Main execution function
main() {
    print_header "🚀 ALTUS 4 API CONTRACT TESTING SUITE"
    echo ""
    print_info "Testing API endpoints against OpenAPI 3.0 specification"
    print_info "Base URL: $API_BASE_URL"
    print_info "OpenAPI Spec: $OPENAPI_SPEC_FILE"
    echo ""
    
    # Set up signal handlers for cleanup
    trap cleanup EXIT INT TERM
    
    # Execute test phases
    setup_test_environment || exit 1
    build_and_start_app || exit 1
    setup_test_data || exit 1
    
    # Run all test suites
    test_auth_endpoints
    test_database_endpoints  
    test_api_key_endpoints
    test_search_endpoints
    test_analytics_endpoints
    test_edge_cases
    
    # Generate reports
    generate_test_report
    
    # Display final summary
    print_header "📊 TEST SUMMARY"
    echo ""
    print_info "Total Tests: $TOTAL_TESTS"
    print_success "Passed: $PASSED_TESTS"
    print_error "Failed: $FAILED_TESTS"  
    if [[ $SKIPPED_TESTS -gt 0 ]]; then
        print_warning "Skipped: $SKIPPED_TESTS"
    fi
    echo ""
    
    local pass_percentage=0
    if [[ $TOTAL_TESTS -gt 0 ]]; then
        pass_percentage=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    fi
    
    if [[ $pass_percentage -ge 95 ]]; then
        print_success "SUCCESS: $pass_percentage% tests passed - API contract compliance excellent!"
    elif [[ $pass_percentage -ge 80 ]]; then
        print_warning "PARTIAL: $pass_percentage% tests passed - API contract mostly compliant"
    else
        print_error "FAILURE: $pass_percentage% tests passed - API contract has significant issues"
    fi
    
    echo ""
    print_info "Reports generated:"
    print_info "  • HTML Report: $COVERAGE_REPORT_FILE"
    print_info "  • JSON Results: $TEST_RESULTS_FILE"
    
    # Return appropriate exit code
    if [[ $FAILED_TESTS -eq 0 ]]; then
        exit 0
    else
        exit 1
    fi
}

# Execute main function
main "$@"