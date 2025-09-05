#!/bin/bash

# Altus4 Development Environment Reset Script
# This script resets the development environment (removes all data)

set -e

echo "🔄 Resetting Altus4 Development Environment..."

# Navigate to script directory
cd "$(dirname "$0")"

# Stop and remove all containers and volumes
echo "📦 Stopping and removing Docker services..."
docker-compose down -v

# Remove volumes
echo "🗑️  Removing data volumes..."
docker volume rm local_mysql_data local_redis_data 2>/dev/null || true

echo "✅ Environment reset complete!"
echo ""
echo "💡 To start fresh, run: ./script/local/start.sh"
