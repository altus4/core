#!/usr/bin/env bash
# Altus4 migration CLI (Laravel-like)
# Commands:
#   migrate [--path <dir>] [--step] [--pretend] [--seed] [--force] [--database <name>]
#   migrate:install
#   migrate:status [--path <dir>]
#   migrate:rollback [--step <n>|--batch <n>] [--pretend] [--path <dir>] [--force]
#   migrate:reset [--pretend] [--force]
#   migrate:refresh [--step] [--seed] [--force]
#   migrate:fresh [--drop-views] [--seed] [--force]
#   migrate:up   --path <dir> --file <name>
#   migrate:down --path <dir> --file <name>

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"

# Load environment variables if .env file exists
if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a
fi

# Defaults (env can override)
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USERNAME:-root}"
DB_PASS="${DB_PASSWORD:-}"
DB_NAME="${DB_DATABASE:-altus4}"
APP_ENV="${APP_ENV:-${NODE_ENV:-development}}"

MIGRATIONS_DIR_DEFAULT="$ROOT_DIR/migrations"
MIGRATIONS_TABLE="${MIGRATIONS_TABLE:-migrations}"

# Globals set by args
ARG_PATH="$MIGRATIONS_DIR_DEFAULT"
ARG_STEP=false
ARG_PRETEND=false
ARG_FORCE=false
ARG_SEED=false
ARG_DROP_VIEWS=false
ARG_FILE=""
ARG_DATABASE=""
ARG_BATCH=""
ARG_ROLLBACK_STEPS=""

die() { echo "Error: $*" >&2; exit 1; }

info() { echo "$*"; }

# Escape a value for safe inclusion in single-quoted SQL literal
sql_escape() {
  printf '%s' "$1" | sed "s/'/''/g"
}

mysql_args() {
  local args=()
  if [ -n "${DB_SOCKET:-}" ]; then
    args+=( --socket "$DB_SOCKET" -u "$DB_USER" )
  else
    local host="$DB_HOST"
    if [ "$host" = "localhost" ]; then host="127.0.0.1"; fi
    args+=( --protocol=TCP -h "$host" -P "$DB_PORT" -u "$DB_USER" )
  fi
  if [ -n "$DB_PASS" ]; then args+=( -p"$DB_PASS" ); fi
  args+=( "$DB_NAME" )
  printf '%q ' "${args[@]}"
}

mysql_exec() {
  local sql="$1"
  if [ "$ARG_PRETEND" = true ]; then
    echo "[pretend] $sql"
    return 0
  fi
  # shellcheck disable=SC2046
  printf '%b' "$sql" | mysql $(mysql_args) 1>/dev/null
}

mysql_exec_file() {
  local file="$1"
  if [ "$ARG_PRETEND" = true ]; then
    echo "[pretend] < $file"
    sed -n '1,120p' "$file" | sed 's/^/    /'
    [ "$(wc -l < "$file")" -gt 120 ] && echo "    ... (truncated)"
    return 0
  fi
  # shellcheck disable=SC2046
  mysql $(mysql_args) 1>/dev/null < "$file"
}

require_db_config() {
  if [ -z "$DB_HOST" ] || [ -z "$DB_USER" ] || [ -z "$DB_NAME" ]; then
    die "Missing DB config. Set DB_HOST, DB_USERNAME, DB_DATABASE (see .env)."
  fi
}

guard_production() {
  local action="$1"
  if [ "$APP_ENV" = "production" ] && [ "$ARG_FORCE" = false ]; then
    die "Refusing to $action in production without --force (APP_ENV=production)."
  fi
}

ensure_migrations_table() {
  mysql_exec "CREATE TABLE IF NOT EXISTS \`$MIGRATIONS_TABLE\` (\n    id INT AUTO_INCREMENT PRIMARY KEY,\n    migration VARCHAR(255) NOT NULL,\n    batch INT NOT NULL,\n    migrated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"
}

can_connect_db() {
  # return 0 if connection is possible
  # shellcheck disable=SC2046
  echo "SELECT 1;" | mysql $(mysql_args) -N 1>/dev/null 2>&1
}

current_batch() {
  # returns current max batch (or 0 if none)
  # shellcheck disable=SC2046
  local out
  out=$(echo "SELECT COALESCE(MAX(batch),0) FROM \`$MIGRATIONS_TABLE\`;" | mysql $(mysql_args) -N 2>/dev/null || echo 0)
  echo "${out:-0}"
}

list_applied() {
  # outputs applied migration names (one per line)
  # shellcheck disable=SC2046
  echo "SELECT migration FROM \`$MIGRATIONS_TABLE\` ORDER BY id;" | mysql $(mysql_args) -N 2>/dev/null || true
}

record_migration() {
  local name="$1"; local batch="$2"
  mysql_exec "INSERT INTO \`$MIGRATIONS_TABLE\` (migration, batch) VALUES ('$(sql_escape "$name")', $batch);"
}

delete_migration_record() {
  local name="$1"
  mysql_exec "DELETE FROM \`$MIGRATIONS_TABLE\` WHERE migration='$(sql_escape "$name")' LIMIT 1;"
}

filesystem_up_files() {
  ls -1 "${ARG_PATH}"/*.up.sql 2>/dev/null | sort -V || true
}

filesystem_down_for() {
  local name="$1"
  echo "$ARG_PATH/$name.down.sql"
}

basename_no_ext() {
  local f="$1"
  basename "$f" .up.sql
}

cmd_install() {
  require_db_config
  ensure_migrations_table
  info "Migrations table ensured in database '$DB_NAME'."
}

cmd_status() {
  require_db_config
  echo "Migration status for $DB_NAME (path: $ARG_PATH)"
  printf "%-50s  %-7s  %s\n" "Migration" "Ran?" "Batch"
  printf "%-50s  %-7s  %s\n" "---------" "-----" "-----"
  if can_connect_db; then
    ensure_migrations_table
    local f name ran
    while IFS= read -r f; do
      [ -z "$f" ] && continue
      name=$(basename "$f" .up.sql)
      # shellcheck disable=SC2046
      ran=$(echo "SELECT COUNT(*), COALESCE(MAX(batch),0) FROM \`$MIGRATIONS_TABLE\` WHERE migration='$(sql_escape "$name")';" | mysql $(mysql_args) -N 2>/dev/null)
      local count maxb
      count=$(echo "$ran" | awk '{print $1}')
      maxb=$(echo "$ran" | awk '{print $2}')
      if [ "${count:-0}" -gt 0 ]; then
        printf "%-50s  %-7s  %s\n" "$name" "yes" "$maxb"
      else
        printf "%-50s  %-7s  %s\n" "$name" "no" "-"
      fi
    done < <(filesystem_up_files)
  else
    # Fallback: file-only view without DB connection
    while IFS= read -r f; do
      [ -z "$f" ] && continue
      printf "%-50s  %-7s  %s\n" "$(basename "$f" .up.sql)" "unknown" "?"
    done < <(filesystem_up_files)
    echo "(Database unreachable: showing file list only)"
  fi
}

cmd_migrate() {
  require_db_config
  guard_production "run migrations"
  ensure_migrations_table

  local applied_list
  applied_list="$(list_applied || true)"

  local next_batch
  next_batch=$(($(current_batch)+1))
  local per_migration_batch=$ARG_STEP

  local any=false
  local f name batch_to_use
  while IFS= read -r f; do
    [ -z "$f" ] && continue
    name=$(basename_no_ext "$f")
    local already=false
    if printf '%s\n' "$applied_list" | grep -Fxq "$name"; then
      already=true
    fi
    if [ "$already" = true ]; then
      continue
    fi

    any=true
    batch_to_use=$next_batch
    if [ "$per_migration_batch" = true ]; then
      batch_to_use=$(( $(current_batch) + 1 ))
    fi
    info "Migrating: $name (batch $batch_to_use)"
    mysql_exec_file "$f"
    record_migration "$name" "$batch_to_use"
  done < <(filesystem_up_files)

  if [ "$any" = false ]; then
    info "Nothing to migrate."
  else
    info "Migrations completed."
  fi

  if [ "$ARG_SEED" = true ]; then
    run_seeds_if_any
  fi
}

pick_rollback_targets() {
  # prints migration names to rollback in correct order
  if [ -n "$ARG_BATCH" ]; then
    # shellcheck disable=SC2046
    echo "SELECT migration FROM \`$MIGRATIONS_TABLE\` WHERE batch=$ARG_BATCH ORDER BY id DESC;" | mysql $(mysql_args) -N
  elif [ -n "$ARG_ROLLBACK_STEPS" ]; then
    # shellcheck disable=SC2046
    echo "SELECT migration FROM \`$MIGRATIONS_TABLE\` ORDER BY id DESC LIMIT $ARG_ROLLBACK_STEPS;" | mysql $(mysql_args) -N
  else
    # last batch
    # shellcheck disable=SC2046
    echo "SELECT migration FROM \`$MIGRATIONS_TABLE\` WHERE batch=(SELECT COALESCE(MAX(batch),0) FROM \`$MIGRATIONS_TABLE\`) ORDER BY id DESC;" | mysql $(mysql_args) -N
  fi
}

cmd_rollback() {
  require_db_config
  guard_production "rollback migrations"
  ensure_migrations_table

  local any=false
  local name file
  while IFS= read -r name; do
    [ -z "$name" ] && continue
    any=true
    file=$(filesystem_down_for "$name")
    if [ ! -f "$file" ]; then
      die "Down file not found for $name at $file"
    fi
    info "Rolling back: $name"
    mysql_exec_file "$file"
    delete_migration_record "$name"
  done < <(pick_rollback_targets)

  if [ "$any" = false ]; then
    info "Nothing to rollback."
  else
    info "Rollback completed."
  fi
}

cmd_reset() {
  require_db_config
  guard_production "reset migrations"
  ensure_migrations_table
  # roll back everything
  # shellcheck disable=SC2046
  local names
  names=$(echo "SELECT migration FROM \`$MIGRATIONS_TABLE\` ORDER BY id DESC;" | mysql $(mysql_args) -N || true)
  if [ -z "$names" ]; then
    info "Nothing to reset."
    return 0
  fi
  while IFS= read -r name; do
    [ -z "$name" ] && continue
    local file
    file=$(filesystem_down_for "$name")
    [ -f "$file" ] || die "Down file not found for $name at $file"
    info "Reverting: $name"
    mysql_exec_file "$file"
    delete_migration_record "$name"
  done <<< "$names"
  info "Reset completed."
}

drop_all_tables() {
  # drop all base tables (exclude migrations)
  # shellcheck disable=SC2046
  local tables
  tables=$(echo "SHOW FULL TABLES WHERE Table_type='BASE TABLE';" | mysql $(mysql_args) -N | awk '{print $1}')
  local t
  mysql_exec "SET FOREIGN_KEY_CHECKS=0;"
  for t in $tables; do
    if [ "$t" = "$MIGRATIONS_TABLE" ]; then continue; fi
    mysql_exec "DROP TABLE IF EXISTS \`$t\`;"
  done
  if [ "$ARG_DROP_VIEWS" = true ]; then
    # shellcheck disable=SC2046
    local views
    views=$(echo "SHOW FULL TABLES WHERE Table_type='VIEW';" | mysql $(mysql_args) -N | awk '{print $1}')
    for t in $views; do
      mysql_exec "DROP VIEW IF EXISTS \`$t\`;"
    done
  fi
  mysql_exec "SET FOREIGN_KEY_CHECKS=1;"
}

run_seeds_if_any() {
  local seeds_dir="$ARG_PATH/seeds"
  if [ -d "$seeds_dir" ]; then
    info "Running seeds in $seeds_dir"
    # run in filename order
    local f
    for f in $(ls -1 "$seeds_dir"/*.sql 2>/dev/null | sort -V); do
      info "Seeding: $(basename "$f")"
      mysql_exec_file "$f"
    done
  else
    info "Seed directory not found ($seeds_dir). Skipping seeds."
  fi
}

cmd_refresh() {
  cmd_reset
  cmd_migrate
}

cmd_fresh() {
  require_db_config
  guard_production "drop all tables"
  ensure_migrations_table
  drop_all_tables
  # clear migrations table too
  mysql_exec "TRUNCATE TABLE \`$MIGRATIONS_TABLE\`;"
  cmd_migrate
}

cmd_up_one() {
  require_db_config
  ensure_migrations_table
  [ -n "$ARG_FILE" ] || die "--file <name> is required (e.g., 001_create_users_table)"
  local file="$ARG_PATH/$ARG_FILE.up.sql"
  [ -f "$file" ] || die "File not found: $file"
  local exists
  # shellcheck disable=SC2046
  exists=$(echo "SELECT COUNT(*) FROM \`$MIGRATIONS_TABLE\` WHERE migration='$(sql_escape "$ARG_FILE")';" | mysql $(mysql_args) -N)
  if [ "${exists:-0}" -gt 0 ]; then
    info "Already migrated: $ARG_FILE"
    return 0
  fi
  local b=$(( $(current_batch) + 1 ))
  info "Migrating: $ARG_FILE (batch $b)"
  mysql_exec_file "$file"
  record_migration "$ARG_FILE" "$b"
}

cmd_down_one() {
  require_db_config
  ensure_migrations_table
  [ -n "$ARG_FILE" ] || die "--file <name> is required (e.g., 001_create_users_table)"
  local file="$ARG_PATH/$ARG_FILE.down.sql"
  [ -f "$file" ] || die "File not found: $file"
  info "Rolling back: $ARG_FILE"
  mysql_exec_file "$file"
  delete_migration_record "$ARG_FILE"
}

print_help() {
  cat <<EOF
Usage: $0 <command> [options]

Commands
  migrate            Run outstanding migrations
  migrate:install    Create the migrations table if missing
  migrate:status     Show applied and pending migrations
  migrate:rollback   Rollback the last batch (default), or by steps/batch
  migrate:reset      Rollback all migrations
  migrate:refresh    Reset and re-run all migrations
  migrate:fresh      Drop all tables and re-run migrations
  migrate:up         Run a specific migration file
  migrate:down       Rollback last migration or a specific file

Options
  --path <dir>       Directory containing migrations (default: migrations)
  --database <name>  Database name (overrides DB_DATABASE)
  --step             Put each migration in its own batch
  --pretend          Show SQL without executing
  --seed             Run SQL seeds in <path>/seeds
  --force            Allow running in production (APP_ENV=production)
  --file <name>      For up/down: base name of migration file
  --batch <n>        For rollback: rollback only the given batch
  --step <n>         For rollback: number of migrations to rollback
  --drop-views       For fresh: also drop database views
EOF
}

# Arg parsing (global flags can appear anywhere)
CMD=""
if [ $# -gt 0 ]; then
  CMD="$1"; shift
fi

while [ $# -gt 0 ]; do
  case "$1" in
    --path)
      ARG_PATH="$2"; shift 2 ;;
    --database)
      DB_NAME="$2"; shift 2 ;;
    --step)
      if [ "$CMD" = "migrate:rollback" ]; then
        ARG_ROLLBACK_STEPS="$2"; shift 2
      else
        ARG_STEP=true; shift 1
      fi ;;
    --pretend)
      ARG_PRETEND=true; shift 1 ;;
    --seed)
      ARG_SEED=true; shift 1 ;;
    --force)
      ARG_FORCE=true; shift 1 ;;
    --file)
      ARG_FILE="$2"; shift 2 ;;
    --batch)
      ARG_BATCH="$2"; shift 2 ;;
    --drop-views)
      ARG_DROP_VIEWS=true; shift 1 ;;
    -h|--help)
      print_help; exit 0 ;;
    *)
      # Unrecognized arg: stop parsing
      break ;;
  esac
done

[ -z "$CMD" ] && { print_help; exit 1; }

# Normalize path: make relative --path resolve from repo root
case "$ARG_PATH" in
  /*) ;; # absolute
  *) ARG_PATH="$ROOT_DIR/$ARG_PATH" ;;
esac

require_db_config

case "$CMD" in
  migrate|migrate:run)
    cmd_install; cmd_migrate ;;
  migrate:install)
    cmd_install ;;
  migrate:status)
    cmd_status ;;
  migrate:rollback)
    cmd_rollback ;;
  migrate:reset)
    cmd_reset ;;
  migrate:refresh)
    cmd_refresh ;;
  migrate:fresh)
    cmd_fresh ;;
  migrate:up)
    cmd_up_one ;;
  migrate:down)
    if [ -z "$ARG_FILE" ]; then
      ARG_ROLLBACK_STEPS="${ARG_ROLLBACK_STEPS:-1}"
      cmd_rollback
    else
      cmd_down_one
    fi ;;
  *)
    # backward-compat simple aliases
    if [ "$CMD" = "up" ]; then cmd_install; cmd_migrate; exit $?; fi
    if [ "$CMD" = "down" ]; then ARG_ROLLBACK_STEPS="1"; cmd_rollback; exit $?; fi
    if [ "$CMD" = "status" ]; then cmd_status; exit $?; fi
    print_help; exit 1 ;;
esac
