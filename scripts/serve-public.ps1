param([switch]$NoPublish)
$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$stateDir = Join-Path $projectRoot 'local-data/public-server'
$pythonPath = Join-Path $projectRoot '.venv/Scripts/python.exe'
$cloudflaredPath = (Get-Command cloudflared -ErrorAction Stop).Source
New-Item -ItemType Directory -Path $stateDir -Force | Out-Null
Push-Location $projectRoot
try {
    $statePath = Join-Path $stateDir 'state.json'
    if (Test-Path -LiteralPath $statePath) {
        $previous = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
        $oldTunnel = Get-CimInstance Win32_Process -Filter "ProcessId=$($previous.tunnelPid)"
        if ($oldTunnel -and $oldTunnel.ExecutablePath -eq $cloudflaredPath -and $oldTunnel.CommandLine.Contains($stateDir)) {
            Stop-Process -Id $oldTunnel.ProcessId
        }
    }
    @'
from pathlib import Path
import secrets
from dotenv import dotenv_values, set_key
p=Path('.env')
token=dotenv_values(p).get('SERVER_ACCESS_TOKEN') or secrets.token_urlsafe(24)
set_key(p,'SERVER_ACCESS_TOKEN',token)
set_key(p,'PUBLIC_ORIGIN','https://codingdarin.github.io')
Path('local-data/public-server/access.txt').write_text(token+'\n',encoding='utf-8')
'@ | & $pythonPath -X utf8 -
    if ($LASTEXITCODE -ne 0) { throw 'Could not prepare server settings' }
    $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
    $tunnelLog = Join-Path $stateDir "tunnel-$stamp.log"
    $tunnel = Start-Process -FilePath $cloudflaredPath -ArgumentList @('tunnel','--no-autoupdate','--url','http://127.0.0.1:4311','--logfile',('"'+$tunnelLog+'"')) -WindowStyle Hidden -PassThru
    $apiOrigin = $null
    for ($attempt=0; $attempt -lt 120; $attempt++) {
        if (Test-Path -LiteralPath $tunnelLog) {
            $match = [regex]::Match((Get-Content -LiteralPath $tunnelLog -Raw),'https://[a-z0-9-]+\.trycloudflare\.com')
            if ($match.Success) { $apiOrigin=$match.Value; break }
        }
        if ($tunnel.HasExited) { throw "Tunnel exited; inspect $tunnelLog" }
        Start-Sleep -Milliseconds 500
    }
    if (-not $apiOrigin) { Stop-Process -Id $tunnel.Id; throw "Tunnel URL unavailable; inspect $tunnelLog" }
    & $pythonPath -c "from dotenv import set_key; import sys; set_key('.env','PUBLIC_API_ORIGIN',sys.argv[1])" $apiOrigin
    if ($LASTEXITCODE -ne 0) { throw 'Could not save the API origin' }
    $listeners = Get-NetTCPConnection -LocalPort 4311 -State Listen -ErrorAction SilentlyContinue
    foreach ($listener in $listeners) {
        $existing = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
        if (-not $existing.ExecutablePath.StartsWith($projectRoot+'\',[StringComparison]::OrdinalIgnoreCase) -or $existing.CommandLine -notmatch '-m\s+backend(?:\s|$)') {
            throw 'Port 4311 belongs to another program; it was not stopped'
        }
        Stop-Process -Id $existing.ProcessId
    }
    $server = Start-Process -FilePath $pythonPath -ArgumentList '-m','backend' -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $stateDir "server-$stamp.stdout.log") -RedirectStandardError (Join-Path $stateDir "server-$stamp.stderr.log") -PassThru
    @{apiOrigin=$apiOrigin;serverPid=$server.Id;tunnelPid=$tunnel.Id} | ConvertTo-Json | Set-Content -LiteralPath $statePath -Encoding utf8
    $healthy=$false
    for ($attempt=0; $attempt -lt 30; $attempt++) {
        try { $health=Invoke-RestMethod -Uri 'http://127.0.0.1:4311/health'; if ($health.ok) { $healthy=$true;break } } catch {}
        Start-Sleep -Milliseconds 500
    }
    if (-not $healthy) { throw 'Backend did not become ready; inspect local-data/public-server logs' }
    Write-Output "API: $apiOrigin"
    Write-Output 'Access password: local-data/public-server/access.txt (not published)'
    if (-not $NoPublish) {
        & $pythonPath scripts/publish-pages.py --api-origin $apiOrigin
        if ($LASTEXITCODE -ne 0) { throw 'Pages publication failed; the server remains running' }
    }
} finally {
    Pop-Location
}
