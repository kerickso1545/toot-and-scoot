"""Generate the PWA / launcher icons for Toot and Scoot.

Run from the repo root:  python tools/make_icons.py

Everything is drawn in code from the game's own LEGO design tokens (see
css/style.css :root) so the icons stay in the same family as the UI and
there are no binary source assets to keep in sync. Re-run after a palette
change; the PNGs it writes into icons/ are committed.

Drawn at 4x and downsampled for clean edges (PIL has no antialiased draw).
"""
import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), "icons")

# From css/style.css :root — keep in sync with the LEGO brick tokens.
INK = (11, 15, 36)
PANEL_TOP = (28, 36, 80)
PANEL_BOT = (19, 26, 56)
GOLD = (255, 213, 79)
GOLD_LO = (122, 92, 0)
GREEN = (87, 185, 58)
GREEN_HI = (138, 219, 110)

SS = 4  # supersample factor


def gradient(size, top, bot):
    """Vertical linear gradient as an RGBA image."""
    img = Image.new("RGBA", (size, size))
    d = ImageDraw.Draw(img)
    for y in range(size):
        t = y / float(max(1, size - 1))
        d.line(
            [(0, y), (size, y)],
            fill=(
                int(top[0] + (bot[0] - top[0]) * t),
                int(top[1] + (bot[1] - top[1]) * t),
                int(top[2] + (bot[2] - top[2]) * t),
                255,
            ),
        )
    return img


def cloud(d, cx, cy, r, fill, outline=None, width=0):
    """A gas puff: overlapping circles, biggest in the middle."""
    puffs = [
        (cx, cy, r),
        (cx - r * 0.82, cy + r * 0.20, r * 0.66),
        (cx + r * 0.84, cy + r * 0.16, r * 0.70),
        (cx - r * 0.38, cy - r * 0.62, r * 0.58),
        (cx + r * 0.44, cy - r * 0.58, r * 0.54),
        (cx + r * 0.10, cy + r * 0.56, r * 0.62),
    ]
    for (x, y, rr) in puffs:
        d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=fill,
                  outline=outline, width=width)


def draw_icon(px, safe=1.0):
    """Render one icon at px pixels. `safe` shrinks art for maskable icons."""
    s = px * SS
    img = gradient(s, PANEL_TOP, PANEL_BOT)
    d = ImageDraw.Draw(img)

    # Gold ring just inside the edge, inset further for maskable variants so
    # a circular crop can't clip it.
    inset = s * (0.055 + (1.0 - safe) * 0.5)
    d.rounded_rectangle(
        [inset, inset, s - inset, s - inset],
        radius=s * 0.17 * safe,
        outline=GOLD_LO,
        width=int(s * 0.045),
    )
    d.rounded_rectangle(
        [inset, inset, s - inset, s - inset],
        radius=s * 0.17 * safe,
        outline=GOLD,
        width=int(s * 0.026),
    )

    # The gas cloud, slightly low so the highlight reads as a top-light.
    cx, cy = s * 0.5, s * 0.55
    r = s * 0.20 * safe

    glow = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    cloud(ImageDraw.Draw(glow), cx, cy, r * 1.22, (87, 185, 58, 110))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(s * 0.035)))

    cloud(d, cx, cy, r, GREEN, outline=INK, width=int(s * 0.016))
    # Inner highlight puff, offset up-left.
    cloud(d, cx - r * 0.16, cy - r * 0.30, r * 0.52, GREEN_HI)

    # Three stink lines rising off the top of the cloud.
    for i, dx in enumerate((-0.52, 0.0, 0.52)):
        x = cx + r * dx
        y0 = cy - r * (1.35 + 0.12 * (i % 2))
        d.line([(x, y0), (x, y0 - r * 0.46)], fill=GOLD, width=int(s * 0.022))

    return img.resize((px, px), Image.LANCZOS)



# Android TV banner: the tile the Shield home screen shows for the app.
# 320x180 is the size Android asks for (android:banner in the manifest).
BANNER_FONTS = [
    "C:/Windows/Fonts/ariblk.ttf",    # Arial Black - matches the game wordmark
    "C:/Windows/Fonts/arialbd.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]


def _font(px):
    for f in BANNER_FONTS:
        if os.path.exists(f):
            try:
                return ImageFont.truetype(f, px)
            except OSError:
                pass
    return ImageFont.load_default()


def draw_banner(w=320, h=180):
    """Cloud on the left, wordmark on the right -- readable as a small tile."""
    s = SS
    img = gradient(max(w, h) * s, PANEL_TOP, PANEL_BOT).resize((w * s, h * s))
    d = ImageDraw.Draw(img)

    # Gas cloud, left third.
    cx, cy, r = w * s * 0.20, h * s * 0.54, h * s * 0.21
    glow = Image.new("RGBA", (w * s, h * s), (0, 0, 0, 0))
    cloud(ImageDraw.Draw(glow), cx, cy, r * 1.25, (87, 185, 58, 110))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(h * s * 0.03)))
    cloud(d, cx, cy, r, GREEN, outline=INK, width=int(h * s * 0.014))
    cloud(d, cx - r * 0.16, cy - r * 0.30, r * 0.52, GREEN_HI)

    # Wordmark, right two thirds, stacked so it stays large.
    f = _font(int(h * s * 0.19))
    x = w * s * 0.40
    for i, word in enumerate(("TOOT", "AND", "SCOOT")):
        y = h * s * (0.19 + i * 0.235)
        d.text((x + s * 2, y + s * 2), word, font=f, fill=INK)        # drop shadow
        d.text((x, y), word, font=f, fill=GOLD)

    return img.resize((w, h), Image.LANCZOS)


def main():
    if not os.path.isdir(OUT):
        os.makedirs(OUT)
    made = []
    for px in (192, 512):
        p = os.path.join(OUT, "icon-%d.png" % px)
        draw_icon(px).save(p, "PNG", optimize=True)
        made.append(p)
    # Maskable: art pulled into the inner ~70% so a circle crop is safe.
    p = os.path.join(OUT, "icon-maskable-512.png")
    draw_icon(512, safe=0.72).save(p, "PNG", optimize=True)
    made.append(p)

    p = os.path.join(OUT, "tv-banner.png")
    draw_banner().save(p, "PNG", optimize=True)
    made.append(p)

    for p in made:
        print("wrote %s (%d bytes)" % (os.path.relpath(p, os.path.dirname(HERE)),
                                       os.path.getsize(p)))


if __name__ == "__main__":
    main()
