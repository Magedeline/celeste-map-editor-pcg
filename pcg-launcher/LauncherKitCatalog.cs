using System;
using System.Collections.Generic;
using System.Drawing;
using System.Linq;

namespace CelestePcgLauncher;

internal sealed record LauncherKitDescriptor(
    string Id,
    string Title,
    string Description,
    string NamePrefix,
    Color AccentColor,
    Color SurfaceColor,
    Color GlowColor,
    Color BackgroundColor);

internal static class LauncherKitCatalog
{
    private static readonly LauncherKitDescriptor[] Kits =
    [
        new("house", "House Kit", "Warm wood interiors with loft-like platforms and readable structural rhythm.", "house", Color.FromArgb(230, 176, 88), Color.FromArgb(82, 52, 31), Color.FromArgb(173, 121, 62), Color.FromArgb(24, 18, 13)),
        new("resort", "Resort Kit", "Dense indoor rooms with more industrial shell pieces and hotel-like spacing.", "resort", Color.FromArgb(170, 197, 232), Color.FromArgb(40, 47, 64), Color.FromArgb(111, 143, 188), Color.FromArgb(15, 19, 28)),
        new("cliffside", "Cliffside Kit", "Rough shell blocks and exposed supports for outdoor-feeling traversal rooms.", "cliff", Color.FromArgb(94, 203, 213), Color.FromArgb(25, 58, 65), Color.FromArgb(51, 148, 157), Color.FromArgb(8, 24, 27)),
        new("kirby", "Kirby Kit", "Pastel toybox rooms with buoyant platforms and softer block contrast.", "kirby", Color.FromArgb(255, 132, 189), Color.FromArgb(75, 36, 76), Color.FromArgb(193, 95, 168), Color.FromArgb(29, 13, 34)),
        new("mario", "Mario Kit", "Bright, chunky platforming rooms with bricky structure and classic arcade punch.", "mario", Color.FromArgb(252, 92, 61), Color.FromArgb(89, 32, 20), Color.FromArgb(213, 150, 48), Color.FromArgb(31, 11, 7)),
        new("metroidvania", "Metroidvania Kit", "Moody fortress rooms that read heavier and more exploratory.", "metro", Color.FromArgb(95, 222, 163), Color.FromArgb(18, 42, 39), Color.FromArgb(83, 150, 135), Color.FromArgb(7, 17, 16)),
        new("labybirth", "Labybirth Kit", "Maze-minded stonework with older masonry and dustier support patterns.", "laby", Color.FromArgb(212, 165, 103), Color.FromArgb(69, 46, 29), Color.FromArgb(150, 109, 63), Color.FromArgb(23, 16, 11)),
        new("pizzatower", "Pizza Tower Kit", "High-energy rooms with loud contrast and exaggerated fast-movement read.", "pizza", Color.FromArgb(255, 214, 59), Color.FromArgb(96, 38, 17), Color.FromArgb(245, 134, 52), Color.FromArgb(33, 12, 7)),
        new("arcade", "Arcade Kit", "Neon-coded rooms with synthetic contrast and stronger color separation.", "arcade", Color.FromArgb(90, 239, 255), Color.FromArgb(20, 28, 62), Color.FromArgb(167, 89, 255), Color.FromArgb(5, 8, 30)),
    ];

    private static readonly Dictionary<string, LauncherKitDescriptor> ById = Kits.ToDictionary(kit => kit.Id, StringComparer.OrdinalIgnoreCase);

    public static IReadOnlyList<LauncherKitDescriptor> All => Kits;

    public static string[] GetIds()
    {
        return Kits.Select(kit => kit.Id).ToArray();
    }

    public static LauncherKitDescriptor Get(string? id)
    {
        if (!string.IsNullOrWhiteSpace(id) && ById.TryGetValue(id, out var descriptor))
        {
            return descriptor;
        }

        return Kits[0];
    }

    public static LauncherKitDescriptor InferFromMap(CelesteMapData map, string? fallbackId)
    {
        foreach (var room in map.Rooms)
        {
            var separatorIndex = room.Name.IndexOf('_');
            var prefix = separatorIndex > 0 ? room.Name[..separatorIndex] : room.Name;
            var descriptor = Kits.FirstOrDefault(kit => prefix.StartsWith(kit.NamePrefix, StringComparison.OrdinalIgnoreCase));
            if (descriptor is not null)
            {
                return descriptor;
            }
        }

        return Get(fallbackId);
    }
}
