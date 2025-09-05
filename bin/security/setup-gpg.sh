#!/bin/bash

# GPG Setup Script for Altus 4 Development
# Run this script manually to set up commit signing

echo "🔐 Setting up GPG for commit signing..."

# Ensure GPG agent is running
echo "Starting GPG agent..."
export GPG_TTY=$(tty)
echo 'export GPG_TTY=$(tty)' >> ~/.zshrc

# Set up pinentry for macOS
echo "pinentry-program /opt/homebrew/bin/pinentry-mac" > ~/.gnupg/gpg-agent.conf

# Restart GPG agent
echo "Restarting GPG agent..."
gpgconf --kill gpg-agent
gpgconf --launch gpg-agent

echo ""
echo "🎯 Now generating your GPG key..."
echo "Please follow these steps:"
echo ""
echo "1. Run: gpg --full-generate-key"
echo "2. Select: 9 (ECC sign and encrypt) - this is the default"
echo "3. Select: 1 (Curve 25519) - this is the default"
echo "4. Enter: 2y (key expires in 2 years)"
echo "5. Confirm: y"
echo "6. Enter your details:"
echo "   Real name: Jerome Thayananthajothy"
echo "   Email: tjthavarshan@gmail.com"
echo "   Comment: Altus 4 Development"
echo "7. Select: O (Okay)"
echo "8. Enter a strong passphrase when prompted"
echo ""
echo "After key generation, run this script again with 'configure' to set up Git:"
echo "./bin/setup-gpg.sh configure"
echo ""

if [ "$1" = "configure" ]; then
    echo "🔧 Configuring Git for GPG signing..."

    # Get the GPG key ID
    KEY_ID=$(gpg --list-secret-keys --keyid-format LONG | grep sec | head -1 | sed 's/.*\/\([A-F0-9]*\).*/\1/')

    if [ -z "$KEY_ID" ]; then
        echo "❌ No GPG key found. Please generate a GPG key first."
        exit 1
    fi

    echo "📝 Found GPG key: $KEY_ID"

    # Configure Git
    git config --global user.signingkey $KEY_ID
    git config --global commit.gpgsign true
    git config --global tag.gpgsign true

    echo ""
    echo "✅ Git configured for GPG signing!"
    echo ""
    echo "🚀 Add this public key to GitHub:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    gpg --armor --export $KEY_ID
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "📋 Copy the above text and add it to:"
    echo "   GitHub → Settings → SSH and GPG keys → New GPG key"
    echo ""
    echo "🧪 Test with: git commit --allow-empty -m 'test: verify GPG signing'"
    echo ""
fi
