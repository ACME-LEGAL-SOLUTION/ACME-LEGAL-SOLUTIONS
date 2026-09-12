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
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
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

Write-Output "HOST_CONFIGURED=$TaskName"
Write-Output "DEPLOYMENT_ROOT=$DeploymentRoot"
Write-Output "CURRENT_ROOT=$CurrentRoot"
Write-Output "TASK_STATE=$((Get-ScheduledTask -TaskName $TaskName).State)"
