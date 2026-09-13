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

# Remove the existing task before recreating it. This eliminates stale task
# state/security metadata while retaining the same stable production identity.
$existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($existingTask) {
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
}

$taskAction = New-ScheduledTaskAction -Execute $node -Argument "`"$server`"" -WorkingDirectory $CurrentRoot
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -RestartCount 5 -RestartInterval (New-TimeSpan -Minutes 1) -StartWhenAvailable
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask -TaskName $TaskName -Action $taskAction -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null

$taskFile = Join-Path $env:WINDIR "System32\Tasks\$TaskName"
if (-not (Test-Path -LiteralPath $taskFile)) {
    throw "Registered task file was not found: $taskFile"
}
& icacls.exe $taskFile /grant 'NT AUTHORITY\NETWORK SERVICE:(F)' | Out-Host
if ($LASTEXITCODE -ne 0) {
    throw "Failed to grant Network Service control of scheduled task file. icacls exit code: $LASTEXITCODE"
}

$taskService = New-Object -ComObject 'Schedule.Service'
$taskService.Connect()
$taskFolder = $taskService.GetFolder('\')
$registeredTask = $taskFolder.GetTask($TaskName)
$currentSddl = [string]$registeredTask.GetSecurityDescriptor(0xF)
if ($currentSddl -notmatch '\(A;;FA;;;NS\)') {
    $updatedSddl = $currentSddl + '(A;;FA;;;NS)'
    $registeredTask.SetSecurityDescriptor($updatedSddl, 0)
}

$verifiedSddl = [string]$registeredTask.GetSecurityDescriptor(0xF)
if ($verifiedSddl -notmatch '\(A;;FA;;;NS\)') {
    throw 'Task Scheduler security descriptor does not grant Network Service full control of the production task.'
}

$verifiedTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
if (-not $verifiedTask) {
    throw "Task Scheduler cannot enumerate configured task '$TaskName'."
}

Write-Output "HOST_CONFIGURED=$TaskName"
Write-Output "DEPLOYMENT_ROOT=$DeploymentRoot"
Write-Output "CURRENT_ROOT=$CurrentRoot"
Write-Output "TASK_FILE=$taskFile"
Write-Output "TASK_SDDL_NETWORK_SERVICE=FULL"
Write-Output "TASK_STATE=$($verifiedTask.State)"
