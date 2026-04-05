#!/usr/bin/env python3
"""
Celeste .bin to JSON decompiler wrapper
Uses Loenn to convert Celeste map files

Usage:
    python decompile-bin.py <input.bin> <output.json>
"""

import sys
import json
import subprocess
import os
from pathlib import Path

def find_loenn():
    """Search for Loenn installation"""
    candidates = [
        "loenn",
        "loenn.exe",
        "python -m loenn",
        str(Path.home() / "AppData/Local/Programs/Loenn/loenn.exe"),
        str(Path.home() / "scoop/apps/loenn/current/loenn.exe"),
        "/usr/local/bin/loenn",
        "/usr/bin/loenn",
    ]
    
    for candidate in candidates:
        try:
            result = subprocess.run(
                candidate.split() if ' ' in candidate else [candidate, "--version"],
                capture_output=True,
                timeout=2
            )
            if result.returncode == 0:
                return candidate
        except:
            pass
    
    return None

def decompile_with_loenn(bin_path, json_path):
    """Use Loenn to decompile .bin to .json"""
    loenn = find_loenn()
    if not loenn:
        return False, "Loenn not found"
    
    try:
        # Loenn command: loenn from-binary <input.bin> <output.json>
        cmd = loenn.split() if ' ' in loenn else [loenn]
        cmd.extend(["from-binary", bin_path, json_path])
        
        result = subprocess.run(cmd, capture_output=True, timeout=30, text=True)
        
        if result.returncode == 0 and os.path.exists(json_path):
            return True, f"Successfully decompiled via Loenn"
        else:
            return False, f"Loenn error: {result.stderr or result.stdout}"
    except subprocess.TimeoutExpired:
        return False, "Decompilation timed out"
    except Exception as e:
        return False, str(e)

def decompile_with_loenn_python(bin_path, json_path):
    """Use Loenn Python library to decompile"""
    try:
        # Try importing Loenn Python module
        from loenn import decoding
        
        # Load binary map
        map_data = decoding.read_map(bin_path)
        
        # Save as JSON
        with open(json_path, 'w') as f:
            json.dump(map_data, f, indent=2)
        
        return True, "Successfully decompiled via Loenn Python library"
    except ImportError:
        return False, "Loenn Python library not found"
    except Exception as e:
        return False, f"Error: {str(e)}"

def create_placeholder_json(json_path):
    """Create placeholder JSON if decompilation fails"""
    data = {
        "rooms": [],
        "package": "celeste-map-editor",
        "projectName": "decompile-placeholder"
    }
    
    with open(json_path, 'w') as f:
        json.dump(data, f, indent=2)
    
    return True

def main():
    if len(sys.argv) < 3:
        print("Usage: python decompile-bin.py <input.bin> <output.json>")
        sys.exit(1)
    
    bin_path = sys.argv[1]
    json_path = sys.argv[2]
    
    # Verify input exists
    if not os.path.exists(bin_path):
        print(f"Error: Input file not found: {bin_path}", file=sys.stderr)
        sys.exit(1)
    
    # Try decompilation methods
    print(f"Attempting to decompile: {os.path.basename(bin_path)}")
    
    # Try CLI first
    success, message = decompile_with_loenn(bin_path, json_path)
    if success:
        print(f"✓ {message}")
        sys.exit(0)
    
    # Try Python library
    success, message = decompile_with_loenn_python(bin_path, json_path)
    if success:
        print(f"✓ {message}")
        sys.exit(0)
    
    # Fallback
    print(f"⚠ {message}")
    print(f"Creating placeholder JSON...")
    
    if create_placeholder_json(json_path):
        print(f"✓ Placeholder created at: {json_path}")
        print("\nTo get actual map data, install Loenn:")
        print("  1. Visit: https://github.com/CelestialCartographers/Loenn")
        print("  2. Follow installation instructions")
        print("  3. Run this script again")
        sys.exit(0)
    else:
        print("✗ Failed to create placeholder")
        sys.exit(1)

if __name__ == "__main__":
    main()

