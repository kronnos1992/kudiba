#!/usr/bin/env bash
# =============================================================================
# Kudiba ERP - Parar Servidores Locais (Fora do Docker)
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOGS_DIR="$ROOT_DIR/.run_logs"

echo "=== Parando servidores Kudiba locais ==="

stop_service() {
    local name="$1" pid_file="$2" bin_pattern="$3"
    if [ -f "$LOGS_DIR/$pid_file" ]; then
        PID=$(cat "$LOGS_DIR/$pid_file")
        if kill -0 "$PID" 2>/dev/null; then
            echo "[+] Encerrando $name (PID $PID)..."
            kill "$PID" 2>/dev/null || true
        fi
        rm -f "$LOGS_DIR/$pid_file"
    fi
    pkill -f "$bin_pattern" 2>/dev/null || true
}

stop_service "KudibaAuth" "auth.pid" "uvicorn src.main:app --host 0.0.0.0 --port 8082"
stop_service "KudibaPayroll" "payroll.pid" "uvicorn src.main:app --host 0.0.0.0 --port 8086"
stop_service "KudibaIntegrations" "integrations.pid" "uvicorn src.main:app --host 0.0.0.0 --port 8087"
stop_service "Kudiba Gateway" "gateway.pid" "kudiba-gateway"
stop_service "KudibaInvoicing" "invoicing.pid" "kudiba-invoicing"
stop_service "KudibaInventory" "inventory.pid" "kudiba-inventory"
stop_service "KudibaTreasury" "treasury.pid" "kudiba-treasury"
stop_service "KudibaAccounting" "accounting.pid" "kudiba-accounting"

if command -v docker >/dev/null 2>&1; then
    docker rm -f kudiba-rabbitmq-dev >/dev/null 2>&1 || true
fi

echo "[✓] Todos os servidores Kudiba foram encerrados com sucesso."
