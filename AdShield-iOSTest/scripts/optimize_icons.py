from pathlib import Path

from PIL import Image


root = Path(__file__).resolve().parents[1]
source = Path("/home/ubuntu/webdev-static-assets/adshield-icon.png")
targets = [
    root / "assets/images/icon.png",
    root / "assets/images/splash-icon.png",
    root / "assets/images/favicon.png",
    root / "assets/images/android-icon-foreground.png",
]

with Image.open(source) as image:
    canvas = image.convert("RGBA")
    canvas.thumbnail((512, 512), Image.Resampling.LANCZOS)
    for target in targets:
        canvas.save(target, "PNG", optimize=True)
