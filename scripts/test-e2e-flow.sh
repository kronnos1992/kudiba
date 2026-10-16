#!/usr/bin/env bash
# =============================================================================
# Kudiba ERP - Executar Teste de Integração Ponta-a-Ponta (E2E Smoke Test)
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

export GATEWAY_URL="${GATEWAY_URL:-http://127.0.0.1:8080}"
export JWT_SECRET="${JWT_SECRET:-kudiba_jwt_secret_development_key_change_in_production_2026}"
export TENANT_ID="${TENANT_ID:-a0000000-0000-0000-0000-000000000001}"
export BRANCH_ID="${BRANCH_ID:-b0000000-0000-0000-0000-000000000001}"

python3 "$SCRIPT_DIR/test-e2e-flow.py"
