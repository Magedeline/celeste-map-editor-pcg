"""Celeste PCG MCP Server — gives Claude visual feedback for procedural map generation."""

import base64
import io
import json
import os
import random as pyrandom
import subprocess
import sys
from pathlib import Path

from mcp.server.fastmcp import FastMCP
from PIL import Image, ImageDraw, ImageFont

# ---------------------------------------------------------------------------
# CelesteGAN integration (optional — only if torch is installed)
# ---------------------------------------------------------------------------
_GAN_AVAILABLE = False
_gan_model = None

try:
    # Add celeste-gan directory to path
    _gan_dir = Path(__file__).resolve().parent.parent / "celeste-gan"
    if _gan_dir.is_dir():
        sys.path.insert(0, str(_gan_dir))
        from celeste_gan import CelesteGAN, tile_grid_to_strings, KIT_TILES
        _GAN_AVAILABLE = True
except ImportError:
    pass


def _get_gan_model():
    """Lazy-load the GAN model from the default checkpoint path."""
    global _gan_model
    if _gan_model is not None:
        return _gan_model

    if not _GAN_AVAILABLE:
        return None

    checkpoint = Path(__file__).resolve().parent.parent / "celeste-gan" / "checkpoints" / "celeste_gan.pt"
    if not checkpoint.is_file():
        return None

    try:
        import torch
        device = "cuda" if torch.cuda.is_available() else "cpu"
        _gan_model = CelesteGAN(device=device)
        _gan_model.load(checkpoint)
        print(f"CelesteGAN loaded from {checkpoint} (device={device})", file=sys.stderr)
        return _gan_model
    except Exception as e:
        print(f"Failed to load CelesteGAN: {e}", file=sys.stderr)
        return None


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

TILE_SIZE = 8  # each tile is 8x8 world-px

TILE_COLORS = {
    "1": (67, 86, 126),
    "2": (116, 70, 70),
    "3": (139, 118, 196),
    "4": (197, 112, 71),
    "5": (153, 150, 117),
    "6": (84, 140, 102),
    "7": (90, 95, 108),
    "8": (77, 122, 129),
    "9": (138, 106, 72),
    "a": (209, 180, 80),
    "b": (104, 104, 128),
    "c": (219, 128, 171),
    "d": (245, 194, 116),
    "e": (131, 219, 205),
    "f": (182, 182, 194),
}
DEFAULT_TILE_COLOR = (140, 140, 140)

ENTITY_COLORS = {
    "player": (96, 214, 126),
    "strawberry": (234, 72, 106),
    "spring": (244, 190, 77),
    "refill": (88, 226, 255),
    "checkpoint": (111, 185, 255),
    "spikesUp": (255, 146, 104),
    "spikesDown": (255, 146, 104),
    "spikesLeft": (255, 146, 104),
    "spikesRight": (255, 146, 104),
}
DEFAULT_ENTITY_COLOR = (111, 185, 255)

PHASE_COLORS = {
    "intro": (82, 200, 154),
    "build": (105, 170, 255),
    "checkpoint": (141, 118, 255),
    "escalation": (255, 179, 72),
    "finale": (244, 92, 122),
    "reward": (245, 216, 92),
}
DEFAULT_PHASE_COLOR = (124, 143, 168)

ROOM_COLOR_PALETTE_FIXED = [
    (57, 90, 94),
    (137, 78, 54),
    (80, 115, 58),
    (120, 58, 94),
    (54, 84, 123),
    (128, 96, 46),
]

KIT_THEMES = {
    "house": {
        "title": "House Kit",
        "description": "Warm wood interiors with loft-like platforms and readable structural rhythm.",
        "accent": (230, 176, 88), "surface": (82, 52, 31),
        "glow": (173, 121, 62), "bg": (24, 18, 13),
        "tiles": {"wall": "9", "bg": "1", "platform": "a", "trim": "5"},
    },
    "resort": {
        "title": "Resort Kit",
        "description": "Dense indoor rooms with more industrial shell pieces and hotel-like spacing.",
        "accent": (170, 197, 232), "surface": (40, 47, 64),
        "glow": (111, 143, 188), "bg": (15, 19, 28),
        "tiles": {"wall": "7", "bg": "6", "platform": "4", "trim": "5"},
    },
    "cliffside": {
        "title": "Cliffside Kit",
        "description": "Rough shell blocks and exposed supports for outdoor-feeling traversal rooms.",
        "accent": (94, 203, 213), "surface": (25, 58, 65),
        "glow": (51, 148, 157), "bg": (8, 24, 27),
        "tiles": {"wall": "b", "bg": "8", "platform": "9", "trim": "f"},
    },
    "kirby": {
        "title": "Kirby Kit",
        "description": "Pastel toybox rooms with buoyant platforms and softer block contrast.",
        "accent": (255, 132, 189), "surface": (75, 36, 76),
        "glow": (193, 95, 168), "bg": (29, 13, 34),
        "tiles": {"wall": "c", "bg": "3", "platform": "d", "trim": "e"},
    },
    "mario": {
        "title": "Mario Kit",
        "description": "Bright, chunky platforming rooms with bricky structure and classic arcade punch.",
        "accent": (252, 92, 61), "surface": (89, 32, 20),
        "glow": (213, 150, 48), "bg": (31, 11, 7),
        "tiles": {"wall": "2", "bg": "4", "platform": "6", "trim": "8"},
    },
    "metroidvania": {
        "title": "Metroidvania Kit",
        "description": "Moody fortress rooms that read heavier and more exploratory.",
        "accent": (95, 222, 163), "surface": (18, 42, 39),
        "glow": (83, 150, 135), "bg": (7, 17, 16),
        "tiles": {"wall": "f", "bg": "2", "platform": "7", "trim": "b"},
    },
    "labybirth": {
        "title": "Labybirth Kit",
        "description": "Maze-minded stonework with older masonry and dustier support patterns.",
        "accent": (212, 165, 103), "surface": (69, 46, 29),
        "glow": (150, 109, 63), "bg": (23, 16, 11),
        "tiles": {"wall": "6", "bg": "1", "platform": "5", "trim": "9"},
    },
    "pizzatower": {
        "title": "Pizza Tower Kit",
        "description": "High-energy rooms with loud contrast and exaggerated fast-movement read.",
        "accent": (255, 214, 59), "surface": (96, 38, 17),
        "glow": (245, 134, 52), "bg": (33, 12, 7),
        "tiles": {"wall": "d", "bg": "5", "platform": "a", "trim": "c"},
    },
    "arcade": {
        "title": "Arcade Kit",
        "description": "Neon-coded rooms with synthetic contrast and stronger color separation.",
        "accent": (90, 239, 255), "surface": (20, 28, 62),
        "glow": (167, 89, 255), "bg": (5, 8, 30),
        "tiles": {"wall": "3", "bg": "8", "platform": "e", "trim": "4"},
    },
}

ARCHETYPE_CATALOG = {
    "linearAscent": {"label": "Linear Ascent", "recommended": "celesteRandomizer", "orientation": "vertical"},
    "longRunDensityBurst": {"label": "Long Run With Density Burst", "recommended": "criticalPathBranches", "orientation": "horizontal"},
    "spineCompactBranching": {"label": "Spine With Compact Branching", "recommended": "criticalPathBranches", "orientation": "any"},
    "landmarkCorridor": {"label": "Landmark Corridor", "recommended": "criticalPath", "orientation": "horizontal"},
    "celesteCategory": {"label": "Celeste Category", "recommended": "celesteRandomizer", "orientation": "vertical"},
    "segmentedSummit": {"label": "Segmented Summit", "recommended": "celesteRandomizer", "orientation": "vertical"},
}

LAYOUT_DESCRIPTIONS = {
    "grid": "Full adjacency grid with serpentine main path",
    "criticalPath": "Single winding start-to-goal route with optional dead-ends",
    "criticalPathBranches": "Critical path with aggressive branch generation",
    "celesteRandomizer": "Weighted frontier expansion (most sophisticated)",
    "openSkeleton": "Randomized spanning tree with extra edges",
}

# ---------------------------------------------------------------------------
# State
# ---------------------------------------------------------------------------

_last_generation: dict | None = None
_last_params: dict | None = None

# ---------------------------------------------------------------------------
# Generator interface
# ---------------------------------------------------------------------------


def _find_generator_exe() -> Path:
    env = os.environ.get("CELESTE_PCG_GENERATOR")
    if env:
        p = Path(env)
        if p.is_file():
            return p

    server_dir = Path(__file__).resolve().parent
    search_root = server_dir.parent  # project root (one level up from mcp-server/)

    candidates = [
        search_root / "cpp" / "build" / "celeste_pcg_generator.exe",
        search_root / "cpp" / "build" / "Release" / "celeste_pcg_generator.exe",
        search_root / "cpp" / "build" / "Debug" / "celeste_pcg_generator.exe",
    ]
    for c in candidates:
        if c.is_file():
            return c

    raise FileNotFoundError(
        "Could not find celeste_pcg_generator.exe. "
        "Build the C++ project or set CELESTE_PCG_GENERATOR env var."
    )


def _run_generator(params: dict) -> dict:
    exe = _find_generator_exe()

    args = [str(exe)]
    flag_map = {
        "mode": "--mode",
        "layout": "--layout",
        "archetype": "--archetype",
        "kit": "--kit",
        "seed": "--seed",
        "cluster_width": "--cluster-width",
        "cluster_height": "--cluster-height",
        "room_width": "--room-width",
        "room_height": "--room-height",
        "room_gap": "--room-gap",
    }

    for key, flag in flag_map.items():
        if key in params and params[key] is not None:
            args.extend([flag, str(params[key])])

    result = subprocess.run(args, capture_output=True, text=True, timeout=30)
    if result.returncode != 0:
        raise RuntimeError(f"Generator failed: {result.stderr.strip()}")

    return json.loads(result.stdout)


def _summarize(data: dict, params: dict) -> str:
    rooms = data.get("rooms", [])
    meta = data.get("previewMetadata", {})
    nodes = meta.get("nodes", [])

    roles: dict[str, int] = {}
    for n in nodes:
        r = n.get("role", "path")
        roles[r] = roles.get(r, 0) + 1

    lines = [
        data.get("summary", "Map generated."),
        f"Seed: {data.get('seedLabel', 'N/A')}",
        f"Rooms: {len(rooms)}",
        f"Layout: {meta.get('layoutMode', params.get('layout', 'grid'))}",
        f"Archetype: {meta.get('archetype', params.get('archetype', 'linearAscent'))}",
        f"Kit: {params.get('kit', 'house')}",
        f"Cluster: {params.get('cluster_width', 2)}x{params.get('cluster_height', 2)}",
        f"Main path length: {len(meta.get('mainPathNodeIds', []))}",
        f"Roles: {', '.join(f'{r}={c}' for r, c in sorted(roles.items()))}",
    ]
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Rendering
# ---------------------------------------------------------------------------


def _alpha_blend(bg: tuple, fg: tuple, alpha: int) -> tuple:
    a = alpha / 255.0
    return (
        int(bg[0] * (1 - a) + fg[0] * a),
        int(bg[1] * (1 - a) + fg[1] * a),
        int(bg[2] * (1 - a) + fg[2] * a),
    )


def _get_room_color(color_index: int, kit_id: str) -> tuple:
    theme = KIT_THEMES.get(kit_id, KIT_THEMES["house"])
    palette = [theme["accent"], theme["glow"]] + ROOM_COLOR_PALETTE_FIXED
    idx = abs(color_index) % len(palette)
    return palette[idx]


def _render_preview(
    data: dict,
    kit_id: str,
    preview_mode: str = "combined",
    overlay_mode: str = "all",
    width: int = 1200,
    height: int = 800,
) -> bytes:
    theme = KIT_THEMES.get(kit_id, KIT_THEMES["house"])
    rooms = data.get("rooms", [])
    meta = data.get("previewMetadata", {})
    nodes = meta.get("nodes", [])

    if not rooms:
        img = Image.new("RGB", (width, height), theme["bg"])
        draw = ImageDraw.Draw(img)
        draw.text((width // 2 - 40, height // 2), "No rooms", fill=(200, 200, 200))
        buf = io.BytesIO()
        img.save(buf, "PNG")
        return buf.getvalue()

    # Compute world bounds
    show_rooms = preview_mode in ("combined", "rooms")
    show_topo = preview_mode in ("combined", "topology")

    if show_rooms:
        min_x = min(r["x"] for r in rooms)
        min_y = min(r["y"] for r in rooms)
        max_x = max(r["x"] + r["width"] for r in rooms)
        max_y = max(r["y"] + r["height"] for r in rooms)
    else:
        # topology-only: use room centers
        centers = [(r["x"] + r["width"] / 2, r["y"] + r["height"] / 2) for r in rooms]
        min_x = min(c[0] for c in centers) - 100
        min_y = min(c[1] for c in centers) - 100
        max_x = max(c[0] for c in centers) + 100
        max_y = max(c[1] for c in centers) + 100

    map_w = max_x - min_x
    map_h = max_y - min_y

    margin = 30
    fit_scale = min((width - 2 * margin) / max(map_w, 1), (height - 2 * margin) / max(map_h, 1))
    scale = fit_scale

    offset_x = margin + ((width - 2 * margin) - map_w * scale) / 2
    offset_y = margin + ((height - 2 * margin) - map_h * scale) / 2

    def world_to_screen(wx: float, wy: float) -> tuple[float, float]:
        return (offset_x + (wx - min_x) * scale, offset_y + (wy - min_y) * scale)

    # Create canvas
    img = Image.new("RGBA", (width, height), theme["bg"] + (255,))

    if show_rooms:
        _draw_rooms_layer(img, rooms, kit_id, theme, scale, world_to_screen)

    if show_topo:
        _draw_topology_layer(img, rooms, meta, nodes, scale, world_to_screen, overlay_mode)

    # Draw HUD label
    _draw_hud(img, kit_id, meta, len(rooms))

    # convert to RGB for PNG
    final = Image.new("RGB", (width, height), theme["bg"])
    final.paste(img, mask=img.split()[3])

    buf = io.BytesIO()
    final.save(buf, "PNG", optimize=True)
    return buf.getvalue()


def _draw_rooms_layer(img, rooms, kit_id, theme, scale, w2s):
    draw = ImageDraw.Draw(img, "RGBA")

    # World background fill
    if rooms:
        min_x = min(r["x"] for r in rooms)
        min_y = min(r["y"] for r in rooms)
        max_x = max(r["x"] + r["width"] for r in rooms)
        max_y = max(r["y"] + r["height"] for r in rooms)
        tl = w2s(min_x, min_y)
        br = w2s(max_x, max_y)
        draw.rectangle([tl, br], fill=theme["surface"] + (52,))

        # Grid lines every 128 world-px
        grid_color = theme["glow"] + (32,)
        step = 128
        x = min_x - (min_x % step)
        while x <= max_x:
            sx, _ = w2s(x, min_y)
            _, sy1 = w2s(x, min_y)
            _, sy2 = w2s(x, max_y)
            draw.line([(sx, sy1), (sx, sy2)], fill=grid_color, width=1)
            x += step
        y = min_y - (min_y % step)
        while y <= max_y:
            _, sy = w2s(min_x, y)
            sx1, _ = w2s(min_x, y)
            sx2, _ = w2s(max_x, y)
            draw.line([(sx1, sy), (sx2, sy)], fill=grid_color, width=1)
            y += step

    for room in rooms:
        rx, ry = room["x"], room["y"]
        rw, rh = room["width"], room["height"]

        # Room color fill
        room_color = _get_room_color(room.get("color", 0), kit_id)
        tl = w2s(rx, ry)
        br = w2s(rx + rw, ry + rh)
        draw.rectangle([tl, br], fill=room_color + (64,))

        # Tile grids
        scaled_tile = TILE_SIZE * scale
        if scaled_tile > 0.15:
            # Background tiles
            _draw_tile_grid(draw, room, "tilesBg", 88, scale, w2s)
            # Foreground tiles
            _draw_tile_grid(draw, room, "tilesFg", 228, scale, w2s)

        # Entities
        _draw_entities(draw, room, scale, w2s)

        # Room border
        accent = theme["accent"]
        draw.rectangle([tl, br], outline=accent + (180,), width=max(1, int(scale * 0.5)))


def _draw_tile_grid(draw, room, layer_key: str, alpha: int, scale: float, w2s):
    layer = room.get(layer_key)
    if not layer:
        return

    rx, ry = room["x"], room["y"]
    tile_rows = layer.get("tiles", [])
    tile_w = max(1, int(TILE_SIZE * scale))
    tile_h = max(1, int(TILE_SIZE * scale))

    for ty, row_str in enumerate(tile_rows):
        for tx, ch in enumerate(row_str):
            if ch == "0":
                continue
            color = TILE_COLORS.get(ch, DEFAULT_TILE_COLOR)
            wx = rx + tx * TILE_SIZE
            wy = ry + ty * TILE_SIZE
            sx, sy = w2s(wx, wy)
            draw.rectangle(
                [(sx, sy), (sx + tile_w, sy + tile_h)],
                fill=color + (alpha,),
            )


def _draw_entities(draw, room, scale: float, w2s):
    entities = room.get("entities", [])
    radius = max(4, int(10 * scale))
    for ent in entities:
        name = ent.get("name", "")
        color = ENTITY_COLORS.get(name, DEFAULT_ENTITY_COLOR)
        ex = room["x"] + ent.get("x", 0)
        ey = room["y"] + ent.get("y", 0)
        sx, sy = w2s(ex, ey)
        bbox = [sx - radius, sy - radius, sx + radius, sy + radius]
        draw.ellipse(bbox, fill=color + (220,), outline=(255, 255, 255, 220), width=1)


def _draw_topology_layer(img, rooms, meta, nodes, scale, w2s, overlay_mode):
    if not nodes:
        return

    draw = ImageDraw.Draw(img, "RGBA")

    # Build node-id -> room center map
    room_by_name: dict[str, dict] = {r["name"]: r for r in rooms}
    node_centers: dict[int, tuple[float, float]] = {}
    for node in nodes:
        room = room_by_name.get(node.get("roomName", ""))
        if room:
            cx = room["x"] + room["width"] / 2
            cy = room["y"] + room["height"] / 2
            node_centers[node["id"]] = w2s(cx, cy)

    main_path_ids = set(meta.get("mainPathNodeIds", []))
    node_by_id = {n["id"]: n for n in nodes}

    # Draw edges
    drawn_edges: set[tuple[int, int]] = set()
    for node in nodes:
        nid = node["id"]
        for cid in node.get("connections", []):
            edge = (min(nid, cid), max(nid, cid))
            if edge in drawn_edges:
                continue
            drawn_edges.add(edge)

            if nid not in node_centers or cid not in node_centers:
                continue

            p1 = node_centers[nid]
            p2 = node_centers[cid]

            is_main = nid in main_path_ids and cid in main_path_ids
            if is_main:
                draw.line([p1, p2], fill=(255, 222, 106, 246), width=max(3, int(scale * 0.18)))
            else:
                draw.line([p1, p2], fill=(145, 204, 255, 126), width=max(2, int(scale * 0.12)))

    # Draw markers
    start_id = meta.get("startNodeId")
    goal_id = meta.get("goalNodeId")

    for node in nodes:
        nid = node["id"]
        if nid not in node_centers:
            continue

        cx, cy = node_centers[nid]
        role = node.get("role", "path")
        phase = node.get("phase", "")

        if overlay_mode in ("all", "phase") and phase:
            pc = PHASE_COLORS.get(phase, DEFAULT_PHASE_COLOR)
            r = max(5, int(scale * 0.16))
            draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=pc + (200,), outline=(245, 247, 250, 230), width=1)

        if overlay_mode in ("all", "role"):
            _draw_role_marker(draw, cx, cy, role, scale)

        # Start / goal on top
        if nid == start_id:
            r = max(9, int(scale * 0.24))
            draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(102, 222, 132, 230), outline=(245, 247, 250, 230), width=2)
        elif nid == goal_id:
            r = max(9, int(scale * 0.24))
            draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(236, 88, 120, 230), outline=(245, 247, 250, 230), width=2)


def _draw_role_marker(draw, cx: float, cy: float, role: str, scale: float):
    if role == "branch":
        r = max(5, int(scale * 0.15))
        draw.rectangle([cx - r, cy - r, cx + r, cy + r], fill=(180, 215, 255, 70), outline=(245, 247, 250, 200), width=1)
    elif role == "reward":
        r = max(6, int(scale * 0.18))
        pts = [(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)]
        draw.polygon(pts, fill=(245, 216, 92, 200), outline=(245, 247, 250, 200))
    elif role == "setpiece":
        r = max(8, int(scale * 0.22))
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(255, 170, 84, 230), width=2)
    elif role == "knot":
        r = max(8, int(scale * 0.21))
        pts = [(cx, cy - r), (cx + r, cy), (cx, cy + r), (cx - r, cy)]
        draw.polygon(pts, outline=(181, 132, 255, 230), fill=None)
    elif role == "hub":
        r = max(8, int(scale * 0.22))
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(194, 154, 255, 200), outline=(245, 247, 250, 200), width=1)
    elif role == "checkpoint":
        r = max(7, int(scale * 0.2))
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(111, 185, 255, 200), outline=(245, 247, 250, 200), width=1)


def _draw_hud(img, kit_id: str, meta: dict, room_count: int):
    draw = ImageDraw.Draw(img, "RGBA")
    theme = KIT_THEMES.get(kit_id, KIT_THEMES["house"])

    # Background panel
    draw.rectangle([(8, 8), (310, 56)], fill=(0, 0, 0, 160))

    label = f"{theme['title']}  |  {meta.get('layoutMode', '?')}  |  {room_count} rooms"
    draw.text((14, 16), label, fill=(230, 230, 230, 255))

    archetype = meta.get("archetype", "?")
    arch_label = ARCHETYPE_CATALOG.get(archetype, {}).get("label", archetype)
    draw.text((14, 34), f"Archetype: {arch_label}", fill=(180, 180, 180, 255))


# ---------------------------------------------------------------------------
# MCP server
# ---------------------------------------------------------------------------

mcp = FastMCP("celeste-pcg", log_level="WARNING")


@mcp.tool()
def generate_map(
    mode: str = "pseudo",
    layout: str = "grid",
    archetype: str = "linearAscent",
    kit: str = "house",
    seed: int | None = None,
    cluster_width: int = 2,
    cluster_height: int = 2,
    room_width: int = 320,
    room_height: int = 184,
    room_gap: int = 16,
) -> str:
    """Generate a Celeste map using the native C++ PCG generator.

    Returns a text summary of the generated map. Use render_preview to see a visual image.
    Use inspect_topology for detailed room graph data.

    Args:
        mode: Random mode — "pseudo" (seeded) or "true" (system entropy)
        layout: Topology algorithm — grid, criticalPath, criticalPathBranches, celesteRandomizer, openSkeleton
        archetype: Chapter profile — linearAscent, longRunDensityBurst, spineCompactBranching, landmarkCorridor, celesteCategory, segmentedSummit
        kit: Visual theme — house, resort, cliffside, kirby, mario, metroidvania, labybirth, pizzatower, arcade
        seed: Seed for pseudo mode (0-4294967295). Omit for random.
        cluster_width: Number of rooms horizontally (1-12)
        cluster_height: Number of rooms vertically (1-12)
        room_width: Room width in pixels (80-1024)
        room_height: Room height in pixels (80-1024)
        room_gap: Gap between rooms in pixels (0-128)
    """
    global _last_generation, _last_params

    params = {
        "mode": mode,
        "layout": layout,
        "archetype": archetype,
        "kit": kit,
        "cluster_width": cluster_width,
        "cluster_height": cluster_height,
        "room_width": room_width,
        "room_height": room_height,
        "room_gap": room_gap,
    }

    if seed is not None:
        params["seed"] = seed
    elif mode == "pseudo":
        params["seed"] = pyrandom.randint(0, 2**32 - 1)

    data = _run_generator(params)
    _last_generation = data
    _last_params = params

    return _summarize(data, params)


@mcp.tool()
def render_preview(
    preview_mode: str = "combined",
    overlay_mode: str = "all",
    width: int = 1200,
    height: int = 800,
) -> list:
    """Render a visual preview of the last generated map as a PNG image.

    Must call generate_map first. Returns the image directly.

    Args:
        preview_mode: What to show — "combined" (rooms+topology), "rooms" (tiles only), "topology" (graph only)
        overlay_mode: Marker style — "all" (phase+role), "phase" (phase circles), "role" (role shapes)
        width: Image width in pixels
        height: Image height in pixels
    """
    if _last_generation is None:
        return [{"type": "text", "text": "No map generated yet. Call generate_map first."}]

    kit_id = _last_params.get("kit", "house") if _last_params else "house"
    png_bytes = _render_preview(_last_generation, kit_id, preview_mode, overlay_mode, width, height)
    b64 = base64.b64encode(png_bytes).decode("ascii")

    return [
        {"type": "image", "data": b64, "mimeType": "image/png"},
    ]


@mcp.tool()
def inspect_topology() -> str:
    """Return detailed topology data for the last generated map.

    Shows room graph, node roles, connections, main path, phases, and statistics.
    Must call generate_map first.
    """
    if _last_generation is None:
        return "No map generated yet. Call generate_map first."

    meta = _last_generation.get("previewMetadata", {})
    nodes = meta.get("nodes", [])
    main_path = meta.get("mainPathNodeIds", [])
    start_id = meta.get("startNodeId")
    goal_id = meta.get("goalNodeId")

    lines = [
        f"Layout: {meta.get('layoutMode', '?')}",
        f"Archetype: {meta.get('archetype', '?')}",
        f"Total nodes: {len(nodes)}",
        f"Main path length: {len(main_path)}",
        "",
        "--- Main Path ---",
    ]

    node_by_id = {n["id"]: n for n in nodes}
    for nid in main_path:
        n = node_by_id.get(nid, {})
        marker = ""
        if nid == start_id:
            marker = " [START]"
        elif nid == goal_id:
            marker = " [GOAL]"
        lines.append(f"  {n.get('roomName', '?')} — role={n.get('role','?')}, phase={n.get('phase','?')}, segment={n.get('segment','?')}{marker}")

    # Off-path nodes
    main_set = set(main_path)
    off_path = [n for n in nodes if n["id"] not in main_set]
    if off_path:
        lines.append("")
        lines.append("--- Off-Path Nodes ---")
        for n in off_path:
            conns = n.get("connections", [])
            lines.append(f"  {n.get('roomName','?')} — role={n.get('role','?')}, connections={len(conns)}")

    # Role summary
    roles: dict[str, list[str]] = {}
    for n in nodes:
        r = n.get("role", "path")
        roles.setdefault(r, []).append(n.get("roomName", "?"))

    lines.append("")
    lines.append("--- Roles ---")
    for role, names in sorted(roles.items()):
        lines.append(f"  {role}: {', '.join(names)}")

    # Edge count
    total_edges = sum(len(n.get("connections", [])) for n in nodes) // 2
    lines.append("")
    lines.append(f"Total edges: {total_edges}")
    lines.append(f"Density: {total_edges / max(len(nodes), 1):.2f} edges/node")

    return "\n".join(lines)


@mcp.tool()
def list_catalog(category: str = "all") -> str:
    """List available kits, archetypes, and layout algorithms.

    Args:
        category: What to list — "all", "kits", "archetypes", "layouts"
    """
    lines = []

    if category in ("all", "kits"):
        lines.append("=== Kits ===")
        for kid, kt in KIT_THEMES.items():
            tiles = kt["tiles"]
            lines.append(f"\n  {kid} — {kt['title']}")
            lines.append(f"    {kt['description']}")
            lines.append(f"    Tiles: wall={tiles['wall']} bg={tiles['bg']} platform={tiles['platform']} trim={tiles['trim']}")
            lines.append(f"    Colors: accent={kt['accent']} surface={kt['surface']} glow={kt['glow']} bg={kt['bg']}")

    if category in ("all", "archetypes"):
        lines.append("\n=== Archetypes ===")
        for aid, arc in ARCHETYPE_CATALOG.items():
            lines.append(f"\n  {aid} — {arc['label']}")
            lines.append(f"    Recommended layout: {arc['recommended']}")
            lines.append(f"    Preferred orientation: {arc['orientation']}")

    if category in ("all", "layouts"):
        lines.append("\n=== Layouts ===")
        for lid, desc in LAYOUT_DESCRIPTIONS.items():
            lines.append(f"\n  {lid} — {desc}")

    return "\n".join(lines)


@mcp.tool()
def tweak_and_regenerate(
    seed: int | None = None,
    layout: str | None = None,
    archetype: str | None = None,
    kit: str | None = None,
    cluster_width: int | None = None,
    cluster_height: int | None = None,
    room_width: int | None = None,
    room_height: int | None = None,
    room_gap: int | None = None,
    preview_mode: str = "combined",
    overlay_mode: str = "all",
) -> list:
    """Tweak parameters from the last generation and re-generate with a new preview.

    Only provide the parameters you want to change. All others keep their previous values.
    Returns both a text summary and a rendered preview image.
    Must call generate_map at least once before using this.

    Args:
        seed: New seed (omit to auto-randomize)
        layout: Override layout algorithm
        archetype: Override chapter archetype
        kit: Override visual theme
        cluster_width: Override cluster width
        cluster_height: Override cluster height
        room_width: Override room width
        room_height: Override room height
        room_gap: Override room gap
        preview_mode: Preview render mode — combined, rooms, topology
        overlay_mode: Overlay style — all, phase, role
    """
    global _last_generation, _last_params

    if _last_params is None:
        return [{"type": "text", "text": "No previous generation. Call generate_map first."}]

    # Merge overrides
    params = dict(_last_params)
    overrides = {
        "layout": layout, "archetype": archetype, "kit": kit,
        "cluster_width": cluster_width, "cluster_height": cluster_height,
        "room_width": room_width, "room_height": room_height, "room_gap": room_gap,
    }
    for k, v in overrides.items():
        if v is not None:
            params[k] = v

    if seed is not None:
        params["seed"] = seed
    else:
        params["seed"] = pyrandom.randint(0, 2**32 - 1)

    data = _run_generator(params)
    _last_generation = data
    _last_params = params

    summary = _summarize(data, params)

    kit_id = params.get("kit", "house")
    png_bytes = _render_preview(data, kit_id, preview_mode, overlay_mode)
    b64 = base64.b64encode(png_bytes).decode("ascii")

    return [
        {"type": "text", "text": summary},
        {"type": "image", "data": b64, "mimeType": "image/png"},
    ]


# ---------------------------------------------------------------------------
# GAN-based room filling
# ---------------------------------------------------------------------------

@mcp.tool()
def generate_gan_room(
    room_width: int = 320,
    room_height: int = 184,
    kit: str = "house",
    temperature: float = 1.0,
) -> str:
    """Fill an empty room with GAN-generated tile content using CelesteGAN.

    Uses a multi-scale GAN trained on existing Celeste levels to generate
    tile layouts that resemble real rooms. The GAN learns spatial patterns
    (walls, platforms, open areas) from training data.

    Requires a trained model at celeste-gan/checkpoints/celeste_gan.pt.

    Args:
        room_width: Room width in pixels (must be multiple of 8, 80-1024)
        room_height: Room height in pixels (must be multiple of 8, 80-1024)
        kit: Visual theme for tile remapping — house, resort, cliffside, kirby, mario, metroidvania, labybirth, pizzatower, arcade
        temperature: Noise intensity (0.1=conservative, 1.0=normal, 2.0=wild)
    """
    if not _GAN_AVAILABLE:
        return ("CelesteGAN not available. Install PyTorch:\n"
                "  pip install torch torchvision numpy\n"
                "Then train a model:\n"
                "  cd celeste-gan && python celeste_gan.py prepare --input ../test-export --output ./data\n"
                "  python celeste_gan.py train --data ./data")

    gan = _get_gan_model()
    if gan is None:
        return ("No trained GAN model found. Train one first:\n"
                "  cd celeste-gan\n"
                "  python celeste_gan.py prepare --input ../test-export --output ./data\n"
                "  python celeste_gan.py train --data ./data")

    tw = room_width // 8
    th = room_height // 8

    grid = gan.generate_with_kit(th, tw, kit, temperature)
    tiles = tile_grid_to_strings(grid)

    room_data = {
        "name": "gan_room",
        "x": 0,
        "y": 0,
        "width": room_width,
        "height": room_height,
        "tileWidth": tw,
        "tileHeight": th,
        "tilesFg": {"tiles": tiles},
        "tilesBg": {"tiles": ["0" * tw] * th},
        "entities": [],
        "triggers": [],
    }

    return json.dumps(room_data, indent=2)


@mcp.tool()
def gan_fill_room(
    room_index: int = 0,
    kit: str = "house",
    temperature: float = 1.0,
    layer: str = "fg",
) -> str:
    """Fill an existing room from the last generated map with GAN tiles.

    Replaces the specified tile layer of the room at the given index with
    GAN-generated content, keeping the room's position, size, entities,
    and triggers intact.

    Args:
        room_index: Index of the room in the last generated map (0-based)
        kit: Visual theme for tile remapping
        temperature: Noise intensity (0.1-3.0)
        layer: Which tile layer to fill — "fg" (foreground) or "bg" (background)
    """
    if not _GAN_AVAILABLE:
        return "CelesteGAN not available. Install PyTorch first."

    gan = _get_gan_model()
    if gan is None:
        return "No trained GAN model. Run training first."

    if _last_generation is None:
        return "No map generated yet. Call generate_map first."

    rooms = _last_generation.get("rooms", [])
    if room_index < 0 or room_index >= len(rooms):
        return f"Room index {room_index} out of range (0-{len(rooms)-1})"

    room = rooms[room_index]
    tw = room.get("tileWidth", room["width"] // 8)
    th = room.get("tileHeight", room["height"] // 8)

    grid = gan.generate_with_kit(th, tw, kit, temperature)
    tiles = tile_grid_to_strings(grid)

    key = "tilesFg" if layer == "fg" else "tilesBg"
    room[key] = {"tiles": tiles}

    return f"Filled room {room_index} ({room.get('name', '?')}) {layer} layer with GAN tiles ({tw}×{th})"


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    print("Celeste PCG MCP Server starting...", file=sys.stderr)
    try:
        exe = _find_generator_exe()
        print(f"Generator found: {exe}", file=sys.stderr)
    except FileNotFoundError as e:
        print(f"WARNING: {e}", file=sys.stderr)
    mcp.run(transport="stdio")
