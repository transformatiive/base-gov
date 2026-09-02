#!/usr/bin/env bash
# Per-boot reconciliation for Cloud Agent environments.
# Idempotent: starts the local PostgreSQL 16 cluster and ensures the
# `basegov` role/database exist so the app's default DATABASE_URL works.
set -euo pipefail

PG_VERSION=16
DB_USER=basegov
DB_PASS=basegov
DB_NAME=basegov

# Initialize a cluster if the base image/snapshot does not have one yet.
if ! pg_lsclusters -h 2>/dev/null | awk '{print $1"/"$2}' | grep -qx "${PG_VERSION}/main"; then
  sudo pg_createcluster "${PG_VERSION}" main
fi

# Start the cluster (no-op if already online).
sudo pg_ctlcluster "${PG_VERSION}" main start || true

# Wait for the server to accept connections.
for _ in $(seq 1 30); do
  if sudo -u postgres pg_isready -q; then break; fi
  sleep 1
done

# Ensure the application role exists with a known password.
sudo -u postgres psql -v ON_ERROR_STOP=1 <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}';
  END IF;
END \$\$;
SQL

# Ensure the application database exists (owned by the app role).
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'" | grep -q 1; then
  sudo -u postgres createdb -O "${DB_USER}" "${DB_NAME}"
fi

echo "[cloud-start] PostgreSQL ${PG_VERSION} ready; role/database '${DB_NAME}' ensured."
