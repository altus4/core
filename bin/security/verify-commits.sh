#!/bin/bash

# Commit Verification Script for Altus 4
# Verifies GPG signatures and commit message format for recent commits

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

# Default to checking last 10 commits
COUNT=${1:-10}

print_header "🔍 ALTUS 4 COMMIT VERIFICATION REPORT"
echo ""
print_info "Analyzing last $COUNT commits..."
echo ""

# Get the commits to analyze
COMMITS=$(git rev-list --max-count="$COUNT" HEAD)

# Counters
total_commits=0
signed_commits=0
unsigned_commits=0
valid_format=0
invalid_format=0

# Arrays to store results
declare -a unsigned_list
declare -a invalid_format_list

print_header "📋 DETAILED ANALYSIS"

for commit in $COMMITS; do
    total_commits=$((total_commits + 1))

    # Get commit details
    commit_short=$(git rev-parse --short "$commit")
    commit_msg=$(git log -1 --pretty=format:%s "$commit")
    commit_author=$(git log -1 --pretty=format:"%an <%ae>" "$commit")
    commit_date=$(git log -1 --pretty=format:%cd --date=short "$commit")

    echo ""
    echo -e "${BLUE}Commit #$total_commits: $commit_short${NC}"
    echo "  📅 Date: $commit_date"
    echo "  👤 Author: $commit_author"
    echo "  💬 Message: $commit_msg"

    # Check GPG signature
    if git verify-commit "$commit" >/dev/null 2>&1; then
        signed_commits=$((signed_commits + 1))
        signature_info=$(git show --show-signature --format="%G? %GS" -s "$commit" | head -1)
        print_success "GPG Signed: $signature_info"
    else
        unsigned_commits=$((unsigned_commits + 1))
        unsigned_list+=("$commit_short: $commit_msg")
        print_error "Not GPG signed"
    fi

    # Check conventional commit format
    if echo "$commit_msg" | grep -qE "^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?: .{1,50}"; then
        valid_format=$((valid_format + 1))
        print_success "Valid conventional commit format"
    else
        invalid_format=$((invalid_format + 1))
        invalid_format_list+=("$commit_short: $commit_msg")
        print_error "Invalid commit message format"
    fi
done

echo ""
print_header "📊 SUMMARY REPORT"
echo ""

# Display summary
echo "📈 Total Commits Analyzed: $total_commits"
echo ""

# GPG Signing Summary
if [ $signed_commits -eq $total_commits ]; then
    print_success "GPG Signing: $signed_commits/$total_commits (100%) commits are signed"
elif [ $signed_commits -gt 0 ]; then
    print_warning "GPG Signing: $signed_commits/$total_commits ($(( signed_commits * 100 / total_commits ))%) commits are signed"
else
    print_error "GPG Signing: 0/$total_commits (0%) commits are signed"
fi

# Commit Format Summary
if [ $valid_format -eq $total_commits ]; then
    print_success "Commit Format: $valid_format/$total_commits (100%) follow conventional commits"
elif [ $valid_format -gt 0 ]; then
    print_warning "Commit Format: $valid_format/$total_commits ($(( valid_format * 100 / total_commits ))%) follow conventional commits"
else
    print_error "Commit Format: 0/$total_commits (0%) follow conventional commits"
fi

# Show issues if any
if [ $unsigned_commits -gt 0 ]; then
    echo ""
    print_warning "UNSIGNED COMMITS:"
    for commit in "${unsigned_list[@]}"; do
        echo "  🔓 $commit"
    done
fi

if [ $invalid_format -gt 0 ]; then
    echo ""
    print_warning "INVALID COMMIT FORMATS:"
    for commit in "${invalid_format_list[@]}"; do
        echo "  📝 $commit"
    done
fi

echo ""
print_header "🔧 RECOMMENDATIONS"

if [ $unsigned_commits -gt 0 ]; then
    echo ""
    print_info "To set up GPG signing:"
    echo "  1. Run: ./bin/setup-gpg.sh"
    echo "  2. Follow the interactive setup"
    echo "  3. Run: ./bin/setup-gpg.sh configure"
    echo ""
    print_info "To sign existing commits:"
    echo "  git rebase --exec 'git commit --amend --no-edit -S' HEAD~$unsigned_commits"
fi

if [ $invalid_format -gt 0 ]; then
    echo ""
    print_info "Commit message format should be:"
    echo "  <type>[optional scope]: <description>"
    echo ""
    echo "  Examples:"
    echo "    feat: add user authentication"
    echo "    fix(api): resolve database connection issue"
    echo "    docs: update README with installation steps"
fi

echo ""
if [ $unsigned_commits -eq 0 ] && [ $invalid_format -eq 0 ]; then
    print_success "🎉 All commits are properly signed and formatted!"
    echo "  Your commit history meets all verification standards."
else
    print_warning "⚠️  Some commits need attention."
    echo "  Consider fixing these issues before pushing to main."
fi

echo ""
print_header "🔍 VERIFICATION COMPLETE"
echo ""

# Exit with error code if there are issues
if [ $unsigned_commits -gt 0 ] || [ $invalid_format -gt 0 ]; then
    exit 1
else
    exit 0
fi
