param(
  [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'

$BackendDir = Join-Path $Root 'backend'
$MatchingDir = Join-Path $BackendDir 'services\matching-service'
$MatchingPython = Join-Path $MatchingDir '.venv\Scripts\python.exe'
$StateDir = Join-Path $Root '.tripza-services'

New-Item -ItemType Directory -Force -Path $StateDir | Out-Null

function Stop-TrackedProcess {
  param([string]$Name)

  $pidFile = Join-Path $StateDir "$Name.pid"
  if (Test-Path $pidFile) {
    $trackedPid = Get-Content $pidFile -Raw
    if ($trackedPid) {
      Stop-Process -Id ([int]$trackedPid) -Force -ErrorAction SilentlyContinue
    }
    Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
  }
}

function Save-ProcessId {
  param(
    [string]$Name,
    [System.Diagnostics.Process]$Process
  )

  Set-Content -Path (Join-Path $StateDir "$Name.pid") -Value $Process.Id
}

if (!(Test-Path $MatchingPython)) {
  Write-Host 'Creating matching-service Python environment'
  python -m venv (Join-Path $MatchingDir '.venv')
}

Write-Host 'Installing matching-service dependencies'
& $MatchingPython -m pip install -q -e $MatchingDir

Stop-TrackedProcess 'api'
Stop-TrackedProcess 'worker'
Stop-TrackedProcess 'matching-service'

Write-Host 'Starting matching-service on http://127.0.0.1:7001'
$matchingProcess = Start-Process `
  -FilePath $MatchingPython `
  -ArgumentList @('-m', 'uvicorn', 'app.main:app', '--host', '127.0.0.1', '--port', '7001') `
  -WorkingDirectory $MatchingDir `
  -RedirectStandardOutput (Join-Path $Root 'matching-service.out.log') `
  -RedirectStandardError (Join-Path $Root 'matching-service.err.log') `
  -WindowStyle Hidden `
  -PassThru
Save-ProcessId -Name 'matching-service' -Process $matchingProcess

$env:NODE_ENV = 'development'
$env:PORT = '5000'
$env:ALLOWED_ORIGINS = 'http://localhost:8081,http://localhost:5000,http://127.0.0.1:5000'
$env:ENABLE_BACKGROUND_TASKS = 'false'
$env:KAFKA_BROKERS = '127.0.0.1:9094'
$env:KAFKA_CLIENT_ID = 'tripza-api-local'
$env:EVENT_BUS_STRICT = 'false'
$env:MATCHING_SERVICE_URL = 'http://127.0.0.1:7001'
$env:MATCHING_SERVICE_REQUIRED = 'true'

Push-Location $BackendDir
try {
  Write-Host 'Provisioning Kafka topics'
  npm run kafka:topics
} finally {
  Pop-Location
}

Write-Host 'Starting API on http://127.0.0.1:5000'
$apiProcess = Start-Process `
  -FilePath 'npm.cmd' `
  -ArgumentList @('start') `
  -WorkingDirectory $BackendDir `
  -RedirectStandardOutput (Join-Path $Root 'api-service.out.log') `
  -RedirectStandardError (Join-Path $Root 'api-service.err.log') `
  -WindowStyle Hidden `
  -PassThru
Save-ProcessId -Name 'api' -Process $apiProcess

$env:KAFKA_CLIENT_ID = 'tripza-worker-local'
$env:MATCHING_SERVICE_REQUIRED = 'false'

Write-Host 'Starting background worker'
$workerProcess = Start-Process `
  -FilePath 'npm.cmd' `
  -ArgumentList @('run', 'worker') `
  -WorkingDirectory $BackendDir `
  -RedirectStandardOutput (Join-Path $Root 'worker-service.out.log') `
  -RedirectStandardError (Join-Path $Root 'worker-service.err.log') `
  -WindowStyle Hidden `
  -PassThru
Save-ProcessId -Name 'worker' -Process $workerProcess

Write-Host 'Waiting for integrated service readiness'
$deadline = (Get-Date).AddMinutes(2)
do {
  try {
    & (Join-Path $PSScriptRoot 'verify-services.ps1') -Root $Root
    exit 0
  } catch {
    Start-Sleep -Seconds 3
  }
} while ((Get-Date) -lt $deadline)

& (Join-Path $PSScriptRoot 'verify-services.ps1') -Root $Root
