using System.Text.Json;

namespace CelesteMapMonoGameInterop;

public sealed class SceneBundle
{
    private static readonly JsonSerializerOptions SerializerOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        WriteIndented = true,
    };

    public SceneBundle(string rootPath, bool watch)
    {
        RootPath = rootPath;
        Watch = watch;
    }

    public string RootPath { get; }

    public bool Watch { get; }

    public string ScenePath => Path.Combine(RootPath, "monogame-scene.json");

    public static SceneBundle FromArgs(string[] args)
    {
        string? bundleRoot = null;
        var watch = false;

        for (var index = 0; index < args.Length; index++)
        {
            var argument = args[index];
            if (string.Equals(argument, "--bundle", StringComparison.OrdinalIgnoreCase) && index + 1 < args.Length)
            {
                bundleRoot = args[++index];
                continue;
            }

            if (string.Equals(argument, "--watch", StringComparison.OrdinalIgnoreCase))
            {
                watch = true;
            }
        }

        if (string.IsNullOrWhiteSpace(bundleRoot))
        {
            bundleRoot = AppContext.BaseDirectory;
        }

        return new SceneBundle(Path.GetFullPath(bundleRoot), watch);
    }

    public CelesteMapScene LoadScene()
    {
        var json = File.ReadAllText(ScenePath);
        return JsonSerializer.Deserialize<CelesteMapScene>(json, SerializerOptions) ?? new CelesteMapScene();
    }

    public void SaveScene(CelesteMapScene scene)
    {
        Directory.CreateDirectory(RootPath);
        var json = JsonSerializer.Serialize(scene, SerializerOptions);
        File.WriteAllText(ScenePath, json);
    }
}