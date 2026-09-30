import socket, os, base64, hashlib, json, struct, time, urllib.request

def get_ws_url():
    tabs = json.loads(urllib.request.urlopen('http://localhost:9222/json').read().decode())
    for t in tabs:
        if t.get('url', '').startswith('http://localhost:3000'):
            return t['webSocketDebuggerUrl']
    return None

class SimpleWS:
    def __init__(self, ws_url):
        # ws://localhost:9222/devtools/page/...
        path = ws_url.split('localhost:9222')[1]
        self.s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.s.connect(('127.0.0.1', 9222))
        sec_key = base64.b64encode(os.urandom(16)).decode()
        handshake = (
            f"GET {path} HTTP/1.1\r\n"
            f"Host: localhost:9222\r\n"
            f"Upgrade: websocket\r\n"
            f"Connection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {sec_key}\r\n"
            f"Sec-WebSocket-Version: 13\r\n\r\n"
        )
        self.s.sendall(handshake.encode())
        resp = self.s.recv(4096)
        if b"101 " not in resp:
            raise Exception(f"WS Handshake failed: {resp[:100]}")
        self.msg_id = 0

    def send(self, method, params=None):
        self.msg_id += 1
        msg = json.dumps({"id": self.msg_id, "method": method, "params": params or {}}).encode()
        frame = bytearray([0x81]) # text frame, FIN
        length = len(msg)
        mask = os.urandom(4)
        if length <= 125:
            frame.append(0x80 | length)
        elif length <= 65535:
            frame.append(0x80 | 126)
            frame.extend(struct.pack("!H", length))
        else:
            frame.append(0x80 | 127)
            frame.extend(struct.pack("!Q", length))
        frame.extend(mask)
        masked_data = bytearray(b ^ mask[i % 4] for i, b in enumerate(msg))
        frame.extend(masked_data)
        self.s.sendall(frame)
        return self.msg_id

    def recv(self, target_id=None):
        while True:
            head = self.s.recv(2)
            if not head: return None
            b1, b2 = head[0], head[1]
            masked = (b2 & 0x80) != 0
            payload_len = b2 & 0x7f
            if payload_len == 126:
                payload_len = struct.unpack("!H", self.s.recv(2))[0]
            elif payload_len == 127:
                payload_len = struct.unpack("!Q", self.s.recv(8))[0]
            mask = self.s.recv(4) if masked else None
            data = bytearray()
            while len(data) < payload_len:
                chunk = self.s.recv(min(payload_len - len(data), 65536))
                if not chunk: break
                data.extend(chunk)
            if masked:
                data = bytearray(b ^ mask[i % 4] for i, b in enumerate(data))
            try:
                res = json.loads(data.decode('utf-8', errors='ignore'))
                if target_id is None or res.get('id') == target_id:
                    return res
            except:
                pass

if __name__ == '__main__':
    ws_url = get_ws_url()
    print("Connecting to:", ws_url)
    ws = SimpleWS(ws_url)

    print("Reloading page...")
    mid = ws.send("Page.reload", {"ignoreCache": True})
    ws.recv(mid)
    time.sleep(2.5)

    print("Capturing main menu screenshot...")
    mid = ws.send("Page.captureScreenshot", {"format": "png"})
    res = ws.recv(mid)
    img_b64 = res["result"]["data"]
    out_path = "/Users/hareramsharma/.gemini/antigravity-ide/brain/25e2415d-947a-463f-9bd9-9cbcb193d2d1/game_main_menu.png"
    with open(out_path, "wb") as f:
        f.write(base64.b64decode(img_b64))
    print("Screenshot saved to:", out_path)
