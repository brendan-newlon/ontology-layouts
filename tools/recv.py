# Local-only receiver for the layout lab: saves a POSTed body to _temp/<name> at the repository root.
# Run from anywhere: python tools/recv.py   (listens on 127.0.0.1:8013, accepts pages served from localhost:8011)
import http.server, os
out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '_temp')
os.makedirs(out, exist_ok=True)
class H(http.server.BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', 'http://localhost:8011'); self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS'); self.send_header('Access-Control-Allow-Headers', 'Content-Type')
    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()
    def do_POST(self):
        name = os.path.basename(self.path.strip('/')) or 'out.json'
        body = self.rfile.read(int(self.headers.get('Content-Length', 0)))
        open(os.path.join(out, name), 'wb').write(body)
        self.send_response(200); self._cors(); self.end_headers(); self.wfile.write(b'saved ' + str(len(body)).encode())
http.server.HTTPServer(('127.0.0.1', 8013), H).serve_forever()
