"""Toot and Scoot launcher.

Double-click this file to start a tiny local web server and open the game
in your browser (like vite's dev server). Leave the console window open
while playing; close it to stop the server.

Fixed port 8765 so the browser origin (and the localStorage leaderboard)
stays the same every time. If the server is already running from an earlier
double-click, this just opens another browser tab.
"""
import functools
import http.server
import os
import socket
import socketserver
import sys
import threading
import webbrowser

PORT = 8765
GAME = "toot-and-scoot.html"
HERE = os.path.dirname(os.path.abspath(__file__))
URL = "http://127.0.0.1:%d/%s" % (PORT, GAME)


def port_in_use(port):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        return s.connect_ex(("127.0.0.1", port)) == 0
    finally:
        s.close()


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass  # keep the console clean for kid eyes


def main():
    if port_in_use(PORT):
        # Server already running from a previous double-click: just open the game.
        print("Server already running - opening the game...")
        webbrowser.open(URL)
        return

    handler = functools.partial(QuietHandler, directory=HERE)
    socketserver.TCPServer.allow_reuse_address = True
    httpd = socketserver.TCPServer(("127.0.0.1", PORT), handler)

    print("=" * 46)
    print("   TOOT AND SCOOT is starting!  *pffffft*")
    print("=" * 46)
    print("Game: " + URL)
    print()
    print("Keep this window open while you play.")
    print("Close this window when you're done.")

    threading.Timer(0.5, webbrowser.open, [URL]).start()
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()


if __name__ == "__main__":
    main()
