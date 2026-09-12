[CmdletBinding()]
param(
    [string]$TaskName = 'ACME-Legal-API',
    [string]$DeploymentRoot = 'C:\ProgramData\ACME-Legal-Solutions',
    [int]$Port = 3000
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Assert-Administrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object System.Security.Principal.WindowsPrincipal($identity)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw 'This host configuration must be run from an elevated Administrator PowerShell.'
    }
}

Assert-Administrator

$CurrentRoot = Join-Path $DeploymentRoot 'current'
$ReleaseRoot = Join-Path $DeploymentRoot 'releases'
New-Item -ItemType Directory -Force -Path $CurrentRoot, $ReleaseRoot | Out-Null

# The GitHub Actions runner service commonly runs as Network Service. Grant it
# only Modify access to the deployment directory; do not grant it Administrator.
$acl = Get-Acl -LiteralPath $DeploymentRoot
$rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
    'NT AUTHORITY\NETWORK SERVICE',
    'Modify',
    'ContainerInherit,ObjectInherit',
    'None',
    'Allow'
)
$acl.SetAccessRule($rule)
Set-Acl -LiteralPath $DeploymentRoot -AclObject $acl

$node = (Get-Command node).Source
$server = Join-Path $CurrentRoot 'api\runtime\http-server.js'
$taskAction = New-ScheduledTaskAction -Execute $node -Argument "`"$server`"" -WorkingDirectory $CurrentRoot
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask -TaskName $TaskName -Action $taskAction -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null

# The runner itself is Network Service. Windows Task Scheduler normally allows
# Network Service to manage only tasks it created. This task is intentionally
# created once by an elevated Administrator, so grant Network Service control
# of this one task file without granting it Administrator rights on the host.
$taskFile = Join-Path $env:WINDIR "System32\Tasks\$TaskName"
if (-not (Test-Path -LiteralPath $taskFile)) {
    throw "Registered task file was not found: $taskFile"
}
& icacls.exe $taskFile /grant 'NT AUTHORITY\NETWORK SERVICE:(F)' | Out-Host
if ($LASTEXITCODE -ne 0) {
    throw "Failed to grant Network Service control of scheduled task file. icacls exit code: $LASTEXITCODE"
}

Write-Output "HOST_CONFIGURED=$TaskName"
Write-Output "DEPLOYMENT_ROOT=$DeploymentRoot"
Write-Output "CURRENT_ROOT=$CurrentRoot"
Write-Output "TASK_FILE=$taskFile"
Write-Output "TASK_STATE=$((Get-ScheduledTask -TaskName $TaskName).State)"