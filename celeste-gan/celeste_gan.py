"""
CelesteGAN — Multi-scale GAN for Celeste level tile generation.

A SinGAN-inspired architecture that learns tile distributions from existing
Celeste levels and generates new room layouts from noise at multiple scales.

Pipeline:
  1. Parse level JSONs → extract tile grids (fg/bg) as integer arrays
  2. Encode tiles as categorical channels → RGB images via TILE_COLORS
  3. Train multi-scale generators at 3 progressive resolutions
  4. Inference: noise → multi-scale generators → output tiles

Usage:
  # Prepare training data from test-export JSONs
  python celeste_gan.py prepare --input ../test-export --output ./data

  # Train the GAN
  python celeste_gan.py train --data ./data --epochs 2000 --scales 3

  # Generate a new room from noise
  python celeste_gan.py generate --model ./checkpoints/celeste_gan.pt \
      --width 40 --height 23 --kit house --output room.json

  # Serve as HTTP for Electron app integration
  python celeste_gan.py serve --model ./checkpoints/celeste_gan.pt --port 5555
"""

import argparse
import json
import math
import os
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from typing import Optional

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
import torch.optim as optim
from PIL import Image

# ---------------------------------------------------------------------------
# Tile encoding
# ---------------------------------------------------------------------------

TILE_CHARS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
              'a', 'b', 'c', 'd', 'e', 'f']
CHAR_TO_IDX = {c: i for i, c in enumerate(TILE_CHARS)}
NUM_TILES = len(TILE_CHARS)  # 16

# RGB colours matching the editor/MCP palette
TILE_COLORS = {
    '0': (0, 0, 0),          # empty
    '1': (67, 86, 126),
    '2': (116, 70, 70),
    '3': (139, 118, 196),
    '4': (197, 112, 71),
    '5': (153, 150, 117),
    '6': (84, 140, 102),
    '7': (90, 95, 108),
    '8': (77, 122, 129),
    '9': (138, 106, 72),
    'a': (209, 180, 80),
    'b': (104, 104, 128),
    'c': (219, 128, 171),
    'd': (245, 194, 116),
    'e': (131, 219, 205),
    'f': (182, 182, 194),
}

# Kit tile assignments (which tile chars each kit uses)
KIT_TILES = {
    'house':        {'wall': '9', 'bg': '1', 'platform': 'a', 'trim': '5'},
    'resort':       {'wall': '7', 'bg': '6', 'platform': '4', 'trim': '5'},
    'cliffside':    {'wall': 'b', 'bg': '8', 'platform': '9', 'trim': 'f'},
    'kirby':        {'wall': 'c', 'bg': '3', 'platform': 'd', 'trim': 'e'},
    'mario':        {'wall': '2', 'bg': '4', 'platform': '6', 'trim': '8'},
    'metroidvania': {'wall': 'f', 'bg': '2', 'platform': '7', 'trim': 'b'},
    'labybirth':    {'wall': '6', 'bg': '1', 'platform': '5', 'trim': '9'},
    'pizzatower':   {'wall': 'd', 'bg': '5', 'platform': 'a', 'trim': 'c'},
    'arcade':       {'wall': '3', 'bg': '8', 'platform': 'e', 'trim': '4'},
}


def tiles_to_image(tile_grid: np.ndarray) -> np.ndarray:
    """Convert integer tile grid (H, W) → RGB image (H, W, 3) float32 [0, 1]."""
    h, w = tile_grid.shape
    img = np.zeros((h, w, 3), dtype=np.float32)
    for idx, char in enumerate(TILE_CHARS):
        r, g, b = TILE_COLORS[char]
        mask = tile_grid == idx
        img[mask] = [r / 255.0, g / 255.0, b / 255.0]
    return img


def image_to_tiles(img: np.ndarray) -> np.ndarray:
    """Convert RGB image (H, W, 3) float32 [0, 1] → integer tile grid (H, W).

    Each pixel is mapped to the nearest tile colour.
    """
    h, w, _ = img.shape
    # Build lookup: (NUM_TILES, 3)
    palette = np.array([list(TILE_COLORS[c]) for c in TILE_CHARS], dtype=np.float32) / 255.0
    flat = img.reshape(-1, 3)  # (H*W, 3)
    # Nearest-colour lookup via squared distance
    dists = np.sum((flat[:, None, :] - palette[None, :, :]) ** 2, axis=2)  # (H*W, 16)
    indices = np.argmin(dists, axis=1)  # (H*W,)
    return indices.reshape(h, w).astype(np.int32)


def tile_grid_to_strings(grid: np.ndarray) -> list[str]:
    """Convert integer tile grid (H, W) → list of tile-character strings."""
    rows = []
    for r in range(grid.shape[0]):
        rows.append(''.join(TILE_CHARS[grid[r, c]] for c in range(grid.shape[1])))
    return rows


def strings_to_tile_grid(rows: list[str]) -> np.ndarray:
    """Convert list of tile-character strings → integer tile grid (H, W)."""
    h = len(rows)
    w = max(len(r) for r in rows) if rows else 0
    grid = np.zeros((h, w), dtype=np.int32)
    for r, row in enumerate(rows):
        for c, ch in enumerate(row):
            grid[r, c] = CHAR_TO_IDX.get(ch, 0)
    return grid


# ---------------------------------------------------------------------------
# Data preparation
# ---------------------------------------------------------------------------

def extract_rooms_from_json(json_path: Path) -> list[dict]:
    """Extract room tile grids from a level JSON file."""
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    rooms = []

    # Handle both editor format and export format
    level_list = data.get('rooms', data.get('levels', []))

    for level in level_list:
        w = level.get('width', 320)
        h = level.get('height', 184)
        tw = w // 8
        th = h // 8

        # Get tile data — could be in several formats
        fg_data = None
        bg_data = None

        if 'tilesFg' in level:
            fg_raw = level['tilesFg']
            if isinstance(fg_raw, dict) and 'tiles' in fg_raw:
                fg_data = fg_raw['tiles']
            elif isinstance(fg_raw, str):
                fg_data = fg_raw.split('\n')
        elif 'solids' in level:
            sol = level['solids']
            if sol:
                fg_data = sol.split('\n')

        if 'tilesBg' in level:
            bg_raw = level['tilesBg']
            if isinstance(bg_raw, dict) and 'tiles' in bg_raw:
                bg_data = bg_raw['tiles']
            elif isinstance(bg_raw, str):
                bg_data = bg_raw.split('\n')
        elif 'bg' in level:
            bg_str = level['bg']
            if bg_str:
                bg_data = bg_str.split('\n')

        # Build tile grids (skip rooms with no tile data)
        has_fg = fg_data and any(any(c != '0' for c in row) for row in fg_data if row)
        has_bg = bg_data and any(any(c != '0' for c in row) for row in bg_data if row)

        if not has_fg and not has_bg:
            continue

        def parse_rows(rows, tw, th):
            grid = np.zeros((th, tw), dtype=np.int32)
            if not rows:
                return grid
            for r in range(min(th, len(rows))):
                for c in range(min(tw, len(rows[r]))):
                    grid[r, c] = CHAR_TO_IDX.get(rows[r][c], 0)
            return grid

        fg_grid = parse_rows(fg_data, tw, th) if fg_data else np.zeros((th, tw), dtype=np.int32)
        bg_grid = parse_rows(bg_data, tw, th) if bg_data else np.zeros((th, tw), dtype=np.int32)

        rooms.append({
            'name': level.get('name', level.get('id', 'unknown')),
            'width': tw,
            'height': th,
            'fg': fg_grid,
            'bg': bg_grid,
        })

    return rooms


def prepare_dataset(input_dir: Path, output_dir: Path):
    """Scan level JSONs and save extracted tile images as training data."""
    output_dir.mkdir(parents=True, exist_ok=True)
    fg_dir = output_dir / 'fg'
    bg_dir = output_dir / 'bg'
    fg_dir.mkdir(exist_ok=True)
    bg_dir.mkdir(exist_ok=True)

    count = 0
    for json_path in sorted(input_dir.glob('*.json')):
        rooms = extract_rooms_from_json(json_path)
        for room in rooms:
            # Save as PNG images (quantized tile colours)
            fg_img = tiles_to_image(room['fg'])
            bg_img = tiles_to_image(room['bg'])

            fg_pil = Image.fromarray((fg_img * 255).astype(np.uint8))
            bg_pil = Image.fromarray((bg_img * 255).astype(np.uint8))

            stem = f"{json_path.stem}_{room['name']}"
            fg_pil.save(fg_dir / f"{stem}.png")
            bg_pil.save(bg_dir / f"{stem}.png")

            # Also save the raw grid as .npy for fast loading
            np.save(fg_dir / f"{stem}.npy", room['fg'])
            np.save(bg_dir / f"{stem}.npy", room['bg'])

            count += 1

    print(f"Prepared {count} rooms from {input_dir}")
    return count


# ---------------------------------------------------------------------------
# GAN architecture — multi-scale (SinGAN-inspired)
# ---------------------------------------------------------------------------

class ConvBlock(nn.Module):
    """Conv → BatchNorm → LeakyReLU block."""

    def __init__(self, in_ch: int, out_ch: int, kernel: int = 3, stride: int = 1):
        super().__init__()
        self.block = nn.Sequential(
            nn.Conv2d(in_ch, out_ch, kernel, stride, padding=kernel // 2),
            nn.BatchNorm2d(out_ch),
            nn.LeakyReLU(0.2, inplace=True),
        )

    def forward(self, x):
        return self.block(x)


class Generator(nn.Module):
    """Single-scale generator: takes noise + upscaled previous output → refined output."""

    def __init__(self, in_ch: int = 3, out_ch: int = 3, nf: int = 64, n_blocks: int = 5):
        super().__init__()
        layers = [ConvBlock(in_ch, nf, 3)]
        for _ in range(n_blocks - 2):
            layers.append(ConvBlock(nf, nf, 3))
        layers.append(nn.Conv2d(nf, out_ch, 3, 1, 1))
        layers.append(nn.Tanh())
        self.net = nn.Sequential(*layers)

    def forward(self, noise, prev_output=None):
        if prev_output is not None:
            x = noise + prev_output
        else:
            x = noise
        return self.net(x)


class Discriminator(nn.Module):
    """PatchGAN discriminator for a single scale."""

    def __init__(self, in_ch: int = 3, nf: int = 64, n_layers: int = 4):
        super().__init__()
        layers = [
            nn.Conv2d(in_ch, nf, 3, 1, 1),
            nn.LeakyReLU(0.2, inplace=True),
        ]
        cur_ch = nf
        for i in range(1, n_layers):
            next_ch = min(nf * (2 ** i), 256)
            layers.extend([
                nn.Conv2d(cur_ch, next_ch, 3, 1, 1),
                nn.BatchNorm2d(next_ch),
                nn.LeakyReLU(0.2, inplace=True),
            ])
            cur_ch = next_ch
        layers.append(nn.Conv2d(cur_ch, 1, 3, 1, 1))
        self.net = nn.Sequential(*layers)

    def forward(self, x):
        return self.net(x)


class CelesteGAN:
    """Multi-scale GAN container — trains and generates at N scales."""

    def __init__(self, num_scales: int = 3, nf: int = 64, device: str = 'cpu'):
        self.num_scales = num_scales
        self.nf = nf
        self.device = torch.device(device)

        self.generators: list[Generator] = []
        self.discriminators: list[Discriminator] = []
        self.noise_amplitudes: list[float] = []
        self.scale_sizes: list[tuple[int, int]] = []  # (H, W) at each scale

    def _build_pyramid(self, target_h: int, target_w: int) -> list[tuple[int, int]]:
        """Compute progressive sizes from coarsest to finest (target)."""
        sizes = []
        scale_factor = 0.75  # Each scale is 75% of the next
        for i in range(self.num_scales):
            r = scale_factor ** (self.num_scales - 1 - i)
            h = max(5, int(round(target_h * r)))
            w = max(7, int(round(target_w * r)))
            sizes.append((h, w))
        return sizes

    def train(self, tile_grids: list[np.ndarray], epochs: int = 2000,
              lr: float = 5e-4, lambda_rec: float = 10.0,
              checkpoint_dir: Optional[Path] = None,
              batch_size: int = 16,
              log_every: int = 10):
        """Train the multi-scale GAN on a collection of tile grids."""
        if not tile_grids:
            print("No training data!")
            return

        log_every = max(1, int(log_every))

        # Use the median room size as target
        heights = [g.shape[0] for g in tile_grids]
        widths = [g.shape[1] for g in tile_grids]
        target_h = int(np.median(heights))
        target_w = int(np.median(widths))
        print(f"Target tile size: {target_w}×{target_h} ({target_w * 8}×{target_h * 8} px)")

        self.scale_sizes = self._build_pyramid(target_h, target_w)
        print(f"Scale pyramid: {self.scale_sizes}")

        # Convert all grids to images and resize to target
        real_images = []
        for grid in tile_grids:
            img = tiles_to_image(grid)  # (H, W, 3) float32 [0,1]
            img_t = torch.from_numpy(img).permute(2, 0, 1).unsqueeze(0)  # (1, 3, H, W)
            img_resized = F.interpolate(img_t, size=(target_h, target_w),
                                        mode='bilinear', align_corners=False)
            img_resized = img_resized * 2.0 - 1.0
            real_images.append(img_resized)

        real_batch = torch.cat(real_images, dim=0).to(self.device)  # (N, 3, H, W)
        n_samples = real_batch.size(0)
        print(f"Training on {n_samples} samples, batch_size={batch_size}")

        # Train scale by scale (coarse to fine)
        prev_reconstructions = None

        for scale_idx in range(self.num_scales):
            sh, sw = self.scale_sizes[scale_idx]
            print(f"\n--- Scale {scale_idx}: {sw}×{sh} ---")

            # Resize real images to this scale
            real_scale = F.interpolate(real_batch, size=(sh, sw),
                                       mode='bilinear', align_corners=False)

            gen = Generator(3, 3, self.nf).to(self.device)
            disc = Discriminator(3, self.nf).to(self.device)

            opt_g = optim.Adam(gen.parameters(), lr=lr, betas=(0.5, 0.999))
            opt_d = optim.Adam(disc.parameters(), lr=lr, betas=(0.5, 0.999))

            # Compute noise amplitude
            if prev_reconstructions is not None:
                prev_up_all = F.interpolate(prev_reconstructions, size=(sh, sw),
                                            mode='bilinear', align_corners=False)
                noise_amp = torch.sqrt(F.mse_loss(real_scale, prev_up_all)).item()
            else:
                noise_amp = 1.0
                prev_up_all = None

            noise_amp = max(noise_amp, 0.01)
            print(f"  Noise amplitude: {noise_amp:.4f}")

            for epoch in range(epochs):
                # Shuffle indices each epoch
                perm = torch.randperm(n_samples)

                epoch_loss_d = 0.0
                epoch_loss_g = 0.0
                epoch_loss_rec = 0.0
                n_batches = 0

                for start in range(0, n_samples, batch_size):
                    idx = perm[start:start + batch_size]
                    real_b = real_scale[idx]
                    prev_b = prev_up_all[idx] if prev_up_all is not None else None
                    bs = real_b.size(0)

                    # === Train Discriminator ===
                    opt_d.zero_grad()
                    noise = torch.randn(bs, 3, sh, sw, device=self.device) * noise_amp
                    fake = gen(noise, prev_b)
                    d_real = disc(real_b)
                    d_fake = disc(fake.detach())

                    loss_d = -d_real.mean() + d_fake.mean()

                    # Gradient penalty
                    alpha = torch.rand(bs, 1, 1, 1, device=self.device)
                    interp = (alpha * real_b + (1 - alpha) * fake.detach()).requires_grad_(True)
                    d_interp = disc(interp)
                    grad = torch.autograd.grad(d_interp.sum(), interp, create_graph=True)[0]
                    gp = ((grad.norm(2, dim=1) - 1) ** 2).mean()
                    loss_d = loss_d + 10.0 * gp

                    loss_d.backward()
                    opt_d.step()

                    # === Train Generator ===
                    opt_g.zero_grad()
                    noise = torch.randn(bs, 3, sh, sw, device=self.device) * noise_amp
                    fake = gen(noise, prev_b)
                    d_fake = disc(fake)
                    loss_g_adv = -d_fake.mean()

                    rec_noise = torch.zeros(bs, 3, sh, sw, device=self.device)
                    rec = gen(rec_noise, prev_b)
                    loss_rec = F.mse_loss(rec, real_b) * lambda_rec

                    loss_g = loss_g_adv + loss_rec
                    loss_g.backward()
                    opt_g.step()

                    epoch_loss_d += loss_d.item()
                    epoch_loss_g += loss_g_adv.item()
                    epoch_loss_rec += loss_rec.item()
                    n_batches += 1

                if epoch % log_every == 0 or epoch == epochs - 1:
                    print(f"  Epoch {epoch:4d} | D: {epoch_loss_d/n_batches:.4f} | "
                          f"G_adv: {epoch_loss_g/n_batches:.4f} | "
                          f"Rec: {epoch_loss_rec/n_batches:.4f}")

            # Store trained models
            gen.eval()
            self.generators.append(gen)
            self.discriminators.append(disc)
            self.noise_amplitudes.append(noise_amp)

            # Compute reconstructions for next scale (batched)
            with torch.no_grad():
                rec_parts = []
                for start in range(0, n_samples, batch_size):
                    b = real_scale[start:start + batch_size]
                    prev_b = prev_up_all[start:start + batch_size] if prev_up_all is not None else None
                    rec_noise = torch.zeros(b.size(0), 3, sh, sw, device=self.device)
                    rec_parts.append(gen(rec_noise, prev_b))
                prev_reconstructions = torch.cat(rec_parts, dim=0)

        # Save checkpoint
        if checkpoint_dir:
            checkpoint_dir.mkdir(parents=True, exist_ok=True)
            self.save(checkpoint_dir / 'celeste_gan.pt')
            print(f"\nCheckpoint saved to {checkpoint_dir / 'celeste_gan.pt'}")

    @torch.no_grad()
    def generate(self, target_h: int = 23, target_w: int = 40,
                 temperature: float = 1.0) -> np.ndarray:
        """Generate a tile grid from noise.

        Args:
            target_h: Target height in tiles.
            target_w: Target width in tiles.
            temperature: Noise scaling factor (higher = more variation).

        Returns:
            Integer tile grid (H, W).
        """
        # Rebuild scale pyramid for the requested size
        sizes = self._build_pyramid(target_h, target_w)

        prev_output = None
        for scale_idx, (sh, sw) in enumerate(sizes):
            gen = self.generators[scale_idx]
            amp = self.noise_amplitudes[scale_idx] * temperature

            noise = torch.randn(1, 3, sh, sw, device=self.device) * amp

            if prev_output is not None:
                prev_up = F.interpolate(prev_output, size=(sh, sw),
                                        mode='bilinear', align_corners=False)
            else:
                prev_up = None

            prev_output = gen(noise, prev_up)

        # Convert output image [-1, 1] → [0, 1] → tile grid
        img = (prev_output.squeeze(0).permute(1, 2, 0).cpu().numpy() + 1.0) / 2.0
        img = np.clip(img, 0, 1)

        # Resize to exact target if needed
        if img.shape[0] != target_h or img.shape[1] != target_w:
            pil = Image.fromarray((img * 255).astype(np.uint8))
            pil = pil.resize((target_w, target_h), Image.NEAREST)
            img = np.array(pil).astype(np.float32) / 255.0

        return image_to_tiles(img)

    @torch.no_grad()
    def generate_with_kit(self, target_h: int = 23, target_w: int = 40,
                          kit: str = 'house', temperature: float = 1.0) -> np.ndarray:
        """Generate and remap tiles to use the specified kit's tile characters."""
        grid = self.generate(target_h, target_w, temperature)
        return self._remap_to_kit(grid, kit)

    @staticmethod
    def _remap_to_kit(grid: np.ndarray, kit: str) -> np.ndarray:
        """Remap generated tile indices to use a specific kit's tile assignments.

        The GAN generates abstract tile categories. This maps them to the kit's
        actual tile characters:
          - Solid/dense tiles → kit wall tile
          - Medium tiles → kit platform tile
          - Light tiles → kit background tile
          - Sparse tiles → kit trim tile
          - Index 0 → stays empty
        """
        kit_def = KIT_TILES.get(kit, KIT_TILES['house'])
        wall_idx = CHAR_TO_IDX[kit_def['wall']]
        bg_idx = CHAR_TO_IDX[kit_def['bg']]
        plat_idx = CHAR_TO_IDX[kit_def['platform']]
        trim_idx = CHAR_TO_IDX[kit_def['trim']]

        remapped = np.zeros_like(grid)
        for r in range(grid.shape[0]):
            for c in range(grid.shape[1]):
                v = grid[r, c]
                if v == 0:
                    remapped[r, c] = 0  # empty stays empty
                elif v <= 4:
                    remapped[r, c] = wall_idx
                elif v <= 8:
                    remapped[r, c] = plat_idx
                elif v <= 12:
                    remapped[r, c] = bg_idx
                else:
                    remapped[r, c] = trim_idx

        return remapped

    def save(self, path: Path):
        """Save all models and metadata to a single checkpoint."""
        state = {
            'num_scales': self.num_scales,
            'nf': self.nf,
            'scale_sizes': self.scale_sizes,
            'noise_amplitudes': self.noise_amplitudes,
            'generators': [g.state_dict() for g in self.generators],
            'discriminators': [d.state_dict() for d in self.discriminators],
        }
        torch.save(state, path)

    def load(self, path: Path):
        """Load models from checkpoint."""
        state = torch.load(path, map_location=self.device, weights_only=False)
        self.num_scales = state['num_scales']
        self.nf = state['nf']
        self.scale_sizes = state['scale_sizes']
        self.noise_amplitudes = state['noise_amplitudes']

        self.generators = []
        self.discriminators = []
        for i in range(self.num_scales):
            gen = Generator(3, 3, self.nf).to(self.device)
            gen.load_state_dict(state['generators'][i])
            gen.eval()
            self.generators.append(gen)

            disc = Discriminator(3, self.nf).to(self.device)
            disc.load_state_dict(state['discriminators'][i])
            disc.eval()
            self.discriminators.append(disc)


# ---------------------------------------------------------------------------
# HTTP server for Electron app integration
# ---------------------------------------------------------------------------

_gan_instance: Optional[CelesteGAN] = None


class GANRequestHandler(BaseHTTPRequestHandler):
    """Simple HTTP handler for GAN generation requests."""

    def log_message(self, fmt, *args):
        # Suppress default logging
        pass

    def do_POST(self):
        if self.path == '/generate':
            content_len = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_len)
            try:
                params = json.loads(body)
            except json.JSONDecodeError:
                self._send_error(400, 'Invalid JSON')
                return

            width = params.get('width', 40)
            height = params.get('height', 23)
            kit = params.get('kit', 'house')
            temperature = params.get('temperature', 1.0)

            # Validate inputs
            width = max(5, min(width, 256))
            height = max(5, min(height, 128))
            temperature = max(0.1, min(temperature, 3.0))

            if _gan_instance is None:
                self._send_error(503, 'Model not loaded')
                return

            try:
                grid = _gan_instance.generate_with_kit(height, width, kit, temperature)
                tiles = tile_grid_to_strings(grid)
                result = {'tiles': tiles, 'width': width, 'height': height}
                self._send_json(200, result)
            except Exception as e:
                self._send_error(500, str(e))

        elif self.path == '/health':
            self._send_json(200, {'status': 'ok', 'model_loaded': _gan_instance is not None})
        else:
            self._send_error(404, 'Not found')

    def do_GET(self):
        if self.path == '/health':
            self._send_json(200, {'status': 'ok', 'model_loaded': _gan_instance is not None})
        else:
            self._send_error(404, 'Not found')

    def _send_json(self, code: int, data: dict):
        body = json.dumps(data).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_error(self, code: int, msg: str):
        self._send_json(code, {'error': msg})


def serve_model(model_path: Path, port: int = 5555, device: str = 'cpu'):
    """Start HTTP server for GAN inference."""
    global _gan_instance
    _gan_instance = CelesteGAN(device=device)
    _gan_instance.load(model_path)
    print(f"Model loaded from {model_path}")
    print(f"Serving on http://127.0.0.1:{port}")

    server = HTTPServer(('127.0.0.1', port), GANRequestHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down.")
        server.server_close()


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def cmd_prepare(args):
    input_dir = Path(args.input)
    output_dir = Path(args.output)
    if not input_dir.exists():
        print(f"Input directory not found: {input_dir}")
        sys.exit(1)
    prepare_dataset(input_dir, output_dir)


def cmd_train(args):
    data_dir = Path(args.data)
    fg_dir = data_dir / 'fg'

    if not fg_dir.exists():
        print(f"No prepared data at {fg_dir}. Run 'prepare' first.")
        sys.exit(1)

    # Load .npy tile grids
    grids = []
    for npy_path in sorted(fg_dir.glob('*.npy')):
        grid = np.load(npy_path)
        # Only use rooms with actual tile content
        if grid.max() > 0:
            grids.append(grid)

    if not grids:
        print("No training data with tile content found!")
        sys.exit(1)

    print(f"Loaded {len(grids)} rooms for training")

    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    print(f"Using device: {device}")

    gan = CelesteGAN(num_scales=args.scales, nf=args.nf, device=device)
    checkpoint_dir = Path(args.checkpoint_dir)
    gan.train(grids, epochs=args.epochs, lr=args.lr,
              lambda_rec=args.lambda_rec, checkpoint_dir=checkpoint_dir,
              batch_size=args.batch_size, log_every=args.log_every)


def cmd_generate(args):
    model_path = Path(args.model)
    if not model_path.exists():
        print(f"Model not found: {model_path}")
        sys.exit(1)

    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    gan = CelesteGAN(device=device)
    gan.load(model_path)

    grid = gan.generate_with_kit(args.height, args.width, args.kit, args.temperature)
    tiles = tile_grid_to_strings(grid)

    if args.output:
        result = {
            'tilesFg': {'tiles': tiles, 'width': args.width, 'height': args.height},
            'tilesBg': {'tiles': ['0' * args.width] * args.height,
                        'width': args.width, 'height': args.height},
            'width': args.width * 8,
            'height': args.height * 8,
        }
        with open(args.output, 'w') as f:
            json.dump(result, f, indent=2)
        print(f"Generated room saved to {args.output}")
    else:
        for row in tiles:
            print(row)

    # Also save preview image
    if args.preview:
        img = tiles_to_image(grid)
        pil = Image.fromarray((img * 255).astype(np.uint8))
        pil = pil.resize((args.width * 8, args.height * 8), Image.NEAREST)
        pil.save(args.preview)
        print(f"Preview saved to {args.preview}")


def cmd_serve(args):
    model_path = Path(args.model)
    if not model_path.exists():
        print(f"Model not found: {model_path}")
        sys.exit(1)
    device = 'cuda' if torch.cuda.is_available() else 'cpu'
    serve_model(model_path, args.port, device)


def main():
    parser = argparse.ArgumentParser(description='CelesteGAN — Multi-scale GAN for Celeste levels')
    sub = parser.add_subparsers(dest='command')

    # prepare
    p_prep = sub.add_parser('prepare', help='Extract tile data from level JSONs')
    p_prep.add_argument('--input', required=True, help='Directory with level JSON files')
    p_prep.add_argument('--output', default='./data', help='Output directory for training data')

    # train
    p_train = sub.add_parser('train', help='Train the multi-scale GAN')
    p_train.add_argument('--data', default='./data', help='Prepared data directory')
    p_train.add_argument('--epochs', type=int, default=2000, help='Epochs per scale')
    p_train.add_argument('--scales', type=int, default=3, help='Number of scales')
    p_train.add_argument('--nf', type=int, default=64, help='Base filter count')
    p_train.add_argument('--lr', type=float, default=5e-4, help='Learning rate')
    p_train.add_argument('--lambda-rec', type=float, default=10.0, help='Reconstruction loss weight')
    p_train.add_argument('--batch-size', type=int, default=16, help='Mini-batch size')
    p_train.add_argument('--log-every', type=int, default=10, help='Print metrics every N epochs')
    p_train.add_argument('--checkpoint-dir', default='./checkpoints', help='Where to save model')

    # generate
    p_gen = sub.add_parser('generate', help='Generate a room from trained model')
    p_gen.add_argument('--model', required=True, help='Path to .pt checkpoint')
    p_gen.add_argument('--width', type=int, default=40, help='Room width in tiles')
    p_gen.add_argument('--height', type=int, default=23, help='Room height in tiles')
    p_gen.add_argument('--kit', default='house', help='Kit for tile remapping')
    p_gen.add_argument('--temperature', type=float, default=1.0, help='Noise temperature')
    p_gen.add_argument('--output', help='Output JSON file')
    p_gen.add_argument('--preview', help='Output preview PNG')

    # serve
    p_serve = sub.add_parser('serve', help='Start HTTP server for Electron integration')
    p_serve.add_argument('--model', required=True, help='Path to .pt checkpoint')
    p_serve.add_argument('--port', type=int, default=5555, help='Server port')

    args = parser.parse_args()
    if args.command == 'prepare':
        cmd_prepare(args)
    elif args.command == 'train':
        cmd_train(args)
    elif args.command == 'generate':
        cmd_generate(args)
    elif args.command == 'serve':
        cmd_serve(args)
    else:
        parser.print_help()


if __name__ == '__main__':
    main()
