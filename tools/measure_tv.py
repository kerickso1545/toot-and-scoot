"""Measure the title/lobby screen at TV resolutions and report overflow.

Run from the repo root:  python tools/measure_tv.py

The Shield renders the lobby at 1920x1080 and the setup card turned out to
be TALLER than the screen -- the wordmark scrolls off the top and the
bottom buttons clip. On a TV that is close to fatal, because there is no
comfortable way to scroll a page with a remote.

This boots the real page in headless Chrome at each TV size and reports the
measured height of every block in the overlay, so the fix can be aimed at
whatever is actually eating the vertical budget instead of guessed at.
"""
import functools
import http.server
import json
import os
import re
import shutil
import socketserver
import subprocess
import sys
import tempfile
import threading

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8797
PAGE = "_measure.html"
SIZES = [(1920, 1080), (1280, 720), (3840, 2160)]

CHROME_CANDIDATES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    "/usr/bin/google-chrome",
]

PROBE = """
<script>
(function () {
  function go() {
    var ov = document.getElementById('overlay');
    var rows = [];
    function add(label, el) {
      if (!el) { rows.push([label, null, null]); return; }
      var r = el.getBoundingClientRect();
      rows.push([label, Math.round(r.height), Math.round(r.top)]);
    }
    add('h1 wordmark', document.querySelector('#overlay h1'));
    add('bigmsg', document.getElementById('bigmsg'));
    add('scoreboard', document.getElementById('scoreboard'));
    add('tagline', document.querySelector('#overlay > p'));
    add('diffbtns (card)', document.getElementById('diffbtns'));
    add('playerslots', document.getElementById('playerslots'));
    add('joinhint', document.getElementById('joinhint'));
    var out = {
      viewport: [window.innerWidth, window.innerHeight],
      dpr: window.devicePixelRatio,
      overlayScrollH: ov ? ov.scrollHeight : null,
      overlayClientH: ov ? ov.clientHeight : null,
      overflow: ov ? (ov.scrollHeight - ov.clientHeight) : null,
      rows: rows
    };
    var pre = document.createElement('pre');
    pre.id = 'measure';
    pre.textContent = JSON.stringify(out);
    document.body.appendChild(pre);
  }
  if (document.readyState === 'complete') setTimeout(go, 400);
  else window.addEventListener('load', function () { setTimeout(go, 400); });
})();
</script>
"""


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass


def chrome():
    for c in CHROME_CANDIDATES:
        if os.path.exists(c):
            return c
    w = shutil.which("google-chrome")
    if w:
        return w
    raise SystemExit("Chrome not found")


def main():
    src = open(os.path.join(ROOT, "toot-and-scoot.html"), encoding="utf-8").read()
    open(os.path.join(ROOT, PAGE), "w", encoding="utf-8").write(
        src.replace("</body>", PROBE + "</body>", 1))

    handler = functools.partial(Quiet, directory=ROOT)
    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.TCPServer(("127.0.0.1", PORT), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()

    worst = 0
    try:
        for (w, h) in SIZES:
            prof = tempfile.mkdtemp(prefix="tns-meas-")
            try:
                dom = subprocess.run(
                    [chrome(), "--headless=new", "--disable-gpu",
                     "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
                     "--no-sandbox", "--user-data-dir=" + prof,
                     "--window-size=%d,%d" % (w, h),
                     "--virtual-time-budget=8000", "--dump-dom",
                     "http://127.0.0.1:%d/%s" % (PORT, PAGE)],
                    capture_output=True, text=True, timeout=120).stdout
            finally:
                shutil.rmtree(prof, ignore_errors=True)

            m = re.search(r'<pre id="measure">(.*?)</pre>', dom, re.S)
            if not m:
                print("%dx%d: NO MEASUREMENT" % (w, h))
                continue
            d = json.loads(m.group(1).replace("&quot;", '"')
                           .replace("&amp;", "&").replace("&lt;", "<")
                           .replace("&gt;", ">"))
            over = d["overflow"]
            worst = max(worst, over or 0)
            print("\n=== %dx%d (dpr %s) ===" % (w, h, d["dpr"]))
            print("  overlay content %spx into a %spx viewport -> %s" % (
                d["overlayScrollH"], d["overlayClientH"],
                ("OVERFLOWS by %dpx" % over) if over > 0 else "fits"))
            for (label, hh, top) in d["rows"]:
                if hh is None:
                    print("    %-18s (absent)" % label)
                else:
                    print("    %-18s h=%-5s top=%s" % (label, hh, top))
    finally:
        srv.shutdown()
        p = os.path.join(ROOT, PAGE)
        if os.path.exists(p):
            os.remove(p)

    print("\n%s" % ("ALL SIZES FIT" if worst == 0
                    else "WORST OVERFLOW: %dpx" % worst))
    return 1 if worst > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
