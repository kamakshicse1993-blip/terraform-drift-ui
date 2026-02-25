Param(
    [int]$Port = 8080
)

$prefix = "http://localhost:$Port/"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
$listener.Start()
Write-Host "Serving $PWD at $prefix (Press Ctrl+C to stop)"

function Get-ContentType($path) {
    switch ([IO.Path]::GetExtension($path).ToLower()) {
        '.html' { 'text/html' }
        '.css'  { 'text/css' }
        '.js'   { 'application/javascript' }
        '.json' { 'application/json' }
        '.png'  { 'image/png' }
        '.jpg'  { 'image/jpeg' }
        '.jpeg' { 'image/jpeg' }
        '.svg'  { 'image/svg+xml' }
        default { 'application/octet-stream' }
    }
}

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $req = $context.Request
        $res = $context.Response

        $path = $req.Url.AbsolutePath
        if ($path -eq '/') { $path = '/index.html' }
        $localPath = Join-Path $PWD ($path.TrimStart('/'))

        if (Test-Path $localPath) {
            $bytes = [System.IO.File]::ReadAllBytes($localPath)
            $res.ContentType = Get-ContentType $localPath
            $res.ContentLength64 = $bytes.Length
            $res.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $res.StatusCode = 404
            $msg = "File not found: $path"
            $buffer = [System.Text.Encoding]::UTF8.GetBytes($msg)
            $res.ContentType = 'text/plain'
            $res.ContentLength64 = $buffer.Length
            $res.OutputStream.Write($buffer, 0, $buffer.Length)
        }
        $res.OutputStream.Close()
    }
} finally {
    $listener.Stop()
    $listener.Close()
}
