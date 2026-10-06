# Draws the toolbar and store icons: a tiket ticket (blue body, yellow stub) carrying the Next "N".
# Idle = the same ticket in slate; it turns blue/yellow when the page has __NEXT_DATA__.
# Run: python3 scripts/make-icons.py   (needs Pillow)
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "icons"
SS = 16  # supersampling factor; BOX-downsampled so edges on the 16px grid stay crisp

ACTIVE = {"body": "#005acc", "stub": "#ffd500", "mark": "#ffffff"}
IDLE = {"body": "#8593a5", "stub": "#bcc7d4", "mark": "#ffffff"}

# Artwork lives on a 128-unit grid. Key edges are multiples of 8, so they land on whole pixels at 16px.
TICKET = (0, 16, 128, 112)
RADIUS = 16
SEAM = 96  # body | stub
NOTCH = 16
N_BOX = (24, 40, 72, 88)
STEM = 16
PERFS = (44, 64, 84)  # punched holes along the seam, only drawn where they read
PERF_R = 3.5

# Padding (in output px) so large sizes sit inside Chrome's recommended safe area.
PAD = {16: 0, 32: 0, 48: 2, 128: 8}


def render(size: int, palette: dict) -> Image.Image:
    px = size * SS
    art = (size - 2 * PAD[size]) * SS
    off = PAD[size] * SS
    k = art / 128

    def pt(x, y):
        return (off + x * k, off + y * k)

    def box(x0, y0, x1, y1):
        return (*pt(x0, y0), *pt(x1, y1))

    shape = Image.new("L", (px, px), 0)
    d = ImageDraw.Draw(shape)
    d.rounded_rectangle(box(*TICKET), radius=RADIUS * k, fill=255)
    for cy in (TICKET[1], TICKET[3]):
        d.ellipse(box(SEAM - NOTCH, cy - NOTCH, SEAM + NOTCH, cy + NOTCH), fill=0)
    if size >= 48:
        for cy in PERFS:
            d.ellipse(box(SEAM - PERF_R, cy - PERF_R, SEAM + PERF_R, cy + PERF_R), fill=0)

    color = Image.new("RGBA", (px, px), palette["body"])
    ImageDraw.Draw(color).rectangle(box(SEAM, 0, 128, 128), fill=palette["stub"])

    x0, y0, x1, y1 = N_BOX
    c = ImageDraw.Draw(color)
    c.rectangle(box(x0, y0, x0 + STEM, y1), fill=palette["mark"])
    c.rectangle(box(x1 - STEM, y0, x1, y1), fill=palette["mark"])
    c.polygon([pt(x0, y0), pt(x0 + STEM, y0), pt(x1, y1), pt(x1 - STEM, y1)], fill=palette["mark"])

    img = Image.new("RGBA", (px, px), (0, 0, 0, 0))
    img.paste(color, mask=shape)
    return img.resize((size, size), Image.Resampling.BOX)


for size in (16, 32, 48, 128):
    render(size, ACTIVE).save(OUT / f"icon{size}.png")
for size in (16, 32):
    render(size, IDLE).save(OUT / f"idle{size}.png")
print(f"wrote icons to {OUT}")
