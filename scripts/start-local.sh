#!/usr/bin/env bash
# =============================================================================
# Kudiba ERP - Inicializador de Servidores Locais (Fora do Docker)
# Ordem: KudibaAuth (:8082) -> KudibaInvoicing (:9090/:9091) -> Kudiba Gateway (:8080)
# Requer Postgres (:5432) e Redis (:6379) acessíveis (ex.: docker compose up -d postgres gateway-redis)
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOGS_DIR="$ROOT_DIR/.run_logs"
mkdir -p "$LOGS_DIR"

wait_for_health() {
    local url="$1" name="$2" tries="${3:-30}"
    for _ in $(seq 1 "$tries"); do
        if curl -s -f "$url" >/dev/null 2>&1; then
            return 0
        fi
        sleep 1
    done
    echo "[!] $name não respondeu em ${url} após ${tries}s."
    return 1
}

echo "=== Kudiba ERP: Inicializando servidores locais ==="

# Verifica se os binários existem, ou compila
if [ ! -f "$ROOT_DIR/Backend/target/debug/kudiba-invoicing" ] || [ ! -f "$ROOT_DIR/Backend/target/debug/kudiba-gateway" ] || [ ! -f "$ROOT_DIR/Backend/target/debug/kudiba-inventory" ]; then
    echo "Compilando binários do workspace..."
    cargo build --workspace --manifest-path "$ROOT_DIR/Backend/Cargo.toml"
fi

# 1. Iniciar KudibaAuth (FastAPI)
if lsof -i :8082 >/dev/null 2>&1 || nc -z 127.0.0.1 8082 2>/dev/null; then
    echo "[-] KudibaAuth já está em execução (porta 8082 ocupada)."
elif ! python3 -c "import uvicorn" >/dev/null 2>&1; then
    echo "[!] KudibaAuth não iniciado: uvicorn indisponível (instale as deps do pyproject.toml)."
else
    echo "[+] Iniciando KudibaAuth (HTTP :8082)..."
    pushd "$ROOT_DIR/Backend/services/KudibaAuth" >/dev/null
    PYTHONPATH=. ENVIRONMENT=development \
    nohup python3 -m uvicorn src.main:app --host 0.0.0.0 --port 8082 > "$LOGS_DIR/kudiba-auth.log" 2>&1 &
    AUTH_PID=$!
    popd >/dev/null
    echo $AUTH_PID > "$LOGS_DIR/auth.pid"
    echo "    KudibaAuth iniciado com PID $AUTH_PID (logs em $LOGS_DIR/kudiba-auth.log)"
fi

# Aguarda readiness do Auth (polling)
wait_for_health "http://127.0.0.1:8082/health" "KudibaAuth" 60 || true

# 2. Iniciar KudibaInvoicing
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

# Aguarda readiness do Invoicing (polling; inclui geração da chave RSA-2048)
wait_for_health "http://127.0.0.1:9090/health" "KudibaInvoicing" 90 || true

# 3. Iniciar KudibaInventory
if lsof -i :8083 >/dev/null 2>&1 || nc -z 127.0.0.1 8083 2>/dev/null; then
    echo "[-] KudibaInventory já está em execução (porta 8083 ocupada)."
else
    echo "[+] Iniciando KudibaInventory (HTTP :8083)..."
    PORT=8083 \
    RUST_LOG=info,kudiba_inventory=debug \
    nohup "$ROOT_DIR/Backend/target/debug/kudiba-inventory" > "$LOGS_DIR/kudiba-inventory.log" 2>&1 &
    INVENTORY_PID=$!
    echo $INVENTORY_PID > "$LOGS_DIR/inventory.pid"
    echo "    KudibaInventory iniciado com PID $INVENTORY_PID (logs em $LOGS_DIR/kudiba-inventory.log)"
fi

# Aguarda readiness do Inventory (polling)
wait_for_health "http://127.0.0.1:8083/health" "KudibaInventory" 60 || true

# 4. Iniciar Kudiba Gateway
if lsof -i :8080 >/dev/null 2>&1 || nc -z 127.0.0.1 8080 2>/dev/null; then
    echo "[-] Kudiba Gateway já está em execução (porta 8080 ocupada)."
else
    echo "[+] Iniciando Kudiba Gateway (HTTP :8080)..."
    GATEWAY_PORT=8080 \
    GATEWAY_ENV=development \
    FISCAL_ENGINE_URL=http://localhost:9090 \
    INVENTORY_SERVICE_URL=http://localhost:8083 \
    RUST_LOG=info,kudiba_gateway=debug \
    nohup "$ROOT_DIR/Backend/target/debug/kudiba-gateway" > "$LOGS_DIR/kudiba-gateway.log" 2>&1 &
    GATEWAY_PID=$!
    echo $GATEWAY_PID > "$LOGS_DIR/gateway.pid"
    echo "    Kudiba Gateway iniciado com PID $GATEWAY_PID (logs em $LOGS_DIR/kudiba-gateway.log)"
fi

# Aguarda readiness do Gateway (polling)
wait_for_health "http://127.0.0.1:8080/health" "Kudiba Gateway" 60 || true

echo ""
echo "=== Estado dos Servidores ==="
"$SCRIPT_DIR/status-local.sh"
