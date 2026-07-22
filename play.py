"""Toot and Scoot launcher.

Double-click this file to start a tiny local web server and open the game
in your browser (like vite's dev server). Leave the console window open
while playing; close it to stop the server.

Extras:
- Boss mode: `python play.py --level 5` starts every new game at that level
  (bosses are every 5th level, so 5, 10, 15... jump straight to the fight).
  Double-clicking without arguments starts at level 1 as usual.
- Fixed port 8765 so the browser origin (and the localStorage leaderboard)
  stays the same every time. Re-running while the server is up just opens
  another browser tab.
- Live reload: the server watches the game files (html, css/, js/) and the
  page auto-refreshes when any of them change. If a game is in progress
  (window.running), the refresh politely waits until you're back on the
  title screen. The reload snippet is injected at serve time only — the
  files on disk are untouched.
"""
import argparse
import functools
import http.server
import os
import socket
import socketserver
import threading
import webbrowser

PORT = 8765
GAME = "toot-and-scoot.html"
HERE = os.path.dirname(os.path.abspath(__file__))
URL = "http://127.0.0.1:%d/%s" % (PORT, GAME)


def parse_args():
    p = argparse.ArgumentParser(description="Toot and Scoot launcher")
    p.add_argument("--level", type=int, default=1, metavar="N",
                   help="boss mode: start every new game at level N "
                        "(bosses are every 5th level)")
    return p.parse_args()

WATCH_DIRS = ["css", "js"]
WATCH_FILES = [GAME]

RELOAD_SNIPPET = b"""
<script>
/* injected by play.py (dev live-reload); not part of the game files */
(function () {
  var v0 = null;
  function tick() {
    fetch('/__version').then(function (r) { return r.text(); }).then(function (v) {
      if (v0 === null) { v0 = v; }
      else if (v !== v0) {
        if (window.running) { setTimeout(tick, 2000); return; }  // don't kill a live game
        location.reload();
        return;
      }
      setTimeout(tick, 1000);
    }).catch(function () { setTimeout(tick, 2000); });
  }
  tick();
})();
</script>
"""


def version_stamp():
    """Newest mtime + file count across watched files (count catches add/delete)."""
    newest, count = 0.0, 0
    paths = [os.path.join(HERE, f) for f in WATCH_FILES]
    for d in WATCH_DIRS:
        full = os.path.join(HERE, d)
        if os.path.isdir(full):
            for name in os.listdir(full):
                paths.append(os.path.join(full, name))
    for p in paths:
        try:
            newest = max(newest, os.path.getmtime(p))
            count += 1
        except OSError:
            pass
    return "%s:%d" % (newest, count)


def port_in_use(port):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        return s.connect_ex(("127.0.0.1", port)) == 0
    finally:
        s.close()


class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass  # keep the console clean for kid eyes

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")  # dev server: always revalidate
        http.server.SimpleHTTPRequestHandler.end_headers(self)

    last_stamp = [None]  # shared across requests (class-level, list for mutability)

    def do_GET(self):
        if self.path == "/__version":
            stamp = version_stamp()
            if Handler.last_stamp[0] is not None and stamp != Handler.last_stamp[0]:
                print("File change detected -> browser will reload " +
                      "(waits for the title screen if a match is on)", flush=True)
            Handler.last_stamp[0] = stamp
            body = stamp.encode()
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if self.path.split("?")[0] == "/" + GAME:
            print("Game loaded in browser  *pfft*", flush=True)
            try:
                with open(os.path.join(HERE, GAME), "rb") as f:
                    body = f.read()
            except OSError:
                self.send_error(404)
                return
            if b"</body>" in body:
                body = body.replace(b"</body>", RELOAD_SNIPPET + b"</body>", 1)
            else:
                body += RELOAD_SNIPPET
            self.send_response(200)
            self.send_header("Content-Type", "text/html")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        http.server.SimpleHTTPRequestHandler.do_GET(self)


def watch_escape_key(httpd):
    """Windows console: press ESC to stop the server (thread; no-op elsewhere)."""
    try:
        import msvcrt
    except ImportError:
        return  # non-Windows: Ctrl+C / closing the window still works
    import time
    while True:
        if msvcrt.kbhit() and msvcrt.getch() == b"\x1b":
            print("\nStopping... bye! *toot*")
            httpd.shutdown()
            return
        time.sleep(0.1)


def main():
    args = parse_args()
    url = URL
    if args.level > 1:
        url += "?level=%d" % max(1, min(99, args.level))

    if port_in_use(PORT):
        # Server already running from a previous double-click: just open the game.
        print("Server already running - opening the game...")
        webbrowser.open(url)
        return

    handler = functools.partial(Handler, directory=HERE)
    socketserver.ThreadingTCPServer.allow_reuse_address = True
    socketserver.ThreadingTCPServer.daemon_threads = True
    httpd = socketserver.ThreadingTCPServer(("127.0.0.1", PORT), handler)

    print("=" * 46)
    print("   TOOT AND SCOOT is starting!  *pffffft*")
    print("=" * 46)
    print("Game: " + url)
    if args.level > 1:
        print("BOSS MODE: new games start at level %d  *braaap*" % args.level)
    print()
    print("Auto-reloads when game files change.")
    print("Keep this window open while you play.")
    print("Press [ESC] (or close this window) to stop.")

    threading.Timer(0.5, webbrowser.open, [url]).start()
    threading.Thread(target=watch_escape_key, args=(httpd,), daemon=True).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
