#!/usr/bin/env bash
# =============================================================================
# Kudiba ERP - Inicializador de Servidores Locais (Fora do Docker)
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

if [ ! -f "$ROOT_DIR/Backend/target/debug/kudiba-invoicing" ] || \
   [ ! -f "$ROOT_DIR/Backend/target/debug/kudiba-gateway" ] || \
   [ ! -f "$ROOT_DIR/Backend/target/debug/kudiba-inventory" ] || \
   [ ! -f "$ROOT_DIR/Backend/target/debug/kudiba-treasury" ] || \
   [ ! -f "$ROOT_DIR/Backend/target/debug/kudiba-accounting" ]; then
    echo "Compilando binários do workspace..."
    cargo build --workspace --manifest-path "$ROOT_DIR/Backend/Cargo.toml"
fi

# 0. RabbitMQ (AMQP :5672) - broker de eventos entre microserviços
if nc -z 127.0.0.1 5672 2>/dev/null; then
    echo "[-] RabbitMQ já responde na porta 5672."
elif command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    echo "[+] Iniciando RabbitMQ em container Docker (AMQP :5672 | gestão :15672)..."
    docker run -d --rm --name kudiba-rabbitmq-dev \
        -p 5672:5672 -p 15672:15672 rabbitmq:3-management >/dev/null 2>&1 || true
    echo "    RabbitMQ iniciado (gestão em http://127.0.0.1:15672)."
else
    echo "[!] RabbitMQ indisponível na porta 5672: os eventos entre microserviços ficarão em modo degradado."
fi

# 1. KudibaAuth (FastAPI :8082)
if lsof -i :8082 >/dev/null 2>&1 || nc -z 127.0.0.1 8082 2>/dev/null; then
    echo "[-] KudibaAuth já está em execução (porta 8082 ocupada)."
elif ! python3 -c "import uvicorn" >/dev/null 2>&1; then
    echo "[!] KudibaAuth não iniciado: uvicorn indisponível."
else
    echo "[+] Iniciando KudibaAuth (HTTP :8082)..."
    pushd "$ROOT_DIR/Backend/services/KudibaAuth" >/dev/null
    PYTHONPATH=. ENVIRONMENT=development \
    nohup python3 -m uvicorn src.main:app --host 0.0.0.0 --port 8082 > "$LOGS_DIR/kudiba-auth.log" 2>&1 &
    AUTH_PID=$!
    disown $AUTH_PID 2>/dev/null || true
    popd >/dev/null
    echo $AUTH_PID > "$LOGS_DIR/auth.pid"
    echo "    KudibaAuth iniciado com PID $AUTH_PID (logs em $LOGS_DIR/kudiba-auth.log)"
fi
wait_for_health "http://127.0.0.1:8082/health" "KudibaAuth" 60 || true

# 2. KudibaInvoicing (HTTP :9090 | gRPC :9091)
if lsof -i :9090 >/dev/null 2>&1 || nc -z 127.0.0.1 9090 2>/dev/null; then
    echo "[-] KudibaInvoicing já está em execução (porta 9090 ocupada)."
else
    echo "[+] Iniciando KudibaInvoicing (HTTP :9090 | gRPC :9091)..."
    PORT=9090 \
    GRPC_PORT=9091 \
    RUST_LOG=info,kudiba_invoicing=debug \
    nohup "$ROOT_DIR/Backend/target/debug/kudiba-invoicing" > "$LOGS_DIR/kudiba-invoicing.log" 2>&1 &
    INVOICING_PID=$!
    disown $INVOICING_PID 2>/dev/null || true
    echo $INVOICING_PID > "$LOGS_DIR/invoicing.pid"
    echo "    KudibaInvoicing iniciado com PID $INVOICING_PID (logs em $LOGS_DIR/kudiba-invoicing.log)"
fi
wait_for_health "http://127.0.0.1:9090/health" "KudibaInvoicing" 90 || true

# 3. KudibaInventory (HTTP :8083)
if lsof -i :8083 >/dev/null 2>&1 || nc -z 127.0.0.1 8083 2>/dev/null; then
    echo "[-] KudibaInventory já está em execução (porta 8083 ocupada)."
else
    echo "[+] Iniciando KudibaInventory (HTTP :8083)..."
    PORT=8083 \
    RUST_LOG=info,kudiba_inventory=debug \
    nohup "$ROOT_DIR/Backend/target/debug/kudiba-inventory" > "$LOGS_DIR/kudiba-inventory.log" 2>&1 &
    INVENTORY_PID=$!
    disown $INVENTORY_PID 2>/dev/null || true
    echo $INVENTORY_PID > "$LOGS_DIR/inventory.pid"
    echo "    KudibaInventory iniciado com PID $INVENTORY_PID (logs em $LOGS_DIR/kudiba-inventory.log)"
fi
wait_for_health "http://127.0.0.1:8083/health" "KudibaInventory" 60 || true

# 4. KudibaTreasury (HTTP :8084)
if lsof -i :8084 >/dev/null 2>&1 || nc -z 127.0.0.1 8084 2>/dev/null; then
    echo "[-] KudibaTreasury já está em execução (porta 8084 ocupada)."
else
    echo "[+] Iniciando KudibaTreasury (HTTP :8084)..."
    PORT=8084 \
    RUST_LOG=info,kudiba_treasury=debug \
    nohup "$ROOT_DIR/Backend/target/debug/kudiba-treasury" > "$LOGS_DIR/kudiba-treasury.log" 2>&1 &
    TREASURY_PID=$!
    disown $TREASURY_PID 2>/dev/null || true
    echo $TREASURY_PID > "$LOGS_DIR/treasury.pid"
    echo "    KudibaTreasury iniciado com PID $TREASURY_PID (logs em $LOGS_DIR/kudiba-treasury.log)"
fi
wait_for_health "http://127.0.0.1:8084/health" "KudibaTreasury" 60 || true

# 5. KudibaAccounting (HTTP :8085)
if lsof -i :8085 >/dev/null 2>&1 || nc -z 127.0.0.1 8085 2>/dev/null; then
    echo "[-] KudibaAccounting já está em execução (porta 8085 ocupada)."
else
    echo "[+] Iniciando KudibaAccounting (HTTP :8085)..."
    PORT=8085 \
    RUST_LOG=info,kudiba_accounting=debug \
    nohup "$ROOT_DIR/Backend/target/debug/kudiba-accounting" > "$LOGS_DIR/kudiba-accounting.log" 2>&1 &
    ACCOUNTING_PID=$!
    disown $ACCOUNTING_PID 2>/dev/null || true
    echo $ACCOUNTING_PID > "$LOGS_DIR/accounting.pid"
    echo "    KudibaAccounting iniciado com PID $ACCOUNTING_PID (logs em $LOGS_DIR/kudiba-accounting.log)"
fi
wait_for_health "http://127.0.0.1:8085/health" "KudibaAccounting" 60 || true

# 6. KudibaPayroll (FastAPI :8086)
if lsof -i :8086 >/dev/null 2>&1 || nc -z 127.0.0.1 8086 2>/dev/null; then
    echo "[-] KudibaPayroll já está em execução (porta 8086 ocupada)."
elif ! python3 -c "import uvicorn" >/dev/null 2>&1; then
    echo "[!] KudibaPayroll não iniciado: uvicorn indisponível."
else
    echo "[+] Iniciando KudibaPayroll (HTTP :8086)..."
    pushd "$ROOT_DIR/Backend/services/KudibaPayroll" >/dev/null
    PYTHONPATH=. ENVIRONMENT=development \
    nohup python3 -m uvicorn src.main:app --host 0.0.0.0 --port 8086 > "$LOGS_DIR/kudiba-payroll.log" 2>&1 &
    PAYROLL_PID=$!
    disown $PAYROLL_PID 2>/dev/null || true
    popd >/dev/null
    echo $PAYROLL_PID > "$LOGS_DIR/payroll.pid"
    echo "    KudibaPayroll iniciado com PID $PAYROLL_PID (logs em $LOGS_DIR/kudiba-payroll.log)"
fi
wait_for_health "http://127.0.0.1:8086/health" "KudibaPayroll" 60 || true

# 7. KudibaIntegrations (FastAPI :8087)
if lsof -i :8087 >/dev/null 2>&1 || nc -z 127.0.0.1 8087 2>/dev/null; then
    echo "[-] KudibaIntegrations já está em execução (porta 8087 ocupada)."
elif ! python3 -c "import uvicorn" >/dev/null 2>&1; then
    echo "[!] KudibaIntegrations não iniciado: uvicorn indisponível."
else
    echo "[+] Iniciando KudibaIntegrations (HTTP :8087)..."
    pushd "$ROOT_DIR/Backend/services/KudibaIntegrations" >/dev/null
    PYTHONPATH=. ENVIRONMENT=development \
    nohup python3 -m uvicorn src.main:app --host 0.0.0.0 --port 8087 > "$LOGS_DIR/kudiba-integrations.log" 2>&1 &
    INTEGRATIONS_PID=$!
    disown $INTEGRATIONS_PID 2>/dev/null || true
    popd >/dev/null
    echo $INTEGRATIONS_PID > "$LOGS_DIR/integrations.pid"
    echo "    KudibaIntegrations iniciado com PID $INTEGRATIONS_PID (logs em $LOGS_DIR/kudiba-integrations.log)"
fi
wait_for_health "http://127.0.0.1:8087/health" "KudibaIntegrations" 60 || true

# 8. Kudiba Gateway (HTTP :8080)
if lsof -i :8080 >/dev/null 2>&1 || nc -z 127.0.0.1 8080 2>/dev/null; then
    echo "[-] Kudiba Gateway já está em execução (porta 8080 ocupada)."
else
    echo "[+] Iniciando Kudiba Gateway (HTTP :8080)..."
    GATEWAY_PORT=8080 \
    GATEWAY_ENV=development \
    FISCAL_ENGINE_URL=http://localhost:9090 \
    AUTH_SERVICE_URL=http://localhost:8082 \
    INVENTORY_SERVICE_URL=http://localhost:8083 \
    TREASURY_SERVICE_URL=http://localhost:8084 \
    ACCOUNTING_SERVICE_URL=http://localhost:8085 \
    PAYROLL_SERVICE_URL=http://localhost:8086 \
    INTEGRATIONS_SERVICE_URL=http://localhost:8087 \
    RUST_LOG=info,kudiba_gateway=debug \
    nohup "$ROOT_DIR/Backend/target/debug/kudiba-gateway" > "$LOGS_DIR/kudiba-gateway.log" 2>&1 &
    GATEWAY_PID=$!
    disown $GATEWAY_PID 2>/dev/null || true
    echo $GATEWAY_PID > "$LOGS_DIR/gateway.pid"
    echo "    Kudiba Gateway iniciado com PID $GATEWAY_PID (logs em $LOGS_DIR/kudiba-gateway.log)"
fi
wait_for_health "http://127.0.0.1:8080/health" "Kudiba Gateway" 60 || true

echo ""
echo "=== Estado dos Servidores ==="
"$SCRIPT_DIR/status-local.sh"
