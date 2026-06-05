param(
  [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'

function Test-TcpPort {
  param(
    [string]$HostName,
    [int]$Port,
    [int]$TimeoutMs = 1500
  )

  $client = [System.Net.Sockets.TcpClient]::new()
  try {
    $async = $client.BeginConnect($HostName, $Port, $null, $null)
    if (-not $async.AsyncWaitHandle.WaitOne($TimeoutMs)) {
      return $false
    }

    $client.EndConnect($async)
    return $true
  } catch {
    return $false
  } finally {
    $client.Close()
  }
}

function Assert-HealthyPort {
  param(
    [string]$Name,
    [string]$HostName,
    [int]$Port
  )

  if (-not (Test-TcpPort -HostName $HostName -Port $Port)) {
    throw "$Name is not listening on ${HostName}:${Port}"
  }

  [PSCustomObject]@{
    service = $Name
    status = 'listening'
    endpoint = "${HostName}:${Port}"
  }
}

function Get-TrackedProcess {
  param([string]$Name)

  $pidFile = Join-Path $Root ".tripza-services\$Name.pid"
  if (-not (Test-Path $pidFile)) {
    return [PSCustomObject]@{
      service = $Name
      processId = $null
      processName = $null
      status = 'not_tracked'
      detail = 'Start services with npm run services:local:up to create PID tracking files.'
    }
  }

  $trackedPid = [int](Get-Content $pidFile -Raw)
  $process = Get-Process -Id $trackedPid -ErrorAction SilentlyContinue
  if (-not $process) {
    throw "$Name process from $pidFile is not running"
  }

  [PSCustomObject]@{
    service = $Name
    processId = $process.Id
    processName = $process.ProcessName
    status = 'running'
  }
}

$api = Invoke-RestMethod -Uri 'http://127.0.0.1:5000/health/ready' -TimeoutSec 5
if ($api.status -ne 'ready') {
  throw "API is not ready: $($api | ConvertTo-Json -Depth 10)"
}

$matching = Invoke-RestMethod -Uri 'http://127.0.0.1:7001/health' -TimeoutSec 5
if ($matching.status -ne 'ok') {
  throw "Matching service is not healthy: $($matching | ConvertTo-Json -Depth 10)"
}

$fareBody = @{
  total_fare = 600
  total_seats = 3
  participants = 3
  strategy = 'seat_weighted'
} | ConvertTo-Json -Depth 5

$fare = Invoke-RestMethod `
  -Uri 'http://127.0.0.1:7001/fare-split' `
  -Method Post `
  -Body $fareBody `
  -ContentType 'application/json' `
  -TimeoutSec 5

if ($fare.per_participant_estimate -ne 200) {
  throw "Matching fare split returned an unexpected estimate: $($fare | ConvertTo-Json -Depth 10)"
}

$kafkaOut = Join-Path $env:TEMP "tripza-kafka-health-$PID.out"
$kafkaErr = Join-Path $env:TEMP "tripza-kafka-health-$PID.err"
$kafkaProcess = Start-Process `
  -FilePath 'npm.cmd' `
  -ArgumentList @('run', '--silent', 'kafka:health') `
  -WorkingDirectory (Join-Path $Root 'backend') `
  -RedirectStandardOutput $kafkaOut `
  -RedirectStandardError $kafkaErr `
  -WindowStyle Hidden `
  -PassThru
$kafkaProcess.WaitForExit()

$kafkaHealthOutput = @()
if (Test-Path $kafkaOut) {
  $kafkaHealthOutput += Get-Content $kafkaOut
}
if (Test-Path $kafkaErr) {
  $kafkaHealthOutput += Get-Content $kafkaErr
}
$kafkaHealthJson = @($kafkaHealthOutput) |
  Where-Object { $_ -and $_.ToString().Trim().StartsWith('{') } |
  Select-Object -Last 1

Remove-Item $kafkaOut, $kafkaErr -Force -ErrorAction SilentlyContinue

if (-not $kafkaHealthJson) {
  throw "Kafka health did not return JSON: $($kafkaHealthOutput -join [Environment]::NewLine)"
}

$kafkaHealth = $kafkaHealthJson | ConvertFrom-Json
if ($kafkaHealth.status -ne 'healthy') {
  throw "Kafka is not healthy: $kafkaHealthJson"
}

$ports = @(
  Assert-HealthyPort -Name 'api' -HostName '127.0.0.1' -Port 5000
  Assert-HealthyPort -Name 'matching-service' -HostName '127.0.0.1' -Port 7001
  Assert-HealthyPort -Name 'kafka' -HostName '127.0.0.1' -Port 9094
)

$processes = @(
  Get-TrackedProcess 'api'
  Get-TrackedProcess 'worker'
  Get-TrackedProcess 'matching-service'
)

[PSCustomObject]@{
  status = 'ready'
  mode = 'local-hybrid'
  api = $api
  matching = $matching
  fareSplit = $fare
  kafka = $kafkaHealth
  ports = $ports
  processes = $processes
} | ConvertTo-Json -Depth 12
