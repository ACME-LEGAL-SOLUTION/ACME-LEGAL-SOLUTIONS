[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ExpectedSha,
    [string]$AppRoot = (Split-Path -Parent $PSScriptRoot),
    [int]$Port = 3000,
    [string]$DeploymentRoot = 'C:\ProgramData\ACME-Legal-Solutions'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ($ExpectedSha -notmatch '^[0-9a-f]{40}$') { throw 'ExpectedSha must be a 40-character Git SHA.' }
$current = (git -C $AppRoot rev-parse HEAD).Trim()
if ($current -ne $ExpectedSha) { throw "Checkout SHA mismatch. Expected $ExpectedSha, found $current." }

$release = Join-Path (Join-Path $DeploymentRoot 'releases') $ExpectedSha
$currentRoot = Join-Path $DeploymentRoot 'current'
$server = Join-Path $currentRoot 'api\runtime\http-server.js'
if (-not (Test-Path $release)) { throw "Immutable release directory is missing: $release" }
if (-not (Test-Path $server)) { throw "Current production server is missing: $server" }

$task = Get-ScheduledTask -TaskName 'ACME-Legal-API' -ErrorAction SilentlyContinue
if (-not $task) { throw 'ACME-Legal-API scheduled task is missing.' }
$actions = @($task.Actions)
$exec = $actions | Where-Object { $_.CimClass.CimClassName -eq 'MSFT_TaskExecAction' } | Select-Object -First 1
if (-not $exec -or ([string]$exec.Arguments -notlike "*$server*")) {
    throw 'ACME-Legal-API is not bound to the stable current production server path.'
}

$health = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 10
$ready = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$Port/ready" -TimeoutSec 10
if ($health.StatusCode -ne 200) { throw "/health returned $($health.StatusCode)." }
if ($ready.StatusCode -ne 200) { throw "/ready returned $($ready.StatusCode)." }

Write-Output 'PRODUCTION_RELEASE_CHECK=PASS'
Write-Output "CHECKOUT_SHA=$current"
Write-Output "CURRENT_SERVER=$server"
Write-Output 'HEALTH=200'
Write-Output 'READY=200'
