#!/bin/bash

# Generate JWT Secret Script
# This script generates a secure 64-character JWT secret and adds it to .env file

set -e

ENV_FILE=".env"
JWT_KEY="JWT_SECRET"

# Generate a secure 64-character random string using openssl
JWT_SECRET=$(openssl rand -hex 32)

echo "Generated JWT secret: ${JWT_SECRET}"

# Check if .env file exists, create if it doesn't
if [ ! -f "$ENV_FILE" ]; then
    echo "Creating .env file..."
    touch "$ENV_FILE"
fi

# Check if JWT_SECRET already exists in .env file
if grep -q "^${JWT_KEY}=" "$ENV_FILE"; then
    echo "JWT_SECRET already exists in $ENV_FILE"
    read -p "Do you want to replace it? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # Replace existing JWT_SECRET
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            sed -i '' "s/^${JWT_KEY}=.*/${JWT_KEY}=${JWT_SECRET}/" "$ENV_FILE"
        else
            # Linux
            sed -i "s/^${JWT_KEY}=.*/${JWT_KEY}=${JWT_SECRET}/" "$ENV_FILE"
        fi
        echo "JWT_SECRET updated in $ENV_FILE"
    else
        echo "JWT_SECRET not modified"
        exit 0
    fi
else
    # Add new JWT_SECRET to .env file
    echo "${JWT_KEY}=${JWT_SECRET}" >> "$ENV_FILE"
    echo "JWT_SECRET added to $ENV_FILE"
fi

echo "✅ JWT secret configuration complete!"