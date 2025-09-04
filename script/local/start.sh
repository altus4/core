#!/bin/bash

# Altus4 Development Environment Startup Script
# This script starts the development environment with Docker services

set -e

echo "🚀 Starting Altus4 Development Environment..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Navigate to script directory
cd "$(dirname "$0")"

# Start services
echo "📦 Starting Docker services..."
docker-compose up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check if MySQL is ready
echo "🔍 Checking MySQL connection..."
until docker-compose exec mysql mysqladmin ping -h localhost --silent; do
    echo "⏳ Waiting for MySQL to be ready..."
    sleep 2
done

# Check if Redis is ready
echo "🔍 Checking Redis connection..."
until docker-compose exec redis redis-cli ping | grep -q PONG; do
    echo "⏳ Waiting for Redis to be ready..."
    sleep 2
done

# Run database migrations
echo "🗄️  Running database migrations..."

# Wait for MySQL to be ready
echo "⏳ Waiting for MySQL to be ready..."
until docker-compose exec -T mysql mysqladmin ping -h localhost --silent; do
  echo "Waiting for MySQL..."
  sleep 2
done

# Run migrations using Docker container
echo "🚀 Executing migrations..."
for migration_file in ../../migrations/*.up.sql; do
  if [ -f "$migration_file" ]; then
    echo "Running migration: $(basename "$migration_file")"
    docker-compose exec -T mysql mysql -h localhost -u altus4_user -pyour_secure_password_here altus4_metadata < "$migration_file"
  fi
done

echo "✅ All migrations completed successfully!"

echo "✅ All services are ready!"
echo ""
echo "💡 To start the Node.js server, run: npm run dev"
echo "💡 To stop services, run: ./script/local/stop.sh"
