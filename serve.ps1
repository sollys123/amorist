param(
  [int]$Port = 4173,
  [string]$Root = ''
)

if ([string]::IsNullOrWhiteSpace($Root)) { $Root = $PSScriptRoot }

$ErrorActionPreference = 'Stop'
$rootPath = [System.IO.Path]::GetFullPath($Root)

$serverSource = @'
using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading.Tasks;

public static class AmoristStaticServer
{
    private static readonly Dictionary<string, string> MimeTypes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
    {
        { ".html", "text/html; charset=utf-8" },
        { ".css", "text/css; charset=utf-8" },
        { ".js", "text/javascript; charset=utf-8" },
        { ".mjs", "text/javascript; charset=utf-8" },
        { ".json", "application/json; charset=utf-8" },
        { ".png", "image/png" },
        { ".jpg", "image/jpeg" },
        { ".jpeg", "image/jpeg" },
        { ".gif", "image/gif" },
        { ".webp", "image/webp" },
        { ".svg", "image/svg+xml" },
        { ".ico", "image/x-icon" },
        { ".txt", "text/plain; charset=utf-8" },
        { ".md", "text/markdown; charset=utf-8" },
        { ".woff", "font/woff" },
        { ".woff2", "font/woff2" }
    };

    public static void Run(int port, string root)
    {
        string rootPath = Path.GetFullPath(root).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        var listener = new TcpListener(IPAddress.Loopback, port);
        listener.Start();

        while (true)
        {
            TcpClient client = listener.AcceptTcpClient();
            Task.Run(() => HandleClient(client, rootPath));
        }
    }

    private static void HandleClient(TcpClient client, string rootPath)
    {
        using (client)
        {
            client.ReceiveTimeout = 5000;
            client.SendTimeout = 5000;

            try
            {
                using (NetworkStream stream = client.GetStream())
                using (var reader = new StreamReader(stream, Encoding.ASCII, false, 8192, true))
                {
                    string requestLine = reader.ReadLine();
                    if (String.IsNullOrWhiteSpace(requestLine)) return;

                    string line;
                    do { line = reader.ReadLine(); } while (line != null && line.Length > 0);

                    string[] parts = requestLine.Split(' ');
                    if (parts.Length < 2)
                    {
                        WriteResponse(stream, 400, "Bad Request", Encoding.UTF8.GetBytes("Bad Request"), "text/plain; charset=utf-8", false);
                        return;
                    }

                    string method = parts[0].ToUpperInvariant();
                    if (method != "GET" && method != "HEAD")
                    {
                        WriteResponse(stream, 405, "Method Not Allowed", Encoding.UTF8.GetBytes("Method Not Allowed"), "text/plain; charset=utf-8", false);
                        return;
                    }

                    string requestPath = parts[1].Split('?')[0].Split('#')[0];
                    string relativePath = Uri.UnescapeDataString(requestPath).TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
                    if (String.IsNullOrWhiteSpace(relativePath)) relativePath = "index.html";

                    string candidate = Path.GetFullPath(Path.Combine(rootPath, relativePath));
                    string rootPrefix = rootPath + Path.DirectorySeparatorChar;
                    if (!candidate.Equals(rootPath, StringComparison.OrdinalIgnoreCase) &&
                        !candidate.StartsWith(rootPrefix, StringComparison.OrdinalIgnoreCase))
                    {
                        WriteResponse(stream, 403, "Forbidden", Encoding.UTF8.GetBytes("Forbidden"), "text/plain; charset=utf-8", method == "HEAD");
                        return;
                    }

                    if (Directory.Exists(candidate)) candidate = Path.Combine(candidate, "index.html");
                    if (!File.Exists(candidate))
                    {
                        WriteResponse(stream, 404, "Not Found", Encoding.UTF8.GetBytes("Not Found"), "text/plain; charset=utf-8", method == "HEAD");
                        return;
                    }

                    byte[] body = File.ReadAllBytes(candidate);
                    string extension = Path.GetExtension(candidate);
                    string contentType;
                    if (!MimeTypes.TryGetValue(extension, out contentType)) contentType = "application/octet-stream";
                    WriteResponse(stream, 200, "OK", body, contentType, method == "HEAD");
                }
            }
            catch
            {
                // A browser may cancel speculative connections. The next request remains unaffected.
            }
        }
    }

    private static void WriteResponse(NetworkStream stream, int statusCode, string statusText, byte[] body, string contentType, bool headOnly)
    {
        if (body == null) body = new byte[0];
        string header =
            "HTTP/1.1 " + statusCode + " " + statusText + "\r\n" +
            "Content-Type: " + contentType + "\r\n" +
            "Content-Length: " + body.Length + "\r\n" +
            "Cache-Control: no-store, no-cache, must-revalidate\r\n" +
            "Connection: close\r\n\r\n";
        byte[] headerBytes = Encoding.ASCII.GetBytes(header);
        stream.Write(headerBytes, 0, headerBytes.Length);
        if (!headOnly && body.Length > 0) stream.Write(body, 0, body.Length);
        stream.Flush();
    }
}
'@

Add-Type -TypeDefinition $serverSource -Language CSharp

Write-Host ''
Write-Host 'Amorist local server started.' -ForegroundColor Green
Write-Host "Editor:  http://localhost:$Port/editor.html"
Write-Host "Site:    http://localhost:$Port/index.html"
Write-Host 'Close this window to stop the server.' -ForegroundColor DarkGray
Write-Host ''

try {
  [AmoristStaticServer]::Run($Port, $rootPath)
} catch {
  Write-Host "Unable to start the Amorist local server: port $Port may already be in use." -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor DarkRed
  exit 1
}
