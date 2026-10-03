import hashlib
import json
from http.server import HTTPServer, BaseHTTPRequestHandler

class FiscalEngineHandler(BaseHTTPRequestHandler):
    def _send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path in ("/health", "/ready"):
            self._send_json(200, {"status": "UP", "service": "kudiba-fiscal-engine", "standard": "AGT n.º 71/25"})
        else:
            self._send_json(200, {"status": "OK", "service": "fiscal-engine"})

    def do_POST(self):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length) if content_length > 0 else b"{}"
        try:
            data = json.loads(body.decode("utf-8"))
        except Exception:
            data = {}

        # Algoritmo de Hash em Cadeia da AGT (Decreto Presidencial n.º 71/25):
        # Hash = SHA256(DataEmissao;DataGravacao;NumeroDoc;TotalBruto;HashAnterior)
        doc_num = data.get("document_number", "FT KUD26/000001")
        inv_date = data.get("invoice_date", "2026-10-03")
        sys_date = data.get("system_entry_date", "2026-10-03T08:00:00")
        total = str(data.get("gross_total", "10000.00"))
        prev_hash = data.get("previous_hash", "")

        raw_str = f"{inv_date};{sys_date};{doc_num};{total};{prev_hash}"
        sha = hashlib.sha256(raw_str.encode("utf-8")).hexdigest()
        
        # 4 caracteres de controlo (1º, 11º, 21º, 31º caracteres com índice 0-based: 0, 10, 20, 30)
        val_chars = f"{sha[0]}{sha[10]}{sha[20]}{sha[30]}"

        self._send_json(200, {
            "document_number": doc_num,
            "hash_sha256": sha,
            "validation_chars": val_chars,
            "signature_rsa_base64": f"MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA{sha[:16]}...MOCK_RSA_SIGNATURE",
            "key_version": "1",
            "is_contingency": False,
            "agt_compliance": "Decreto Presidencial n.º 71/25"
        })

if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", 9090), FiscalEngineHandler)
    print("Fiscal Engine Service em execução na porta 9090...")
    server.serve_forever()
