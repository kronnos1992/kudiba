import json
from http.server import HTTPServer, BaseHTTPRequestHandler

class CoreApiHandler(BaseHTTPRequestHandler):
    def _send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path in ("/health", "/ready"):
            self._send_json(200, {"status": "UP", "service": "kudiba-core-api"})
        elif self.path.startswith("/api/v1/invoices"):
            self._send_json(200, {
                "invoices": [
                    {
                        "document_number": "FT KUD26/000001",
                        "customer": "Consumidor Final",
                        "gross_total": 45000.00,
                        "status": "ISSUED",
                        "validation_chars": "k8X1"
                    }
                ]
            })
        else:
            self._send_json(200, {"status": "OK", "path": self.path})

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length) if content_length > 0 else b"{}"
        try:
            data = json.loads(body.decode("utf-8"))
        except Exception:
            data = {}

        if "/auth/login" in self.path:
            self._send_json(200, {
                "access_token": "eyJhbGciOiJFZERTQSI...kudiba_mock_jwt_token",
                "token_type": "Bearer",
                "expires_in": 3600,
                "user": {
                    "id": "usr-0001",
                    "name": "Operador Comercial Demo",
                    "email": data.get("email", "operador@kudiba.ao"),
                    "role": "CASHIER",
                    "tenant_id": "a0000000-0000-0000-0000-000000000001"
                }
            })
        elif "/invoices" in self.path:
            self._send_json(201, {
                "document_number": "FT KUD26/000002",
                "status": "ISSUED",
                "gross_total": data.get("gross_total", 15000.00),
                "validation_chars": "m9Y2",
                "message": "Fatura registada e em conformidade com o Decreto Presidencial n.º 71/25"
            })
        elif "/pos/sync" in self.path:
            self._send_json(200, {
                "synced_records": 12,
                "status": "SYNCED",
                "timestamp": "2026-10-03T08:00:00Z"
            })
        else:
            self._send_json(200, {"received": data, "path": self.path})

if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", 8081), CoreApiHandler)
    print("Core API Mock Server em execução na porta 8081...")
    server.serve_forever()
