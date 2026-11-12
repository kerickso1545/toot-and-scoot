"""Boot the game in headless Chrome and report any load-time errors.

Run from the repo root:  python tools/boot_test.py

This is NOT a playtest -- it cannot tell you whether the game feels right.
What it does catch is the class of breakage that is easy to introduce and
easy to miss: a script that 404s, a load-order mistake, a THREE symbol that
isn't there yet, anything that throws while the page is coming up.

How: it serves the repo, builds a throwaway copy of the game page with an
error collector injected ahead of every other script, loads it in headless
Chrome (SwiftShader for WebGL), and dumps the DOM. The collector writes its
findings into a known element, so the dumped DOM carries the verdict.
"""
import functools
import http.server
import os
import re
import shutil
import socketserver
import subprocess
import sys
import tempfile
import threading

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = 8798
PAGE = "_boottest.html"

CHROME_CANDIDATES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
]

COLLECTOR = """
<script>
/* injected by tools/boot_test.py -- must run before every other script */
window.__errs = [];
window.addEventListener('error', function (e) {
  window.__errs.push((e.message || 'error') + ' @ ' +
    (e.filename || '?') + ':' + (e.lineno || '?'));
}, true);
window.addEventListener('unhandledrejection', function (e) {
  window.__errs.push('unhandled rejection: ' + e.reason);
});
var __origErr = console.error;
console.error = function () {
  window.__errs.push('console.error: ' +
    Array.prototype.join.call(arguments, ' '));
  __origErr.apply(console, arguments);
};
</script>
"""

VERDICT = """
<script>
/* runs last: record what actually came up */
(function () {
  function write() {
    var checks = [
      ['THREE loaded',        typeof THREE !== 'undefined'],
      ['THREE r128',          typeof THREE !== 'undefined' && THREE.REVISION === '128'],
      ['renderer built',      typeof renderer !== 'undefined' && !!renderer],
      ['scene built',         typeof scene !== 'undefined' && !!scene],
      ['Input module',        typeof Input !== 'undefined' && !!Input.normalize],
      ['world built',         typeof COLS !== 'undefined' && COLS > 0],
      ['animate() defined',   typeof animate === 'function'],
      ['lobby rendered',      !!document.getElementById('playerslots') &&
                              document.getElementById('playerslots').innerHTML.length > 0],
      ['canStartGame()',      typeof canStartGame === 'function'],
      ['manifest linked',     !!document.querySelector('link[rel=manifest]')]
    ];
    var out = '';
    for (var i = 0; i < checks.length; i++) {
      out += (checks[i][1] ? 'PASS ' : 'FAIL ') + checks[i][0] + '\\n';
    }
    out += 'ERRORS:' + (window.__errs.length ? '\\n  ' + window.__errs.join('\\n  ')
                                             : ' none') + '\\n';
    var d = document.createElement('pre');
    d.id = 'boot-verdict';
    d.textContent = out;
    document.body.appendChild(d);
  }
  if (document.readyState === 'complete') { setTimeout(write, 300); }
  else { window.addEventListener('load', function () { setTimeout(write, 300); }); }
})();
</script>
"""


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass


def find_chrome():
    for c in CHROME_CANDIDATES:
        if os.path.exists(c):
            return c
    w = shutil.which("google-chrome") or shutil.which("chromium")
    if w:
        return w
    raise SystemExit("Chrome not found -- edit CHROME_CANDIDATES")


def main():
    src = open(os.path.join(ROOT, "toot-and-scoot.html"), encoding="utf-8").read()
    # Collector first (right after <head>), verdict last (before </body>).
    page = src.replace("<head>", "<head>" + COLLECTOR, 1)
    page = page.replace("</body>", VERDICT + "</body>", 1)
    tmp = os.path.join(ROOT, PAGE)
    open(tmp, "w", encoding="utf-8").write(page)

    handler = functools.partial(Quiet, directory=ROOT)
    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.TCPServer(("127.0.0.1", PORT), handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()

    profile = tempfile.mkdtemp(prefix="tns-boot-")
    try:
        out = subprocess.run(
            [
                find_chrome(),
                "--headless=new",
                "--disable-gpu",
                "--use-angle=swiftshader",
                "--enable-unsafe-swiftshader",
                "--no-sandbox",
                "--user-data-dir=" + profile,
                "--virtual-time-budget=8000",
                "--dump-dom",
                "http://127.0.0.1:%d/%s" % (PORT, PAGE),
            ],
            capture_output=True,
            text=True,
            timeout=120,
        ).stdout
    finally:
        srv.shutdown()
        if os.path.exists(tmp):
            os.remove(tmp)
        shutil.rmtree(profile, ignore_errors=True)

    m = re.search(r'<pre id="boot-verdict">(.*?)</pre>', out, re.S)
    if not m:
        print("NO VERDICT -- the page never finished booting.")
        print("(first 1500 chars of dumped DOM below)\n")
        print(out[:1500])
        return 1

    verdict = (m.group(1)
               .replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">"))
    print(verdict.strip())
    failed = "FAIL " in verdict
    errored = "ERRORS: none" not in verdict
    print("\n" + ("BOOT OK" if not (failed or errored) else "BOOT PROBLEMS"))
    return 1 if (failed or errored) else 0


if __name__ == "__main__":
    sys.exit(main())
