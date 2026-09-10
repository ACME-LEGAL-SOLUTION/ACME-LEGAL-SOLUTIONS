[CmdletBinding()]
param(
    [ValidateSet('ConfigureTask','Deploy','HealthCheck')]
    [string]$Action = 'HealthCheck',
    [string]$AppRoot = (Split-Path -Parent $PSScriptRoot),
    [string]$TaskName = 'ACME-Legal-API',
    [int]$Port = 3000
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

Assert-Command 'node'
Assert-Command 'npm'
Assert-AppRoot

$gitSha = (git -C $AppRoot rev-parse HEAD).Trim()
if ($gitSha -notmatch '^[0-9a-f]{40}$') { throw 'Unable to resolve immutable Git SHA.' }

switch ($Action) {
    'HealthCheck' {
        Invoke-LocalHealth
        Write-Output "GIT_SHA=$gitSha"
        break
    }

    'ConfigureTask' {
        $node = (Get-Command node).Source
        $server = Join-Path $AppRoot 'api\runtime\http-server.js'
        $working = $AppRoot
        $action = New-ScheduledTaskAction -Execute $node -Argument "`"$server`"" -WorkingDirectory $working
        $trigger = New-ScheduledTaskTrigger -AtStartup
        $settings = New-ScheduledTaskSettingsSet -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable
        $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
        Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
        Write-Output "TASK_CONFIGURED=$TaskName"
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
        if ($task) {
            Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
        }

        Push-Location $AppRoot
        try {
            & npm ci --omit=dev
            if ($LASTEXITCODE -ne 0) { throw "npm ci failed with exit code $LASTEXITCODE." }
            & npm test
            if ($LASTEXITCODE -ne 0) { throw "npm test failed with exit code $LASTEXITCODE." }
        }
        finally {
            Pop-Location
        }

        if (-not $task) {
            & $PSCommandPath -Action ConfigureTask -AppRoot $AppRoot -TaskName $TaskName -Port $Port
        }
        Start-ScheduledTask -TaskName $TaskName
        Start-Sleep -Seconds 3
        Invoke-LocalHealth
        Write-Output "DEPLOYED_GIT_SHA=$gitSha"
        Write-Output "DEPLOYED_AT_UTC=$([DateTime]::UtcNow.ToString('o'))"
        break
    }
}
