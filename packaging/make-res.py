"""Install the game's generated artwork into the Android project.

Run from packaging/:  python make-res.py

Sources are icons/ at the repo root, produced by tools/make_icons.py from the
game's own LEGO design tokens. Nothing here is hand-drawn, so re-running after
a palette change keeps the app icon, the TV banner and the in-game UI in the
same family.

  icons/tv-banner.png  -> res/drawable/tv_banner.png   (Shield home screen tile)
  icons/icon-512.png   -> res/mipmap-*/ic_launcher*.png (phone/tablet launcher)

Capacitor generates placeholder launcher icons when it creates the Android
project; this replaces them.
"""
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
ICONS = os.path.join(ROOT, "icons")
RES = os.path.join(HERE, "android", "app", "src", "main", "res")

# Android launcher icon sizes per density bucket.
MIPMAPS = {
    "mipmap-mdpi": 48,
    "mipmap-hdpi": 72,
    "mipmap-xhdpi": 96,
    "mipmap-xxhdpi": 144,
    "mipmap-xxxhdpi": 192,
}


def main():
    if not os.path.isdir(RES):
        print("No Android project yet -- run `npx cap add android` first.")
        return 1

    banner_src = os.path.join(ICONS, "tv-banner.png")
    icon_src = os.path.join(ICONS, "icon-512.png")
    for p in (banner_src, icon_src):
        if not os.path.exists(p):
            print("Missing " + p + " -- run `python tools/make_icons.py` first.")
            return 1

    wrote = []

    drawable = os.path.join(RES, "drawable")
    os.makedirs(drawable, exist_ok=True)
    dest = os.path.join(drawable, "tv_banner.png")
    Image.open(banner_src).save(dest, "PNG", optimize=True)
    wrote.append(dest)

    icon = Image.open(icon_src).convert("RGBA")
    for folder, px in MIPMAPS.items():
        d = os.path.join(RES, folder)
        if not os.path.isdir(d):
            continue
        scaled = icon.resize((px, px), Image.LANCZOS)
        for name in ("ic_launcher.png", "ic_launcher_round.png",
                     "ic_launcher_foreground.png"):
            target = os.path.join(d, name)
            if os.path.exists(target):
                scaled.save(target, "PNG", optimize=True)
                wrote.append(target)

    for p in wrote:
        print("  wrote " + os.path.relpath(p, HERE))
    print("\n%d resource file(s) installed." % len(wrote))
    return 0


if __name__ == "__main__":
    sys.exit(main())
