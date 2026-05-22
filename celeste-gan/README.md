# CelesteGAN — Multi-Scale GAN for Celeste Level Generation

A SinGAN-inspired pipeline that learns spatial tile distributions from
existing Celeste levels and generates new room layouts from noise at
multiple progressive resolutions.

## How It Works

```text
Noise 0 (small)  ──▶ Generator 0 ──▶ Output 0 ──▶ Interpolate ──┐
                                                                  │
Noise 1 (medium) ──▶ Generator 1 ◀── upscaled 0 ──▶ Output 1 ──▶ Interpolate ──┐
                                                                                 │
Noise 2 (target) ──▶ Generator 2 ◀── upscaled 1 ──▶ Final Output ──▶ Tile Grid
```

1. **Three scales** with progressive resolution (e.g. 13×20 → 24×38 → 33×51)
2. Each scale has its own Generator + Discriminator pair
3. Generators refine upscaled output from the previous scale plus new noise
4. Training uses WGAN-GP loss + reconstruction loss per scale
5. Output RGB images are quantized back to the nearest tile character

## Quick Start

### 1. Prepare Training Data

Extract tile grids from level JSON files into image/numpy format:

```bash
cd celeste-gan
python celeste_gan.py prepare --input ../test-export --output ./data
```

This scans all JSON files, extracts rooms with non-empty tile data,
and saves them as PNG images + `.npy` arrays.

### 2. Train the Model

```bash
python celeste_gan.py train --data ./data --epochs 2000 --scales 3
```

Options:

| Flag | Default | Description |
|------|---------|-------------|
| `--epochs` | 2000 | Training epochs per scale |
| `--scales` | 3 | Number of resolution scales |
| `--nf` | 64 | Base filter count |
| `--lr` | 5e-4 | Learning rate |
| `--lambda-rec` | 10.0 | Reconstruction loss weight |
| `--log-every` | 10 | Print training metrics every N epochs |
| `--checkpoint-dir` | ./checkpoints | Where to save the model |

Checkpoint is saved to `checkpoints/celeste_gan.pt`.

### 3. Generate a Room

```bash
python celeste_gan.py generate \
    --model ./checkpoints/celeste_gan.pt \
    --width 40 --height 23 \
    --kit house \
    --output room.json \
    --preview room.png
```

### 4. Serve for Electron App

Start the HTTP server so the editor can call GAN generation:

```bash
python celeste_gan.py serve --model ./checkpoints/celeste_gan.pt --port 5555
```

The server exposes:

- `POST /generate` — Generate tiles (body: `{width, height, kit, temperature}`)
- `GET /health` — Check if model is loaded

## Integration Points

### Electron App

The editor has a **GAN Fill** button in the toolbar and context menu.
When clicked, it sends a request to `127.0.0.1:5555/generate` via the
main process IPC bridge and replaces the selected room's foreground tiles.

Flow: `UI Button → renderer.js → preload IPC → main.js → HTTP → GAN server`

### MCP Server

Two new MCP tools are available when PyTorch is installed:

- **`generate_gan_room`** — Create a new room filled with GAN tiles
- **`gan_fill_room`** — Fill an existing room from the last generated map

These load the model from `celeste-gan/checkpoints/celeste_gan.pt` automatically.

## Architecture

| Component | Details |
|-----------|---------|
| Generator | 5-layer ConvNet with BatchNorm + LeakyReLU, Tanh output |
| Discriminator | 4-layer PatchGAN with gradient penalty (WGAN-GP) |
| Scales | 3 progressive resolutions (configurable) |
| Scale factor | 0.75× between adjacent scales |
| Tile encoding | 16 tile types → RGB via palette → quantize back |
| Kit remapping | Abstract categories mapped to kit-specific tile chars |

## File Structure

```text
celeste-gan/
  celeste_gan.py        # Model, training, inference, HTTP server, CLI
  requirements.txt      # torch, torchvision, numpy, Pillow
  data/                 # Prepared training data (after prepare step)
    fg/                 # Foreground tile PNGs + .npy
    bg/                 # Background tile PNGs + .npy
  checkpoints/          # Trained model (after training)
    celeste_gan.pt
```

## Requirements

```bash
pip install torch torchvision numpy Pillow
```

GPU acceleration (CUDA) is used automatically when available but not required.
