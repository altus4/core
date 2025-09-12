#!/bin/bash

# Generate Encryption Key Script
# This script generates a secure 32-byte (64 hex chars) encryption key and saves it to .env as ENCRYPTION_KEY

set -e

ENV_FILE=".env"
KEY_NAME="ENCRYPTION_KEY"

# Generate a secure 32-byte key (64 hex characters)
ENCRYPTION_KEY=$(openssl rand -hex 32)

echo "Generated ${KEY_NAME}: ${ENCRYPTION_KEY}"

# Ensure .env exists
if [ ! -f "$ENV_FILE" ]; then
  echo "Creating $ENV_FILE..."
  touch "$ENV_FILE"
fi

# Add or update ENCRYPTION_KEY in .env
if grep -q "^${KEY_NAME}=" "$ENV_FILE"; then
  echo "${KEY_NAME} already exists in $ENV_FILE"
  read -p "Do you want to replace it? (y/N): " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [[ "$OSTYPE" == "darwin"* ]]; then
      # macOS requires an empty string after -i
      sed -i '' "s/^${KEY_NAME}=.*/${KEY_NAME}=${ENCRYPTION_KEY}/" "$ENV_FILE"
    else
      # Linux and others
      sed -i "s/^${KEY_NAME}=.*/${KEY_NAME}=${ENCRYPTION_KEY}/" "$ENV_FILE"
    fi
    echo "${KEY_NAME} updated in $ENV_FILE"
  else
    echo "${KEY_NAME} not modified"
    exit 0
  fi
else
  echo "${KEY_NAME}=${ENCRYPTION_KEY}" >> "$ENV_FILE"
  echo "${KEY_NAME} added to $ENV_FILE"
fi

echo "✅ Encryption key configuration complete!"

