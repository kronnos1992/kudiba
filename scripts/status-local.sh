#!/usr/bin/env bash
# =============================================================================
# Kudiba ERP - Verificar Estado dos Servidores Locais
# =============================================================================

check_service() {
    local name="$1" url="$2"
    echo "--- $name ($url) ---"
    if curl -s -f "$url" >/dev/null 2>&1; then
        RESP=$(curl -s "$url")
        echo "  Status:      ONLINE"
        echo "  Resposta:    $RESP"
    else
        echo "  Status:      OFFLINE"
    fi
    echo ""
}

echo "--- RabbitMQ (AMQP :5672) ---"
if nc -z 127.0.0.1 5672 2>/dev/null; then
    echo "  Status:      ONLINE (127.0.0.1:5672)"
    echo "  Gestão:      http://127.0.0.1:15672"
else
    echo "  Status:      OFFLINE"
fi
echo ""

check_service "KudibaAuth" "http://127.0.0.1:8082/health"

echo "--- KudibaInvoicing (REST :9090 | gRPC :9091) ---"
if curl -s -f http://127.0.0.1:9090/health >/dev/null 2>&1; then
    HEALTH=$(curl -s http://127.0.0.1:9090/health)
    echo "  Status REST: ONLINE (http://127.0.0.1:9090)"
    echo "  Scalar Docs: http://127.0.0.1:9090/scalar"
    echo "  Resposta:    $HEALTH"
else
    echo "  Status REST: OFFLINE"
fi

if nc -z 127.0.0.1 9091 2>/dev/null; then
    echo "  Status gRPC: ONLINE (127.0.0.1:9091)"
else
    echo "  Status gRPC: OFFLINE"
fi
echo ""

check_service "KudibaInventory" "http://127.0.0.1:8083/health"
check_service "KudibaTreasury" "http://127.0.0.1:8084/health"
check_service "KudibaAccounting" "http://127.0.0.1:8085/health"
check_service "KudibaPayroll" "http://127.0.0.1:8086/health"
check_service "KudibaIntegrations" "http://127.0.0.1:8087/health"
check_service "KudibaBackoffice" "http://127.0.0.1:8088/health"

echo "--- Kudiba Gateway (HTTP :8080) ---"
if curl -s -f http://127.0.0.1:8080/health >/dev/null 2>&1; then
    GATEWAY_HEALTH=$(curl -s http://127.0.0.1:8080/health)
    echo "  Status:      ONLINE (http://127.0.0.1:8080)"
    echo "  Scalar Docs: http://127.0.0.1:8080/scalar"
    echo "  OpenAPI:     http://127.0.0.1:8080/api-docs/openapi.yaml"
    echo "  Resposta:    $GATEWAY_HEALTH"
else
    echo "  Status:      OFFLINE"
fi
echo ""

echo "--- Frontend (HTTP :3000) ---"
if curl -s -f http://127.0.0.1:3000/ >/dev/null 2>&1; then
    echo "  Status:      ONLINE (http://localhost:3000)"
else
    echo "  Status:      OFFLINE"
fi
