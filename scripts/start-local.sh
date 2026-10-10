#!/usr/bin/env bash
# =============================================================================
# Kudiba ERP - Inicializador de Servidores Locais (Fora do Docker)
# Inicia KudibaInvoicing (Portas 9090 e 9091) e kudiba-gateway (Porta 8080)
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOGS_DIR="$ROOT_DIR/.run_logs"
mkdir -p "$LOGS_DIR"

echo "=== Kudiba ERP: Inicializando servidores locais ==="

# Verifica se os binários existem, ou compila
if [ ! -f "$ROOT_DIR/Backend/target/debug/kudiba-invoicing" ] || [ ! -f "$ROOT_DIR/Backend/target/debug/kudiba-gateway" ]; then
    echo "Compilando binários do workspace..."
    cargo build --workspace --manifest-path "$ROOT_DIR/Backend/Cargo.toml"
fi

# 1. Iniciar KudibaInvoicing
if lsof -i :9090 >/dev/null 2>&1 || nc -z 127.0.0.1 9090 2>/dev/null; then
    echo "[-] KudibaInvoicing já está em execução (porta 9090 ocupada)."
else
    echo "[+] Iniciando KudibaInvoicing (HTTP :9090 | gRPC :9091)..."
    PORT=9090 \
    GRPC_PORT=9091 \
    RUST_LOG=info,kudiba_invoicing=debug \
    nohup "$ROOT_DIR/Backend/target/debug/kudiba-invoicing" > "$LOGS_DIR/kudiba-invoicing.log" 2>&1 &
    INVOICING_PID=$!
    echo $INVOICING_PID > "$LOGS_DIR/invoicing.pid"
    echo "    KudibaInvoicing iniciado com PID $INVOICING_PID (logs em $LOGS_DIR/kudiba-invoicing.log)"
fi

# Aguarda inicialização do Invoicing
sleep 3

# 2. Iniciar Kudiba Gateway
if lsof -i :8080 >/dev/null 2>&1 || nc -z 127.0.0.1 8080 2>/dev/null; then
    echo "[-] Kudiba Gateway já está em execução (porta 8080 ocupada)."
else
    echo "[+] Iniciando Kudiba Gateway (HTTP :8080)..."
    GATEWAY_PORT=8080 \
    GATEWAY_ENV=development \
    FISCAL_ENGINE_URL=http://localhost:9090 \
    RUST_LOG=info,kudiba_gateway=debug \
    nohup "$ROOT_DIR/Backend/target/debug/kudiba-gateway" > "$LOGS_DIR/kudiba-gateway.log" 2>&1 &
    GATEWAY_PID=$!
    echo $GATEWAY_PID > "$LOGS_DIR/gateway.pid"
    echo "    Kudiba Gateway iniciado com PID $GATEWAY_PID (logs em $LOGS_DIR/kudiba-gateway.log)"
fi

echo ""
echo "=== Estado dos Servidores ==="
"$SCRIPT_DIR/status-local.sh"
