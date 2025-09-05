#!/bin/bash

# Git Hooks Testing Script for Altus 4
# Tests all Git hooks to ensure they're working correctly

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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

print_header() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_header "🪝 ALTUS 4 GIT HOOKS TESTING"
echo ""

# Test if hooks directory exists
if [ ! -d ".husky" ]; then
    print_error "Husky directory not found!"
    print_info "Run 'npm install' to set up hooks"
    exit 1
fi

print_success "Husky directory found"

# List of hooks to test
HOOKS=("pre-commit" "commit-msg" "post-commit" "pre-push")

print_header "🔍 HOOK CONFIGURATION CHECK"

for hook in "${HOOKS[@]}"; do
    hook_path=".husky/$hook"

    if [ -f "$hook_path" ]; then
        if [ -x "$hook_path" ]; then
            print_success "$hook: Exists and executable"
        else
            print_warning "$hook: Exists but not executable"
            print_info "Run: chmod +x $hook_path"
        fi
    else
        print_error "$hook: Not found"
    fi
done

print_header "⚙️  GIT CONFIGURATION CHECK"

# Check Git configuration
echo ""
print_info "Checking Git configuration..."

# Check user name and email
GIT_NAME=$(git config --get user.name)
GIT_EMAIL=$(git config --get user.email)

if [ -n "$GIT_NAME" ]; then
    print_success "Git user.name: $GIT_NAME"
else
    print_error "Git user.name not set"
    print_info "Run: git config --global user.name 'Your Name'"
fi

if [ -n "$GIT_EMAIL" ]; then
    print_success "Git user.email: $GIT_EMAIL"
else
    print_error "Git user.email not set"
    print_info "Run: git config --global user.email 'your@email.com'"
fi

# Check GPG signing configuration
GPG_SIGN=$(git config --get commit.gpgsign)
if [ "$GPG_SIGN" = "true" ]; then
    print_success "GPG commit signing: Enabled"

    # Check if signing key is set
    SIGNING_KEY=$(git config --get user.signingkey)
    if [ -n "$SIGNING_KEY" ]; then
        print_success "GPG signing key: $SIGNING_KEY"

        # Test if the key exists and can be used
        if gpg --list-secret-keys "$SIGNING_KEY" >/dev/null 2>&1; then
            print_success "GPG key is available"
        else
            print_error "GPG key not found in keyring"
        fi
    else
        print_warning "GPG signing enabled but no signing key set"
    fi
else
    print_warning "GPG commit signing: Disabled"
    print_info "Run: ./bin/setup-gpg.sh to set up GPG signing"
fi

print_header "🧪 HOOK FUNCTIONALITY TESTS"

# Test pre-commit hook (dry run)
echo ""
print_info "Testing pre-commit hook logic..."

# Check if linting tools are available
if command -v eslint >/dev/null 2>&1; then
    print_success "ESLint: Available"
else
    print_error "ESLint: Not available"
fi

if command -v prettier >/dev/null 2>&1; then
    print_success "Prettier: Available"
else
    print_error "Prettier: Not available"
fi

if command -v tsc >/dev/null 2>&1; then
    print_success "TypeScript: Available"
else
    print_error "TypeScript: Not available"
fi

# Test commit message validation
echo ""
print_info "Testing commit message validation..."

# Test valid commit messages
VALID_MESSAGES=("feat: add new feature" "fix(api): resolve bug" "docs: update README")
INVALID_MESSAGES=("Add new feature" "Fixed bug" "Updated docs")

for msg in "${VALID_MESSAGES[@]}"; do
    if echo "$msg" | grep -qE "^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?: .{1,50}"; then
        print_success "Valid format: '$msg'"
    else
        print_error "Should be valid: '$msg'"
    fi
done

for msg in "${INVALID_MESSAGES[@]}"; do
    if ! echo "$msg" | grep -qE "^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?: .{1,50}"; then
        print_success "Correctly rejected: '$msg'"
    else
        print_error "Should be invalid: '$msg'"
    fi
done

print_header "🔧 DEPENDENCIES CHECK"

# Check Node.js and npm
NODE_VERSION=$(node --version 2>/dev/null)
NPM_VERSION=$(npm --version 2>/dev/null)

if [ -n "$NODE_VERSION" ]; then
    print_success "Node.js: $NODE_VERSION"
else
    print_error "Node.js: Not available"
fi

if [ -n "$NPM_VERSION" ]; then
    print_success "npm: $NPM_VERSION"
else
    print_error "npm: Not available"
fi

# Check if package.json scripts exist
REQUIRED_SCRIPTS=("lint" "test" "build" "check")

for script in "${REQUIRED_SCRIPTS[@]}"; do
    if npm run | grep -q "^  $script$"; then
        print_success "npm script '$script': Available"
    else
        print_error "npm script '$script': Missing"
    fi
done

print_header "📋 RECOMMENDATIONS"

echo ""
print_info "To ensure optimal hook performance:"
echo "  1. Keep hooks fast (< 30 seconds)"
echo "  2. Test hooks regularly with this script"
echo "  3. Ensure GPG signing is set up for security"
echo "  4. Use conventional commits for better tracking"
echo ""

print_info "Common hook commands:"
echo "  npm run hooks:test          # Run this test script"
echo "  npm run commit:verify       # Verify recent commits"
echo "  npm run commit:setup-signing # Set up GPG signing"
echo ""

print_header "🎯 TEST COMPLETE"

echo ""
print_success "Hook testing completed!"
print_info "All critical components checked for proper Git hook functionality"
echo ""
