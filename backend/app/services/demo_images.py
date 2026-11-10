"""Procedural placeholder imagery for the fictional demo listings.

No stock photo service is contacted: every picture is rendered locally with
Pillow so the demo works offline and carries no licensing obligations. Real
listings always use photographs uploaded by the seller."""
import math
import random

from PIL import Image, ImageChops, ImageDraw, ImageFilter

PALETTES = {
    "nordic": dict(sky_top=(58, 80, 100), sky_hor=(176, 190, 196), sea_hor=(96, 116, 128), sea_low=(16, 36, 53), cloud=(214, 220, 222), warm=None),
    "overcast": dict(sky_top=(128, 144, 154), sky_hor=(212, 217, 217), sea_hor=(146, 160, 166), sea_low=(42, 64, 78), cloud=(236, 238, 237), warm=None),
    "clear": dict(sky_top=(84, 132, 176), sky_hor=(204, 222, 230), sea_hor=(104, 150, 176), sea_low=(20, 58, 86), cloud=(244, 246, 246), warm=None),
    "evening": dict(sky_top=(84, 104, 130), sky_hor=(232, 204, 172), sea_hor=(186, 168, 150), sea_low=(28, 44, 62), cloud=(240, 216, 190), warm=(250, 226, 190)),
    "dawn": dict(sky_top=(150, 160, 170), sky_hor=(234, 224, 214), sea_hor=(178, 180, 182), sea_low=(58, 74, 86), cloud=(246, 238, 230), warm=(252, 240, 222)),
}
HULLS = {"white": (238, 238, 232), "navy": (24, 42, 60), "grey": (150, 160, 166), "green": (34, 64, 58), "wood": (128, 84, 52)}
ACCENTS = [(182, 139, 88), (150, 62, 52), (28, 52, 78), (220, 222, 216), (70, 110, 120)]


def _gradient(size, top, bottom, gamma=1.0):
    mask = Image.linear_gradient("L").resize(size, Image.BICUBIC)
    if gamma != 1.0:
        mask = mask.point(lambda v: int(255 * (v / 255) ** gamma))
    return Image.composite(Image.new("RGB", size, bottom), Image.new("RGB", size, top), mask)


def _noise(size, cell, sigma=60):
    w, h = size
    small = Image.effect_noise((max(2, w // cell[0]), max(2, h // cell[1])), sigma)
    return small.resize(size, Image.BICUBIC)


def _tint(base, color, mask, strength):
    mask = mask.point(lambda v: int(max(0, min(255, v * strength))))
    base.paste(Image.new("RGB", base.size, color), (0, 0), mask)


def _boat_layer(L, rng, kind, hull_color, accent, sail_set):
    """Draws a side view of a sailing boat. Returns (RGBA layer, waterline anchor x, y)."""
    S = 2  # supersampling
    mast_h = {"dinghy": 1.42, "cat": 1.5, "keel": 1.3, "yacht": 1.28}[kind] * L
    W, H = int(L * 1.7 * S), int((mast_h + L * 0.3) * S)
    ox, oy = W // 2, int((mast_h + L * 0.16) * S)
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    u = L * S

    def P(x, y):
        return (ox + x * u, oy + y * u)

    free = {"dinghy": 0.075, "cat": 0.07, "keel": 0.085, "yacht": 0.11}[kind]
    dark = tuple(int(c * 0.6) for c in hull_color)
    if kind == "cat":
        d.polygon([P(-0.5, -free - 0.035), P(0.5, -free - 0.05), P(0.46, -0.03), P(-0.48, -0.03)], fill=dark + (255,))
    hull = [P(-0.5, -free), P(-0.2, -free * 0.92), P(0.2, -free * 0.95), P(0.5, -free * 1.25),
            P(0.43, -0.012), P(0.38, 0), P(-0.46, 0)]
    d.polygon(hull, fill=hull_color + (255,))
    d.line([P(-0.47, -0.012), P(0.4, -0.012)], fill=accent + (255,), width=max(2, int(u * 0.012)))
    d.line([P(-0.5, -free), P(-0.2, -free * 0.92), P(0.2, -free * 0.95), P(0.5, -free * 1.25)],
           fill=dark + (255,), width=max(1, int(u * 0.004)))
    if kind == "yacht":
        d.polygon([P(-0.2, -free * 0.93), P(-0.14, -free - 0.045), P(0.16, -free - 0.04), P(0.24, -free * 0.97)],
                  fill=tuple(int(c * 0.93) for c in HULLS["white"]) + (255,))
        for wx in (-0.08, 0.0, 0.08):
            d.rounded_rectangle([P(wx - 0.025, -free - 0.032), P(wx + 0.025, -free - 0.016)], radius=u * 0.004,
                                fill=(40, 52, 62, 255))
    for cx in ((-0.3, -0.36) if kind != "dinghy" else (-0.12, -0.22))[: rng.choice((1, 2))]:
        d.ellipse([P(cx - 0.017, -free - 0.06), P(cx + 0.017, -free + 0.005)], fill=(34, 44, 54, 255))
        d.ellipse([P(cx - 0.011, -free - 0.082), P(cx + 0.011, -free - 0.058)], fill=(58, 60, 62, 255))

    mx = 0.06
    sail = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sail)
    sail_color = rng.choice([(244, 243, 238), (236, 236, 230), (248, 247, 243)])
    top = -mast_h / L
    boom_y = -free - 0.085
    main = [P(mx - 0.008, boom_y), P(mx - 0.008, top + 0.02), P(mx - 0.06, top + 0.03)]
    for i in range(1, 8):  # leech with roach
        t = i / 8
        main.append(P(mx - 0.06 - (0.44 * t) - 0.05 * math.sin(math.pi * t), top + 0.03 + (boom_y - top) * t))
    main.append(P(mx - 0.5, boom_y + 0.01))
    sd.polygon(main, fill=sail_color + (255,))
    for i in range(1, 5):
        t = i / 5
        y = top + (boom_y - top) * t
        sd.line([P(mx - 0.01, y), P(mx - 0.06 - 0.44 * t - 0.05 * math.sin(math.pi * t), y + 0.012)],
                fill=(200, 202, 198, 255), width=max(1, int(u * 0.002)))
    if "jib" in sail_set:
        jib_head = top * (0.86 if kind != "dinghy" else 0.74)
        jib = [P(0.485, -free * 1.3), P(mx + 0.012, jib_head)]
        for i in range(1, 6):
            t = i / 6
            jib.append(P(mx + 0.012 - 0.04 * t - 0.03 * math.sin(math.pi * t), jib_head + (boom_y + 0.02 - jib_head) * t))
        jib.append(P(mx - 0.04, boom_y + 0.03))
        sd.polygon(jib, fill=tuple(int(c * 0.965) for c in sail_color) + (255,))
    if "gennaker" in sail_set:
        g = [P(0.6, -free * 1.5), P(mx + 0.02, top * 0.97)]
        for i in range(1, 9):
            t = i / 9
            g.append(P(mx + 0.02 + 0.74 * math.sin(math.pi * t) * (0.55 + 0.45 * t), top * 0.97 + (-free * 1.5 - top * 0.97) * t))
        sd.polygon(g, fill=accent + (255,))
    shade = Image.linear_gradient("L").rotate(90, expand=True).resize((W, H)).point(lambda v: 196 + v * 59 // 255)
    sail_rgb = ImageChops.multiply(sail.convert("RGB"), Image.merge("RGB", (shade, shade, shade)))
    sail = Image.merge("RGBA", (*sail_rgb.split(), sail.getchannel("A")))
    img.alpha_composite(sail)
    d = ImageDraw.Draw(img)
    mw = max(2, int(u * 0.009))
    d.line([P(mx, -free), P(mx, top)], fill=(52, 58, 64, 255), width=mw)
    d.line([P(mx, boom_y), P(mx - 0.5, boom_y + 0.012)], fill=(60, 66, 72, 255), width=max(2, mw - 1))
    d.line([P(mx, top), P(0.49, -free * 1.3)], fill=(70, 76, 82, 190), width=max(1, mw // 3))
    d.line([P(mx, top), P(-0.5, -free)], fill=(70, 76, 82, 150), width=max(1, mw // 3))

    heel = rng.uniform(-7, -1.5)
    img = img.rotate(heel, resample=Image.BICUBIC, center=(ox, oy))
    img = img.resize((W // S, H // S), Image.LANCZOS)
    return img, ox // S, oy // S


def render_scene(seed: int, size=(1800, 1200), shot="mid", kind="yacht", palette=None, boat_x=None) -> Image.Image:
    rng = random.Random(seed)
    W, H = size
    pal = PALETTES[palette or rng.choice(list(PALETTES))]
    horizon = int(H * {"wide": 0.52, "mid": 0.6, "close": 0.72}[shot] + rng.uniform(-0.03, 0.03) * H)

    sky = _gradient((W, horizon), pal["sky_top"], pal["sky_hor"], 0.8)
    clouds = _noise((W, horizon), (rng.choice((140, 200, 260)), rng.choice((70, 100))), 70)
    clouds = clouds.point(lambda v: max(0, min(255, int((v - 118) * 2.4)))).filter(ImageFilter.GaussianBlur(W / 90))
    fade = Image.linear_gradient("L").resize((W, horizon)).point(lambda v: 255 - v * 150 // 255)
    _tint(sky, pal["cloud"], ImageChops.multiply(clouds, fade), rng.uniform(0.35, 0.75))
    if pal["warm"]:
        glow = Image.radial_gradient("L").point(lambda v: max(0, int(255 - v * 1.45))).resize((int(W * 1.4), int(horizon * 1.3)))
        gmask = Image.new("L", (W, horizon), 0)
        gmask.paste(glow, (int(rng.uniform(-0.5, 0.1) * W), int(horizon * 0.35)))
        _tint(sky, pal["warm"], gmask, 0.55)

    sea_h = H - horizon
    sea = _gradient((W, sea_h), pal["sea_hor"], pal["sea_low"], 0.6)
    depth = Image.linear_gradient("L").resize((W, sea_h))
    light = tuple(min(255, c + 46) for c in pal["sea_hor"])
    darkc = tuple(int(c * 0.6) for c in pal["sea_low"])
    for cell, mask_fn, strength in (((26, 3), lambda v: 255 - v, 0.9), ((70, 7), lambda v: v, 1.0), ((180, 16), lambda v: v, 0.8)):
        n = _noise((W, sea_h), cell, 64)
        zone = depth.point(mask_fn).point(lambda v: 70 + v * 185 // 255)
        _tint(sea, light, ImageChops.multiply(n.point(lambda v: max(0, (v - 138) * 3)), zone), 0.42 * strength)
        _tint(sea, darkc, ImageChops.multiply(n.point(lambda v: max(0, (118 - v) * 3)), zone), 0.5 * strength)

    scene = Image.new("RGB", (W, H))
    scene.paste(sky, (0, 0))
    scene.paste(sea, (0, horizon))

    if rng.random() < 0.75:  # distant shoreline in haze
        d = ImageDraw.Draw(scene)
        shore = tuple(int(a * 0.45 + b * 0.55) for a, b in zip(pal["sea_low"], pal["sky_hor"]))
        x, pts = int(rng.uniform(-0.2, 0.5) * W), []
        end = x + int(rng.uniform(0.4, 0.9) * W)
        pts.append((x, horizon))
        while x < end:
            x += int(W * 0.02)
            pts.append((x, horizon - rng.uniform(0.004, 0.022) * H * math.sin(math.pi * min(1, (end - x) / (0.5 * W) + 0.1))))
        pts.append((end, horizon))
        d.polygon(pts, fill=shore)

    L = int(W * {"wide": rng.uniform(0.13, 0.17), "mid": rng.uniform(0.3, 0.36), "close": rng.uniform(0.62, 0.74)}[shot])
    L = min(L, int(H * {"wide": 0.3, "mid": 0.46, "close": 0.62}[shot]))
    hull_color = HULLS[rng.choice(list(HULLS) if kind != "dinghy" else ["white", "grey", "white"])]
    accent = rng.choice(ACCENTS)
    sails = {"dinghy": rng.choice((set(), {"jib"})), "cat": {"jib"}, "keel": {"jib"}, "yacht": {"jib"}}[kind]
    if rng.random() < 0.28 and kind != "yacht":
        sails = sails | {"gennaker"}
    boat, ax, ay = _boat_layer(L, rng, kind, hull_color, accent, sails)
    if rng.random() < 0.5:
        boat = boat.transpose(Image.FLIP_LEFT_RIGHT)
        ax = boat.width - ax
    bx = int((boat_x if boat_x is not None else rng.choice((0.34, 0.5, 0.64))) * W)
    by = horizon + int(sea_h * {"wide": rng.uniform(0.12, 0.3), "mid": rng.uniform(0.3, 0.45), "close": rng.uniform(0.35, 0.5)}[shot])

    refl = boat.transpose(Image.FLIP_TOP_BOTTOM).resize((boat.width, max(1, int(boat.height * 0.3))))
    refl = refl.filter(ImageFilter.GaussianBlur(max(1, L / 40)))
    refl.putalpha(refl.getchannel("A").point(lambda v: v * 44 // 255))
    scene.paste(refl, (bx - ax, by - int((boat.height - ay) * 0.3)), refl)

    wake = Image.new("L", (W, H), 0)
    wd = ImageDraw.Draw(wake)
    wd.ellipse([bx - L * 0.62, by - L * 0.012, bx + L * 0.6, by + L * 0.03], fill=150)
    wake = wake.filter(ImageFilter.GaussianBlur(max(1, L / 60)))
    _tint(scene, (236, 240, 240), wake, 0.8)
    scene.paste(boat, (bx - ax, by - ay), boat)

    scene = scene.filter(ImageFilter.GaussianBlur(0.6))
    grain = Image.effect_noise((W, H), 9)
    scene = Image.blend(scene, Image.merge("RGB", (grain, grain, grain)), 0.045)
    vig = Image.radial_gradient("L").resize((int(W * 1.5), int(H * 1.5))).crop((W // 4, H // 4, W // 4 + W, H // 4 + H))
    _tint(scene, (10, 20, 30), vig.point(lambda v: max(0, v - 120)), 0.5)
    return scene


CATEGORY_KIND = {"jolle": "dinghy", "sportboot": "keel", "kielboot": "keel", "daysailer": "keel",
                 "segelyacht": "yacht", "katamaran": "cat", "regattaboot": "keel"}


def listing_images(seed: int, category: str, count: int = 4) -> list[Image.Image]:
    rng = random.Random(seed)
    palette = rng.choice(list(PALETTES))
    kind = CATEGORY_KIND.get(category, "yacht")
    shots = ["mid", "wide", "close", "mid", "wide"][:count]
    out = []
    for i, shot in enumerate(shots):
        # Same boat (seeded hull/sail choice differs per image only via composition seed).
        out.append(render_scene(seed * 31 + i, shot=shot, kind=kind, palette=palette if i < 2 else rng.choice(list(PALETTES))))
    return out
