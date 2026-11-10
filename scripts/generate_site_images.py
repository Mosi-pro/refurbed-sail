#!/usr/bin/env python3
"""Renders the editorial placeholder images used by the frontend
(frontend/public/images). Replace these files with licensed photography
for a production launch – file names must stay the same."""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.services.demo_images import render_scene  # noqa: E402

OUT = ROOT / "frontend" / "public" / "images"
OUT.mkdir(parents=True, exist_ok=True)

JOBS = [
    ("hero.jpg", dict(seed=11, size=(2400, 1350), shot="mid", kind="yacht", palette="nordic", boat_x=0.7)),
    ("refurbished.jpg", dict(seed=23, size=(1400, 1700), shot="close", kind="yacht", palette="overcast", boat_x=0.5)),
    ("dealer.jpg", dict(seed=37, size=(1800, 1200), shot="wide", kind="keel", palette="dawn", boat_x=0.62)),
    ("how.jpg", dict(seed=41, size=(1800, 1100), shot="wide", kind="yacht", palette="evening", boat_x=0.36)),
    ("cat-jolle.jpg", dict(seed=51, size=(960, 1200), shot="mid", kind="dinghy", palette="clear", boat_x=0.5)),
    ("cat-sportboot.jpg", dict(seed=58, size=(960, 1200), shot="mid", kind="keel", palette="overcast", boat_x=0.5)),
    ("cat-kielboot.jpg", dict(seed=53, size=(960, 1200), shot="mid", kind="keel", palette="dawn", boat_x=0.5)),
    ("cat-daysailer.jpg", dict(seed=64, size=(960, 1200), shot="mid", kind="keel", palette="evening", boat_x=0.5)),
    ("cat-segelyacht.jpg", dict(seed=55, size=(960, 1200), shot="mid", kind="yacht", palette="nordic", boat_x=0.5)),
    ("cat-regattaboot.jpg", dict(seed=62, size=(960, 1200), shot="mid", kind="keel", palette="clear", boat_x=0.5)),
]

for name, kw in JOBS:
    seed = kw.pop("seed")
    render_scene(seed, **kw).save(OUT / name, "JPEG", quality=84, optimize=True, progressive=True)
    print("wrote", OUT / name)
