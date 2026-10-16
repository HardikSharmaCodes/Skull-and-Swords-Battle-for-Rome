import socket, os, base64, json, struct, time, urllib.request

def get_ws_url():
    tabs = json.loads(urllib.request.urlopen('http://localhost:9222/json').read().decode())
    for t in tabs:
        if t.get('url', '').startswith('http://localhost:3001'):
            return t['webSocketDebuggerUrl']
    return None

class SimpleWS:
    def __init__(self, ws_url):
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
        frame = bytearray([0x81])
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
                chunk = self.s.recv(payload_len - len(data))
                if not chunk: break
                data.extend(chunk)
            if masked:
                data = bytearray(b ^ mask[i % 4] for i, b in enumerate(data))
            try:
                msg = json.loads(data.decode('utf-8'))
                if target_id is None or msg.get('id') == target_id:
                    return msg
            except Exception:
                pass

def evaluate_js(ws, expr):
    mid = ws.send("Runtime.evaluate", {"expression": expr, "returnByValue": True, "awaitPromise": True})
    res = ws.recv(mid)
    return res.get('result', {}).get('result', {}).get('value')

def capture_screenshot(ws, output_path):
    mid = ws.send("Page.captureScreenshot", {"format": "png"})
    res = ws.recv(mid)
    data = res.get('result', {}).get('data')
    if data:
        with open(output_path, "wb") as f:
            f.write(base64.b64decode(data))
        print(f"Screenshot saved to {output_path}")

def main():
    ws_url = get_ws_url()
    if not ws_url:
        print("No tab found at http://localhost:3001")
        return
    ws = SimpleWS(ws_url)

    # 1. Reload page
    ws.send("Page.reload")
    time.sleep(2)

    # 2. Click DEBUG MODE button
    click_debug = evaluate_js(ws, """
        (() => {
            const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('DEBUG MODE'));
            if (btn) { btn.click(); return 'clicked debug mode'; }
            return 'debug mode button not found';
        })()
    """)
    print("Debug button:", click_debug)
    time.sleep(2)

    # 3. Select Rome
    select_rome = evaluate_js(ws, """
        (() => {
            const c = document.querySelector('canvas');
            const downEvt = new MouseEvent('mousedown', { clientX: 250, clientY: 460, button: 0, bubbles: true });
            c.dispatchEvent(downEvt);
            const upEvt = new MouseEvent('mouseup', { clientX: 250, clientY: 460, button: 0, bubbles: true });
            window.dispatchEvent(upEvt);
            return 'dispatched click on Rome';
        })()
    """)
    print("Select Rome:", select_rome)
    time.sleep(1)

    # 4. Open Raise Forces & Scouts
    open_recruit = evaluate_js(ws, """
        (() => {
            const btn = Array.from(document.querySelectorAll('button')).find(b => 
                (b.innerText || '').includes('Raise Forces') || (b.title || '').includes('Raise Forces')
            );
            if (btn) { btn.click(); return 'clicked raise forces button'; }
            return 'raise forces button not found';
        })()
    """)
    print("Open recruit:", open_recruit)
    time.sleep(1)

    # 5. Click the "RAISE FORCES" tab inside the modal
    raise_forces_tab = evaluate_js(ws, """
        (() => {
            const btn = Array.from(document.querySelectorAll('button')).find(b => 
                (b.innerText || '').toUpperCase().includes('RAISE FORCES')
            );
            if (btn) { btn.click(); return 'clicked Raise Forces tab'; }
            return 'Raise Forces tab not found';
        })()
    """)
    print("Raise forces tab:", raise_forces_tab)
    time.sleep(1)

    # 6. Click APPOINT GENERAL
    raise_candidate = evaluate_js(ws, """
        (() => {
            const btn = Array.from(document.querySelectorAll('button')).find(b => 
                (b.innerText || '').toUpperCase().includes('APPOINT GENERAL')
            );
            if (btn) { btn.click(); return 'clicked APPOINT GENERAL!'; }
            return 'APPOINT GENERAL not found';
        })()
    """)
    print("Appoint general:", raise_candidate)
    time.sleep(2)

    # 7. Check buttons now: Army Division Bar and Legion Dossier should be present!
    army_bar_buttons = evaluate_js(ws, """
        Array.from(document.querySelectorAll('button')).map(b => (b.innerText || b.title || '').trim()).filter(Boolean)
    """)
    print(f"Buttons after raising general: {army_bar_buttons}")

    # 8. Check if "RAISE UNITS" button exists in the division bar
    has_raise_units = any('RAISE UNITS' in b.upper() for b in army_bar_buttons)
    print(f"Has 'RAISE UNITS' button: {has_raise_units}")

    # 9. Click "RAISE UNITS" button
    click_raise_units = evaluate_js(ws, """
        (() => {
            const btn = Array.from(document.querySelectorAll('button')).find(b => 
                (b.innerText || '').toUpperCase().includes('RAISE UNITS')
            );
            if (btn) { btn.click(); return 'clicked RAISE UNITS button'; }
            return 'RAISE UNITS button not found';
        })()
    """)
    print("Click Raise Units:", click_raise_units)
    time.sleep(1)

    # 10. Click "+ EQUIP COHORT"
    equip_res = evaluate_js(ws, """
        (() => {
            const equipBtns = Array.from(document.querySelectorAll('button')).filter(b => 
                (b.innerText || '').toUpperCase().includes('EQUIP COHORT')
            );
            if (equipBtns.length >= 2) {
                // Equip Sword Levis twice
                equipBtns[0].click();
                setTimeout(() => equipBtns[0].click(), 300);
                // Equip Javelins once
                setTimeout(() => equipBtns[1].click(), 600);
                return `Equipped Sword Levis and Javelins! Total buttons: ${equipBtns.length}`;
            }
            return 'No equip buttons found';
        })()
    """)
    print("Equip result:", equip_res)
    time.sleep(2)

    # 11. Check unit cards rendered in the 20-slot bar
    units_in_bar = evaluate_js(ws, """
        (() => {
            // Check green health bars
            const greenBars = document.querySelectorAll('div[style*="linear-gradient(90deg, #27ae60, #2ecc71)"], div[style*="linear-gradient(90deg, rgb(39, 174, 96), rgb(46, 204, 113))"]');
            return {
                equippedCardsWithGreenBars: greenBars.length
            };
        })()
    """)
    print("Units in 20-slot bar:", units_in_bar)

    # 12. Save screenshot of the equipped division bar
    out_path = "/Users/hareramsharma/.gemini/antigravity-ide/brain/4d6fed26-feca-4617-9500-63a60e786c94/army_division_verified.png"
    capture_screenshot(ws, out_path)

if __name__ == '__main__':
    main()
