[CmdletBinding()]
param(
    [string]$OutputPath = ''
)

$ErrorActionPreference = 'Stop'

function Get-Version([string]$Command, [string]$Arguments = '--version') {
    try {
        $value = & $Command $Arguments 2>&1 | Select-Object -First 1
        return [string]$value
    } catch {
        return 'NOT_FOUND'
    }
}

$report = [ordered]@{
    Timestamp = (Get-Date).ToUniversalTime().ToString('o')
    Computer = $env:COMPUTERNAME
    OS = (Get-CimInstance Win32_OperatingSystem | Select-Object Caption,Version,BuildNumber)
    CPU = (Get-CimInstance Win32_Processor | Select-Object -First 1 Name,NumberOfCores,NumberOfLogicalProcessors)
    RAM_GB = [math]::Round((Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory / 1GB, 2)
    Drives = @(Get-CimInstance Win32_LogicalDisk -Filter "DriveType=3" | Select-Object DeviceID,@{N='SizeGB';E={[math]::Round($_.Size/1GB,2)}},@{N='FreeGB';E={[math]::Round($_.FreeSpace/1GB,2)}})
    Node = Get-Version 'node'
    Npm = Get-Version 'npm'
    Psql = Get-Version 'psql'
    PgDump = Get-Version 'pg_dump'
    Cloudflared = Get-Version 'cloudflared'
    Services = @(Get-Service -ErrorAction SilentlyContinue | Where-Object { $_.Name -match 'postgres|cloudflared|acme' } | Select-Object Name,Status,StartType)
    Listeners = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -in @(3000,5432) } | Select-Object LocalAddress,LocalPort,OwningProcess)
    Firewall = @(Get-NetFirewallProfile | Select-Object Name,Enabled,DefaultInboundAction,DefaultOutboundAction)
    Notes = @(
        'Read-only inventory. This script does not install, modify, expose, delete, publish, or migrate anything.'
        'M7-8B acceptance requires review of storage, PostgreSQL, backup/restore, security, recovery, and zero-budget gates.'
    )
}

$json = $report | ConvertTo-Json -Depth 5
if ($OutputPath) {
    $json | Set-Content -Path $OutputPath -Encoding UTF8
}
$json
