param(
  [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'

$StateDir = Join-Path $Root '.tripza-services'

foreach ($name in @('api', 'worker', 'matching-service')) {
  $pidFile = Join-Path $StateDir "$name.pid"
  if (Test-Path $pidFile) {
    $trackedPid = Get-Content $pidFile -Raw
    if ($trackedPid) {
      Stop-Process -Id ([int]$trackedPid) -Force -ErrorAction SilentlyContinue
    }
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
  }
}

docker compose -f (Join-Path $Root 'docker-compose.yml') down
