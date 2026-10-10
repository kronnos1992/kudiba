#!/usr/bin/env bash
# =============================================================================
# Kudiba ERP - Verificar Estado dos Servidores Locais
# =============================================================================

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
