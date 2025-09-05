---
title: Git Workflow & Commit Verification
description: Comprehensive commit verification system for Altus 4 to ensure code quality, security, and proper Git hygiene.
---

# Commit Verification Setup for Altus 4

This document outlines the comprehensive commit verification system implemented in Altus 4 to ensure code quality, security, and proper Git hygiene.

## GPG Commit Signing

### Setup GPG Signing

```bash
# Interactive GPG key setup
npm run commit:setup-signing

# Configure Git to use the generated key
npm run commit:configure-signing
```

### Manual GPG Setup

If you prefer manual setup:

1. **Generate GPG Key** (choose option 9 - ECC sign and encrypt)

   ```bash
   gpg --full-generate-key
   ```

2. **Configure Git**

   ```bash
   # Get your key ID
   gpg --list-secret-keys --keyid-format LONG

   # Configure Git
   git config --global user.signingkey YOUR_KEY_ID
   git config --global commit.gpgsign true
   git config --global tag.gpgsign true
   ```

3. **Add to GitHub**

   ```bash
   # Export public key
   gpg --armor --export YOUR_KEY_ID
   # Copy output and add to GitHub Settings → SSH and GPG keys
   ```

### Why ECC (Option 9)?

- **Modern & Future-Proof**: Industry standard with better performance
- **Smaller Keys**: 256-bit ECC ≈ 3072-bit RSA security
- **GitHub Support**: Fully supported with efficient handling
- **NSA Suite B**: Approved security standard

## 🪝 **Git Hooks**

### Pre-Commit Hook

Runs comprehensive checks before allowing commits:

1. **Security Audit**: `npm audit --audit-level=high`
2. **Lint & Format**: `lint-staged` with ESLint and Prettier
3. **Type Checking**: TypeScript compilation check
4. **Build Verification**: Ensures project compiles
5. **Test Suite**: Full test suite execution
6. **Package Integrity**: Dependency consistency check
7. **Documentation**: Markdown linting
8. **GPG Configuration**: Verify signing setup

### Commit Message Hook

Validates commit messages for:

- **Conventional Commits** format validation
- **GPG Signing** status check
- **Sensitive Information** detection
- **Format Examples** and helpful error messages

### Post-Commit Hook

Verifies commit integrity:

- **GPG Signature** verification
- **Commit Format** validation
- **Branch Protection** warnings
- **Commit Summary** display

### Pre-Push Hook

Prevents pushing problematic commits:

- **GPG Signature** verification for all commits being pushed
- **Security Audit** final check
- **Interactive Prompts** for unsigned commits or security issues
- **Protected Branch** detection (main/master)

## Available Commands

### Verification Commands

```bash
# Test all Git hooks
npm run hooks:test

# Verify recent commits (default: last 10)
npm run commit:verify

# Verify specific number of commits
./bin/verify-commits.sh 20

# Security audit
npm run security:audit

# Fix security issues
npm run security:fix
```

### GPG Commands

```bash
# Set up GPG signing (interactive)
npm run commit:setup-signing

# Configure Git for GPG signing
npm run commit:configure-signing

# Manual script execution
./bin/setup-gpg.sh
./bin/setup-gpg.sh configure
```

## Commit Message Format

We use **Conventional Commits** for consistency:

```text
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Valid Types

- `feat`: New features
- `fix`: Bug fixes
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `perf`: Performance improvements
- `test`: Adding or updating tests
- `build`: Build system changes
- `ci`: CI/CD changes
- `chore`: Other changes

### Examples

```bash
feat: add API key authentication system
fix(api): resolve database connection timeout
docs: update README with new authentication flow
test: add unit tests for ApiKeyService
```

## Verification Process

### Before Each Commit

1. **Automated Checks**: Pre-commit hook runs all quality checks
2. **Message Validation**: Commit message format verification
3. **GPG Signing**: Automatic signing if configured
4. **Post-Verification**: Immediate verification of commit integrity

### Before Each Push

1. **Commit Analysis**: All commits in push are analyzed
2. **GPG Verification**: Ensures all commits are signed
3. **Security Check**: Final security audit
4. **Interactive Prompts**: User confirmation for any issues

### Manual Verification

```bash
# Check recent commit history
npm run commit:verify

# Test hook configuration
npm run hooks:test

# Verify specific commit
git verify-commit <commit-hash>
```

## 🚨 **Troubleshooting**

### GPG Issues

```bash
# Restart GPG agent
gpgconf --kill gpg-agent
gpgconf --launch gpg-agent

# Check GPG keys
gpg --list-secret-keys

# Test GPG signing
git commit --allow-empty -m "test: verify GPG signing"
```

### Hook Issues

```bash
# Reinstall hooks
npm install

# Make hooks executable
chmod +x .husky/*

# Test individual hooks
./.husky/pre-commit
./.husky/commit-msg
```

### Performance Issues

If hooks are too slow:

1. **Skip Hooks** (emergency only): `git commit --no-verify`
2. **Optimize Tests**: Use `--bail` for faster failure
3. **Cache Dependencies**: Ensure node_modules is cached

## Best Practices

### For Developers

1. **Set up GPG signing** immediately after cloning
2. **Use conventional commits** for all commits
3. **Run verification** before important pushes
4. **Keep commits small** for faster hook execution
5. **Fix issues promptly** rather than skipping verification

### For Maintainers

1. **Enforce branch protection** on main/master
2. **Require signed commits** for sensitive operations
3. **Regular security audits** using provided commands
4. **Monitor hook performance** and optimize as needed
5. **Update verification tools** regularly

## Security Features

- **GPG Commit Signing**: Cryptographic verification of commit authorship
- **Security Auditing**: Automatic vulnerability detection
- **Sensitive Data Detection**: Prevents secrets in commit messages
- **Interactive Prompts**: User confirmation for security issues
- **Branch Protection**: Warnings for direct commits to protected branches

## Metrics and Reporting

The verification system provides detailed reporting:

- **Commit Analysis**: Percentage of signed commits
- **Format Compliance**: Conventional commit adherence
- **Security Status**: Vulnerability counts and severity
- **Performance Metrics**: Hook execution times
- **Compliance Reports**: Detailed verification summaries

This comprehensive verification system ensures that all code committed to Altus 4 meets our high standards for quality, security, and maintainability.
