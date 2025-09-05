#!/bin/bash
# migrate.sh - Run database migrations for Altus4
# Usage: ./bin/migrate.sh [up|down|status]

# Load environment variables if .env file exists
if [ -f "$(dirname "$0")/../../.env" ]; then
  set -a
  source "$(dirname "$0")/../../.env"
  set +a
fi

MIGRATIONS_DIR="$(dirname "$0")/../../migrations"

# Use environment variables with fallbacks for backward compatibility
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USERNAME:-root}"
DB_PASS="${DB_PASSWORD:-}"
DB_NAME="${DB_DATABASE:-altus4}"

# Validate required database configuration
if [ -z "$DB_HOST" ] || [ -z "$DB_USER" ] || [ -z "$DB_NAME" ]; then
  echo "Error: Missing required database configuration."
  echo "Please set DB_HOST, DB_USERNAME, and DB_DATABASE environment variables."
  echo "You can also create a .env file in the project root."
  exit 1
fi

function run_migration_up() {
  echo "Running migrations..."
  echo "Database: $DB_NAME on $DB_HOST:$DB_PORT as $DB_USER"

  if [ ! -d "$MIGRATIONS_DIR" ]; then
    echo "Error: Migrations directory not found: $MIGRATIONS_DIR"
    exit 1
  fi

  local migration_files=("$MIGRATIONS_DIR"/*.up.sql)
  # Check if glob matched any files or just returned the literal pattern
  if [ ! -f "${migration_files[0]}" ]; then
    echo "No migration files found in $MIGRATIONS_DIR"
    return 0
  fi

  for file in "${migration_files[@]}"; do
    echo "Running migration: $(basename "$file")"
    if [ -n "$DB_PASS" ]; then
      mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < "$file"
    else
      mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "$DB_NAME" < "$file"
    fi

    if [ $? -ne 0 ]; then
      echo "Error: Migration failed for $file"
      exit 1
    fi
  done
  echo "All migrations completed successfully!"
}

function run_migration_down() {
  echo "Reverting migrations..."
  echo "Database: $DB_NAME on $DB_HOST:$DB_PORT as $DB_USER"

  if [ ! -d "$MIGRATIONS_DIR" ]; then
    echo "Error: Migrations directory not found: $MIGRATIONS_DIR"
    exit 1
  fi

  local migration_files=("$MIGRATIONS_DIR"/*.down.sql)
  if [ ! -f "${migration_files[0]}" ]; then
    echo "No rollback files found in $MIGRATIONS_DIR"
    return 0
  fi

  # Run down migrations in reverse order
  for file in $(ls -r "${migration_files[@]}"); do
    echo "Reverting migration: $(basename "$file")"
    if [ -n "$DB_PASS" ]; then
      mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < "$file"
    else
      mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" "$DB_NAME" < "$file"
    fi

    if [ $? -ne 0 ]; then
      echo "Error: Rollback failed for $file"
      exit 1
    fi
  done
  echo "All rollbacks completed successfully!"
}

function show_status() {
  echo "Migration Status for: $DB_NAME on $DB_HOST:$DB_PORT"
  echo "Migration files in: $MIGRATIONS_DIR"
  echo ""

  if [ ! -d "$MIGRATIONS_DIR" ]; then
    echo "Error: Migrations directory not found: $MIGRATIONS_DIR"
    exit 1
  fi

  echo "Available migrations:"
  local up_files=("$MIGRATIONS_DIR"/*.up.sql)

  if [ ! -f "${up_files[0]}" ]; then
    echo "  No migration files found"
    return 0
  fi

  for file in "${up_files[@]}"; do
    local basename=$(basename "$file" .up.sql)
    local down_file="$MIGRATIONS_DIR/$basename.down.sql"

    echo "  📁 $basename"
    echo "     ⬆️  $(basename "$file") ($(ls -lh "$file" | awk '{print $5}'))"
    if [ -f "$down_file" ]; then
      echo "     ⬇️  $(basename "$down_file") ($(ls -lh "$down_file" | awk '{print $5}'))"
    else
      echo "     ⬇️  No rollback file"
    fi
    echo ""
  done
}

case "$1" in
  up)
    run_migration_up
    ;;
  down)
    run_migration_down
    ;;
  status)
    show_status
    ;;
  *)
    echo "Usage: $0 [up|down|status]"
    exit 1
    ;;
esac
