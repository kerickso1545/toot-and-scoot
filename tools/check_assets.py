"""Verify every file the service worker precaches actually serves.

Run from the repo root:  python tools/check_assets.py

Why this exists: sw.js uses cache.addAll(), which is atomic — a single 404
in the ASSETS list throws away the whole install and the game silently
loses offline play. That failure is invisible until someone takes the
Shield off wifi, so it gets checked here instead.

Also cross-checks the ASSETS list against the <script>/<link> tags actually
referenced by toot-and-scoot.html, so a newly added game file can't be
forgotten.
"""
import functools
import http.server
import os
import re
import socketserver
import sys
import threading
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
PORT = 8799


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass


def sw_assets():
    src = open(os.path.join(ROOT, "sw.js"), encoding="utf-8").read()
    block = re.search(r"var ASSETS = \[(.*?)\];", src, re.S)
    if not block:
        raise SystemExit("could not find the ASSETS list in sw.js")
    return re.findall(r"'([^']+)'", block.group(1))


def html_refs():
    """Files toot-and-scoot.html pulls in via src= / href= (local only)."""
    src = open(os.path.join(ROOT, "toot-and-scoot.html"), encoding="utf-8").read()
    refs = re.findall(r'(?:src|href)="([^"]+)"', src)
    return [r for r in refs if not r.startswith(("http:", "https:", "//", "#"))]


def main():
    handler = functools.partial(Quiet, directory=ROOT)
    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.TCPServer(("127.0.0.1", PORT), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()

    assets = sw_assets()
    bad = 0
    print("--- sw.js precache list (%d entries) ---" % len(assets))
    for a in assets:
        url = "http://127.0.0.1:%d/%s" % (PORT, a.lstrip("./"))
        try:
            r = urllib.request.urlopen(url, timeout=5)
            n = len(r.read())
            flag = "ok " if (r.status == 200 and n > 0) else "BAD"
            if flag == "BAD":
                bad += 1
            print("  %s %-36s %7d bytes" % (flag, a, n))
        except Exception as e:
            print("  BAD %-36s %s" % (a, e))
            bad += 1

    print("\n--- files toot-and-scoot.html references ---")
    normalized = set(a.lstrip("./") for a in assets)
    for r in html_refs():
        ref = r.lstrip("./")
        if ref in normalized:
            print("  ok  %s" % r)
        else:
            print("  MISSING FROM sw.js ASSETS: %s" % r)
            bad += 1

    srv.shutdown()
    print("\nALL OK" if bad == 0 else "\n%d PROBLEM(S)" % bad)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
