"""Regenerates scripts/android-res from public/bulusanzoo-icon.png.

Run after changing the game icon:  python3 scripts/make-android-icons.py
The output is committed so the Android workflow needs no image tooling.
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "public" / "bulusanzoo-icon.png"
OUT = ROOT / "scripts" / "android-res"
BACKGROUND = (99, 222, 129, 255)  # the icon's own green, so adaptive icons blend

# launcher size (dp * density) and adaptive foreground canvas size
DENSITIES = {"mdpi": (48, 108), "hdpi": (72, 162), "xhdpi": (96, 216), "xxhdpi": (144, 324), "xxxhdpi": (192, 432)}

icon = Image.open(SOURCE).convert("RGBA")


def fit(size):
    return icon.resize((size, size), Image.LANCZOS)


for density, (launcher, canvas) in DENSITIES.items():
    folder = OUT / f"mipmap-{density}"
    folder.mkdir(parents=True, exist_ok=True)
    fit(launcher).save(folder / "ic_launcher.png", optimize=True)
    fit(launcher).save(folder / "ic_launcher_round.png", optimize=True)
    # Adaptive foreground: art inside the central 66% safe zone of the canvas.
    foreground = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    art = int(canvas * 0.66)
    foreground.paste(fit(art), ((canvas - art) // 2, (canvas - art) // 2), fit(art))
    foreground.save(folder / "ic_launcher_foreground.png", optimize=True)

# One landscape splash image used by every density.
splash = Image.new("RGBA", (1920, 1080), BACKGROUND)
logo = fit(420)
splash.paste(logo, ((1920 - 420) // 2, (1080 - 420) // 2), logo)
(OUT / "drawable").mkdir(parents=True, exist_ok=True)
splash.convert("RGB").save(OUT / "drawable" / "splash.png", optimize=True)
print("wrote", OUT)
