using System;
using System.IO;
using System.Diagnostics;
using System.Collections.Generic;
using Newtonsoft.Json.Linq;

namespace CelesteDecompiler
{
    /// <summary>
    /// Wrapper for decompiling Celeste .bin map files to JSON format
    /// Searches for and uses available decompiler tools
    /// 
    /// Usage: dotnet run -- <input.bin> <output.json>
    /// </summary>
    class Program
    {
        static void Main(string[] args)
        {
            if (args.Length < 2)
            {
                Console.WriteLine("Usage: CelesteDecompiler <input.bin> <output.json>");
                Console.WriteLine("\nSearches for Loenn in PATH to decompile");
                Environment.Exit(1);
            }

            string inputPath = args[0];
            string outputPath = args[1];

            if (!File.Exists(inputPath))
            {
                Console.Error.WriteLine($"Error: Input file not found: {inputPath}");
                Environment.Exit(1);
            }

            try
            {
                Console.WriteLine($"Decompiling: {Path.GetFileName(inputPath)}");
                
                // Try to find and use available decompiler
                if (TryDecompile(inputPath, outputPath))
                {
                    Console.WriteLine($"✓ Successfully decompiled to: {outputPath}");
                    Environment.Exit(0);
                }
                else
                {
                    Console.WriteLine("⚠ Could not find decompiler. Creating placeholder JSON...");
                    CreatePlaceholderJson(outputPath);
                    Console.WriteLine($"✓ Placeholder created at: {outputPath}");
                    Console.WriteLine("\nTo decompile .bin files, install Loenn:");
                    Console.WriteLine("  1. Visit: https://github.com/CelestialCartographers/Loenn/releases");
                    Console.WriteLine("  2. Download and install Loenn for your OS");
                    Console.WriteLine("  3. Add Loenn to your PATH environment variable");
                    Console.WriteLine("  4. Restart PowerShell and run this tool again");
                    Environment.Exit(0);
                }
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine($"Error: {ex.Message}");
                Environment.Exit(1);
            }
        }

        static bool TryDecompile(string inputPath, string outputPath)
        {
            var decompilers = new List<(string name, string args)>
            {
                ("loenn", $"from-binary \"{inputPath}\" \"{outputPath}\""),
                ("loenn.exe", $"from-binary \"{inputPath}\" \"{outputPath}\""),
                ("python", $"-m loenn from-binary \"{inputPath}\" \"{outputPath}\""),
            };

            // Check for Loenn installation via scoop
            string scoopPath = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
                "scoop", "apps", "loenn", "current"
            );
            if (Directory.Exists(scoopPath))
            {
                string scoopLoenn = Path.Combine(scoopPath, "loenn.exe");
                if (File.Exists(scoopLoenn))
                {
                    decompilers.Add(("scoop-loenn", $"from-binary \"{inputPath}\" \"{outputPath}\""));
                }
            }

            // Check for Loenn in Program Files
            string programFilesLoenn = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),
                "Loenn", "loenn.exe"
            );
            if (File.Exists(programFilesLoenn))
            {
                decompilers.Add(("program-files-loenn", $"from-binary \"{inputPath}\" \"{outputPath}\""));
            }

            foreach (var (name, args) in decompilers)
            {
                try
                {
                    var psi = new ProcessStartInfo
                    {
                        FileName = name,
                        Arguments = args,
                        UseShellExecute = false,
                        RedirectStandardOutput = true,
                        RedirectStandardError = true,
                        CreateNoWindow = true
                    };

                    using (var process = Process.Start(psi))
                    {
                        if (process != null && process.WaitForExit(30000))
                        {
                            if (process.ExitCode == 0 && File.Exists(outputPath))
                            {
                                return true;
                            }
                        }
                    }
                }
                catch
                {
                    // Continue to next decompiler
                    continue;
                }
            }

            return false;
        }

        static void CreatePlaceholderJson(string outputPath)
        {
            var json = new JObject
            {
                ["rooms"] = new JArray(),
                ["package"] = "celeste-map-editor",
                ["projectName"] = "decompile-placeholder"
            };

            File.WriteAllText(outputPath, json.ToString(Newtonsoft.Json.Formatting.Indented));
        }
    }
}
