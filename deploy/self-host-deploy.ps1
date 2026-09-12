param(
    [ValidateSet('ConfigureTask','Deploy','HealthCheck')]
    [string]$Action = 'HealthCheck',
    [string]$AppRoot = (Split-Path -Parent $PSScriptRoot),
    [string]$TaskName = 'ACME-Legal-API',
    [int]$Port = 3000
)

$ErrorActionPreference = 'Stop'

function Assert-Command([string]$Name) {
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        throw "Required command '$Name' was not found on PATH."
    }
}

function Invoke-LocalHealth {
    foreach ($path in @('/health','/ready')) {
        $uri = "http://127.0.0.1:$Port$path"
        $response = Invoke-WebRequest -Uri $uri -UseBasicParsing -TimeoutSec 15
        if ($response.StatusCode -ne 200) {
            throw "Health check failed for $path with HTTP $($response.StatusCode)."
        }
        Write-Output "$path HTTP $($response.StatusCode)"
    }
}

switch ($Action) {
    'ConfigureTask' {
        Assert-Command 'node'
        $nodePath = (Get-Command node).Source
        $action = New-ScheduledTaskAction -Execute $nodePath -Argument "`"$AppRoot\api\runtime\http-server.js`"" -WorkingDirectory $AppRoot
        $trigger = New-ScheduledTaskTrigger -AtStartup
        $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
        $settings = New-ScheduledTaskSettingsSet -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero)
        Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force | Out-Null
        Write-Output "Configured scheduled task '$TaskName'."
        break
    }
    'HealthCheck' {
        Invoke-LocalHealth
        break
    }
    'Deploy' {
        Assert-Command 'git'
        Assert-Command 'npm'

        $status = git -C $AppRoot status --porcelain
        if ($status) {
            throw 'Deployment stopped: working tree is not clean. Commit or remove local changes before deployment.'
        }

        $gitSha = (git -C $AppRoot rev-parse HEAD).Trim()
        if ($gitSha -notmatch '^[0-9a-f]{40}$') {
            throw "Invalid release SHA: $gitSha"
        }

        $task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
        if ($task) {
            Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
        }

        Push-Location $AppRoot
        try {
            if (Test-Path (Join-Path $AppRoot 'package-lock.json')) {
                & npm ci --omit=dev
            }
            else {
                Write-Warning 'package-lock.json is absent; using npm install --omit=dev for this lockfile-free repository.'
                & npm install --omit=dev --no-package-lock
            }
            if ($LASTEXITCODE -ne 0) { throw "npm dependency installation failed with exit code $LASTEXITCODE." }
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
