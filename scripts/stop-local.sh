#!/usr/bin/env bash
# =============================================================================
# Kudiba ERP - Parar Servidores Locais (Fora do Docker)
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOGS_DIR="$ROOT_DIR/.run_logs"

echo "=== Parando servidores Kudiba locais ==="

# Parar Gateway por PID se existir
if [ -f "$LOGS_DIR/gateway.pid" ]; then
    PID=$(cat "$LOGS_DIR/gateway.pid")
    if kill -0 "$PID" 2>/dev/null; then
        echo "[+] Encerrando Kudiba Gateway (PID $PID)..."
        kill "$PID" 2>/dev/null || true
    fi
    rm -f "$LOGS_DIR/gateway.pid"
fi
pkill -f "kudiba-gateway" 2>/dev/null || true

# Parar Invoicing por PID se existir
if [ -f "$LOGS_DIR/invoicing.pid" ]; then
    PID=$(cat "$LOGS_DIR/invoicing.pid")
    if kill -0 "$PID" 2>/dev/null; then
        echo "[+] Encerrando KudibaInvoicing (PID $PID)..."
        kill "$PID" 2>/dev/null || true
    fi
    rm -f "$LOGS_DIR/invoicing.pid"
fi
pkill -f "kudiba-invoicing" 2>/dev/null || true

echo "[✓] Todos os servidores Kudiba foram encerrados com sucesso."
