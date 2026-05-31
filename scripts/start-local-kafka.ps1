param(
  [string]$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Stop'

$InfraDir = Join-Path $Root '.local-infra'
$StateDir = Join-Path $Root '.tripza-services'
$KafkaVersion = '3.7.2'
$KafkaDir = Join-Path $InfraDir "kafka_2.13-$KafkaVersion"
$KafkaArchive = Join-Path $InfraDir 'kafka.tgz'
$KafkaUrl = "https://archive.apache.org/dist/kafka/$KafkaVersion/kafka_2.13-$KafkaVersion.tgz"
$KafkaDataDir = Join-Path $InfraDir 'kafka-data'
$KafkaConfig = Join-Path $InfraDir 'kafka-local.properties'
$KafkaPid = Join-Path $StateDir 'kafka.pid'

New-Item -ItemType Directory -Force -Path $InfraDir | Out-Null
New-Item -ItemType Directory -Force -Path $StateDir | Out-Null

if (Test-Path $KafkaPid) {
  $trackedPid = Get-Content $KafkaPid -Raw
  if ($trackedPid) {
    Stop-Process -Id ([int]$trackedPid) -Force -ErrorAction SilentlyContinue
  }
  Remove-Item $KafkaPid -Force -ErrorAction SilentlyContinue
}

if (!(Test-Path $KafkaDir)) {
  Write-Host "Downloading Kafka $KafkaVersion"
  curl.exe -L --fail --continue-at - --output $KafkaArchive $KafkaUrl
  tar -xzf $KafkaArchive -C $InfraDir
}

$template = Get-Content (Join-Path $KafkaDir 'config\kraft\server.properties')
$lines = foreach ($line in $template) {
  switch -Regex ($line) {
    '^node\.id=' { 'node.id=1'; continue }
    '^controller\.quorum\.voters=' { 'controller.quorum.voters=1@localhost:9093'; continue }
    '^listeners=' { 'listeners=PLAINTEXT://127.0.0.1:9094,CONTROLLER://127.0.0.1:9093'; continue }
    '^advertised\.listeners=' { 'advertised.listeners=PLAINTEXT://localhost:9094'; continue }
    '^log\.dirs=' { "log.dirs=$($KafkaDataDir -replace '\\', '/')"; continue }
    '^auto\.create\.topics\.enable=' { 'auto.create.topics.enable=true'; continue }
    default { $line }
  }
}

if (-not ($lines -match '^auto\.create\.topics\.enable=')) {
  $lines += 'auto.create.topics.enable=true'
}

Set-Content -Path $KafkaConfig -Value $lines

$metaFile = Join-Path $KafkaDataDir 'meta.properties'
if (!(Test-Path $metaFile)) {
  New-Item -ItemType Directory -Force -Path $KafkaDataDir | Out-Null
  Push-Location $KafkaDir
  try {
    $clusterId = java -cp 'libs/*' kafka.tools.StorageTool random-uuid
    $clusterId = ($clusterId | Select-Object -First 1).Trim()
    java -cp 'libs/*' kafka.tools.StorageTool format -t $clusterId -c $KafkaConfig
  } finally {
    Pop-Location
  }
}

Write-Host 'Starting local Kafka on localhost:9094'
$process = Start-Process `
  -FilePath 'java' `
  -ArgumentList @('-cp', 'libs/*', 'kafka.Kafka', $KafkaConfig) `
  -WorkingDirectory $KafkaDir `
  -RedirectStandardOutput (Join-Path $Root 'kafka-service.out.log') `
  -RedirectStandardError (Join-Path $Root 'kafka-service.err.log') `
  -WindowStyle Hidden `
  -PassThru

Set-Content -Path $KafkaPid -Value $process.Id

$env:KAFKA_BROKERS = '127.0.0.1:9094'
$env:KAFKA_CLIENT_ID = 'tripza-local-kafka'

$deadline = (Get-Date).AddMinutes(2)
do {
  Push-Location (Join-Path $Root 'backend')
  try {
    npm run --silent kafka:health
    exit 0
  } catch {
    Start-Sleep -Seconds 3
  } finally {
    Pop-Location
  }
} while ((Get-Date) -lt $deadline)

throw 'Timed out waiting for local Kafka readiness'
