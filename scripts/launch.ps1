$ErrorActionPreference = 'Stop'
$gameRoot = Split-Path -Parent $PSScriptRoot
$gameUrl = 'http://127.0.0.1:4173'
try {
    $gameHealth = Invoke-RestMethod -Uri "$gameUrl/health" -TimeoutSec 2
    if ($gameHealth.app -ne 'cabinet-of-wonders') { throw 'Port 4173 belongs to another application.' }
} catch {
    $gameListener = Get-NetTCPConnection -LocalPort 4173 -State Listen -ErrorAction SilentlyContinue
    if ($gameListener) {
        Add-Type -AssemblyName System.Windows.Forms
        [System.Windows.Forms.MessageBox]::Show('Port 4173 is used by another app. See README.md for a different port.', 'Cabinet of Wonders') | Out-Null
        exit 1
    }
    $gameNode = (Get-Command node.exe -ErrorAction Stop).Source
    Start-Process -FilePath $gameNode -ArgumentList @('"' + (Join-Path $gameRoot 'server.mjs') + '"') -WorkingDirectory $gameRoot -WindowStyle Hidden
    $gameReady = $false
    for ($gameAttempt = 0; $gameAttempt -lt 20; $gameAttempt++) {
        Start-Sleep -Milliseconds 250
        try {
            $gameHealth = Invoke-RestMethod -Uri "$gameUrl/health" -TimeoutSec 1
            if ($gameHealth.app -eq 'cabinet-of-wonders') { $gameReady = $true; break }
        } catch { }
    }
    if (-not $gameReady) { throw 'The game server did not start.' }
}
Start-Process $gameUrl
