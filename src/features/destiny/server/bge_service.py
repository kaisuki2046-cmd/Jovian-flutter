import json
import os
from http.server import BaseHTTPRequestHandler, HTTPServer

from sentence_transformers import SentenceTransformer


def main():
    model_path = os.environ["DESTINY_BGE_MODEL_PATH"]
    model = SentenceTransformer(model_path, local_files_only=True, trust_remote_code=False)

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            if self.path != "/v1/embeddings":
                self.send_error(404)
                return
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if not 0 < length <= 128_000:
                    raise ValueError()
                payload = json.loads(self.rfile.read(length))
                items = payload.get("input")
                if (
                    payload.get("model") != "BAAI/bge-m3"
                    or not isinstance(items, list)
                    or not 0 < len(items) <= 128
                    or not all(isinstance(item, str) and 0 < len(item) <= 1000 for item in items)
                ):
                    raise ValueError()
            except (ValueError, AttributeError):
                self.send_error(400)
                return
            try:
                vectors = model.encode(items, normalize_embeddings=True, show_progress_bar=False)
            except Exception:
                self.send_error(503)
                return
            body = json.dumps({"data": [
                {"index": index, "embedding": vector.tolist()} for index, vector in enumerate(vectors)
            ]}).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    port = int(os.environ.get("DESTINY_BGE_PORT", "8789"))
    with HTTPServer(("127.0.0.1", port), Handler) as server:
        print(f"BGE-M3 embedding service is ready on port {port}.", flush=True)
        server.serve_forever()


if __name__ == "__main__":
    main()
