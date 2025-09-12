#!/bin/bash

# Heroku Deployment Script for Altus4 Core
# This script helps set up and deploy the Altus4 application to Heroku

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Heroku CLI is installed
check_heroku_cli() {
    if ! command -v heroku &> /dev/null; then
        print_error "Heroku CLI is not installed. Please install it first:"
        echo "https://devcenter.heroku.com/articles/heroku-cli"
        exit 1
    fi
}

# Check if user is logged in to Heroku
check_heroku_auth() {
    if ! heroku auth:whoami &> /dev/null; then
        print_warning "You are not logged in to Heroku"
        print_status "Logging in to Heroku..."
        heroku login
    else
        print_success "Already logged in to Heroku as $(heroku auth:whoami)"
    fi
}

# Create Heroku app
create_app() {
    local app_name="$1"
    
    if [ -z "$app_name" ]; then
        print_status "Creating Heroku app with auto-generated name..."
        heroku create
    else
        print_status "Creating Heroku app: $app_name"
        heroku create "$app_name"
    fi
    
    print_success "Heroku app created successfully"
}

# Add required add-ons
add_addons() {
    print_status "Adding required add-ons..."
    
    # MySQL Database (ClearDB)
    print_status "Adding ClearDB MySQL database..."
    heroku addons:create cleardb:ignite
    
    # Redis Cache
    print_status "Adding Heroku Redis cache..."
    heroku addons:create heroku-redis:mini
    
    # Optional: Papertrail for logging
    read -p "Do you want to add Papertrail logging? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        heroku addons:create papertrail:choklad
    fi
    
    print_success "Add-ons installed successfully"
}

# Set environment variables
set_environment_variables() {
    print_status "Setting environment variables..."
    
    # Required variables
    heroku config:set NODE_ENV=production
    
    # Generate JWT secret
    print_status "Generating JWT secret..."
    JWT_SECRET=$(openssl rand -hex 32)
    heroku config:set JWT_SECRET="$JWT_SECRET"
    
    # Ask for OpenAI API key
    read -p "Enter your OpenAI API key: " OPENAI_API_KEY
    heroku config:set OPENAI_API_KEY="$OPENAI_API_KEY"
    
    # Optional configurations
    heroku config:set OPENAI_MODEL=gpt-3.5-turbo
    heroku config:set RATE_LIMIT_MAX_REQUESTS=1000
    heroku config:set LOG_LEVEL=info
    heroku config:set BCRYPT_ROUNDS=12
    
    print_success "Environment variables set successfully"
}

# Deploy to Heroku
deploy() {
    print_status "Deploying to Heroku..."
    
    # Add and commit changes if there are any
    if ! git diff-index --quiet HEAD --; then
        print_status "Committing local changes..."
        git add .
        git commit -m "Configure for Heroku deployment"
    fi
    
    # Deploy
    git push heroku main
    
    print_success "Deployment completed successfully"
}

# Run database migrations
run_migrations() {
    print_status "Running database migrations..."
    heroku run npm run migrate:run
    print_success "Database migrations completed"
}

# Open the app
open_app() {
    print_status "Opening your Heroku app..."
    heroku open
}

# Main deployment function
main() {
    print_status "Starting Heroku deployment for Altus4 Core..."
    
    check_heroku_cli
    check_heroku_auth
    
    # Check if this is a new deployment or update
    if git remote get-url heroku &> /dev/null; then
        print_status "Heroku remote found. This appears to be an existing deployment."
        read -p "Do you want to deploy updates? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            deploy
            
            read -p "Do you want to run database migrations? (y/n): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                run_migrations
            fi
            
            open_app
        fi
    else
        print_status "This appears to be a new deployment."
        
        # App name
        read -p "Enter Heroku app name (leave empty for auto-generated): " app_name
        
        create_app "$app_name"
        add_addons
        set_environment_variables
        deploy
        run_migrations
        open_app
        
        print_success "🎉 Altus4 Core has been successfully deployed to Heroku!"
        print_status "Your app is available at: $(heroku info -s | grep web_url | cut -d= -f2)"
    fi
}

# Handle command line arguments
case "${1:-}" in
    "create")
        create_app "$2"
        ;;
    "addons")
        add_addons
        ;;
    "config")
        set_environment_variables
        ;;
    "deploy")
        deploy
        ;;
    "migrate")
        run_migrations
        ;;
    "open")
        open_app
        ;;
    "logs")
        heroku logs --tail
        ;;
    "status")
        heroku ps
        echo
        heroku config
        ;;
    *)
        main
        ;;
esac