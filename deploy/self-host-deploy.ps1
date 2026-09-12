[CmdletBinding()]
param(
    [ValidateSet('ConfigureTask','Deploy','HealthCheck')]
    [string]$Action = 'HealthCheck',
    [string]$AppRoot = (Split-Path -Parent $PSScriptRoot),
    [string]$TaskName = 'ACME-Legal-API',
    [int]$Port = 3000,
    [string]$DeploymentRoot = 'C:\ProgramData\ACME-Legal-Solutions'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Assert-Command([string]$Name) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command '$Name' is not available."
    }
}

function Assert-AppRoot {
    if (-not (Test-Path (Join-Path $AppRoot 'package.json'))) {
        throw "AppRoot does not contain package.json: $AppRoot"
    }
    if (-not (Test-Path (Join-Path $AppRoot 'api\runtime\http-server.js'))) {
        throw "AppRoot does not contain api\runtime\http-server.js: $AppRoot"
    }
}

function Invoke-LocalHealth {
    $health = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 10
    if ($health.StatusCode -ne 200) { throw "/health returned HTTP $($health.StatusCode)." }
    $ready = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$Port/ready" -TimeoutSec 10
    if ($ready.StatusCode -ne 200) { throw "/ready returned HTTP $($ready.StatusCode)." }
    Write-Output "HEALTH=200"
    Write-Output "READY=200"
}

function Get-TaskServerPath($Task) {
    if (-not $Task) { return $null }
    $actions = @($Task.Actions)
    if ($actions.Count -eq 0) { return $null }
    $execAction = $actions | Where-Object { $_.CimClass.CimClassName -eq 'MSFT_TaskExecAction' } | Select-Object -First 1
    if (-not $execAction) { return $null }
    return [string]$execAction.Arguments
}

Assert-Command 'node'
Assert-Command 'npm'
Assert-AppRoot

$gitSha = (git -C $AppRoot rev-parse HEAD).Trim()
if ($gitSha -notmatch '^[0-9a-f]{40}$') { throw 'Unable to resolve immutable Git SHA.' }

$CurrentRoot = Join-Path $DeploymentRoot 'current'
$ReleaseRoot = Join-Path (Join-Path $DeploymentRoot 'releases') $gitSha
$ServerRelativePath = 'api\runtime\http-server.js'
$CurrentServer = Join-Path $CurrentRoot $ServerRelativePath

switch ($Action) {
    'HealthCheck' {
        Invoke-LocalHealth
        Write-Output "GIT_SHA=$gitSha"
        break
    }

    'ConfigureTask' {
        if (-not (Test-Path $CurrentServer)) {
            throw "Stable production release is not installed: $CurrentServer"
        }
        $node = (Get-Command node).Source
        $taskAction = New-ScheduledTaskAction -Execute $node -Argument "`"$CurrentServer`"" -WorkingDirectory $CurrentRoot
        $trigger = New-ScheduledTaskTrigger -AtStartup
        $settings = New-ScheduledTaskSettingsSet -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable
        $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
        Register-ScheduledTask -TaskName $TaskName -Action $taskAction -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
        Write-Output "TASK_CONFIGURED=$TaskName"
        Write-Output "TASK_SERVER=$CurrentServer"
        Write-Output "GIT_SHA=$gitSha"
        break
    }

    'Deploy' {
        Assert-Command 'git'
        $status = git -C $AppRoot status --porcelain
        if ($status) {
            throw 'Deployment stopped: working tree is not clean. Commit or remove local changes before deployment.'
        }

        $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
        if (-not $task) {
            throw "Production task '$TaskName' is not configured. Run deploy\configure-production-host.ps1 once from an elevated Administrator PowerShell before deploying."
        }

        $taskArguments = Get-TaskServerPath $task
        if ([string]::IsNullOrWhiteSpace($taskArguments) -or $taskArguments -notlike "*$CurrentServer*") {
            throw "Production task '$TaskName' is not configured for the stable release path '$CurrentServer'. Re-run deploy\configure-production-host.ps1 as Administrator."
        }

        Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue

        Push-Location $AppRoot
        try {
            if (Test-Path (Join-Path $AppRoot 'package-lock.json')) {
                & npm ci --omit=dev
                if ($LASTEXITCODE -ne 0) { throw "npm ci failed with exit code $LASTEXITCODE." }
            }
            else {
                Write-Warning 'package-lock.json is absent; using npm install --omit=dev --no-package-lock for this lockfile-free repository.'
                & npm install --omit=dev --no-package-lock
                if ($LASTEXITCODE -ne 0) { throw "npm install failed with exit code $LASTEXITCODE." }
            }
            & npm test
            if ($LASTEXITCODE -ne 0) { throw "npm test failed with exit code $LASTEXITCODE." }
        }
        finally {
            Pop-Location
        }

        New-Item -ItemType Directory -Force -Path $DeploymentRoot, (Join-Path $DeploymentRoot 'releases') | Out-Null
        if (Test-Path $ReleaseRoot) { Remove-Item -LiteralPath $ReleaseRoot -Recurse -Force }
        New-Item -ItemType Directory -Force -Path $ReleaseRoot | Out-Null

        & robocopy $AppRoot $ReleaseRoot /MIR /XD '.git' '.github' | Out-Host
        if ($LASTEXITCODE -gt 7) { throw "robocopy release staging failed with exit code $LASTEXITCODE." }

        $stagedServer = Join-Path $ReleaseRoot $ServerRelativePath
        if (-not (Test-Path $stagedServer)) { throw "Staged release is incomplete: $stagedServer" }

        if (Test-Path $CurrentRoot) {
            Remove-Item -LiteralPath $CurrentRoot -Recurse -Force
        }
        New-Item -ItemType Directory -Force -Path $CurrentRoot | Out-Null
        & robocopy $ReleaseRoot $CurrentRoot /MIR | Out-Host
        if ($LASTEXITCODE -gt 7) { throw "robocopy current-release promotion failed with exit code $LASTEXITCODE." }

        if (-not (Test-Path $CurrentServer)) { throw "Promoted release is incomplete: $CurrentServer" }

        Start-ScheduledTask -TaskName $TaskName
        Start-Sleep -Seconds 3
        Invoke-LocalHealth
        Write-Output "DEPLOYED_GIT_SHA=$gitSha"
        Write-Output "DEPLOYED_PATH=$CurrentRoot"
        Write-Output "DEPLOYED_AT_UTC=$([DateTime]::UtcNow.ToString('o'))"
        break
    }
}
