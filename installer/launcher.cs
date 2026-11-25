// ============================================================================
//   🄯 (c)카피레프트 Copyleft — Tran.IDE
//   a Bakk jaejin production
//   Licensed under the GNU Affero General Public License v3.0 (AGPL-3.0)
// ============================================================================

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Text;
using System.Windows.Forms;

static class Program
{
    static string FindOnPath(string fileName)
    {
        string pathEnv = Environment.GetEnvironmentVariable("PATH") ?? "";
        string[] parts = pathEnv.Split(new char[] { Path.PathSeparator }, StringSplitOptions.RemoveEmptyEntries);
        foreach (string rawDir in parts)
        {
            string cleanDir = rawDir.Trim().Trim('"');
            if (string.IsNullOrEmpty(cleanDir))
                continue;
            try
            {
                string cand = Path.Combine(cleanDir, fileName);
                if (File.Exists(cand))
                    return cand;
            }
            catch
            {
            }
        }
        return null;
    }

    static string ResolvePythonw(string baseDir)
    {
        string[] candidates = new string[]
        {
            Path.Combine(baseDir, "pythonw.exe"),
            Path.Combine(baseDir, "runtimes", "python", "pythonw.exe"),
            Path.Combine(baseDir, ".venv", "Scripts", "pythonw.exe")
        };
        foreach (string cand in candidates)
        {
            if (File.Exists(cand))
                return cand;
        }
        return FindOnPath("pythonw.exe");
    }

    static string QuoteArg(string arg)
    {
        if (string.IsNullOrEmpty(arg))
            return "\"\"";
        return "\"" + arg.Replace("\"", "\\\"") + "\"";
    }

    [STAThread]
    static int Main(string[] args)
    {
        string dir = AppDomain.CurrentDomain.BaseDirectory.TrimEnd(Path.DirectorySeparatorChar);
        string mainPy = Path.Combine(dir, "main.py");
        if (!File.Exists(mainPy))
        {
            MessageBox.Show(
                "Tran.IDE II main.py was not found in:\n" + dir,
                "Tran.IDE II",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error
            );
            return 1;
        }

        string pythonw = ResolvePythonw(dir);
        if (string.IsNullOrEmpty(pythonw))
        {
            MessageBox.Show(
                "Python runtime (pythonw.exe) could not be found.\n\n" +
                "- If running from source, double-click run_tran_ide.bat first to set up .venv.\n" +
                "- Or install Tran.IDE II using Setup.exe from GitHub Releases.",
                "Tran.IDE II",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error
            );
            return 1;
        }

        StringBuilder argBuilder = new StringBuilder();
        argBuilder.Append(QuoteArg(mainPy));
        if (args != null && args.Length > 0)
        {
            foreach (string a in args)
            {
                argBuilder.Append(' ');
                argBuilder.Append(QuoteArg(a));
            }
        }

        ProcessStartInfo psi = new ProcessStartInfo();
        psi.FileName = pythonw;
        psi.Arguments = argBuilder.ToString();
        psi.WorkingDirectory = dir;
        psi.UseShellExecute = false;
        try
        {
            Process.Start(psi);
            return 0;
        }
        catch (Exception ex)
        {
            MessageBox.Show(ex.Message, "Tran.IDE II", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return 1;
        }
    }
}

// ============================================================================
//   🄯 (c)카피레프트 Copyleft — Tran.IDE
//   a Bakk jaejin production
//   Licensed under the GNU Affero General Public License v3.0 (AGPL-3.0)
// ============================================================================
