$ErrorActionPreference = 'Continue'

function Test-CommandExists($Name) {
  return $null -ne (Get-Command $Name -ErrorAction SilentlyContinue)
}

Write-Host 'ACME M7-8B ZERO-BUDGET HOST PREFLIGHT'
Write-Host ('Timestamp: ' + (Get-Date -Format o))
Write-Host ('Computer: ' + $env:COMPUTERNAME)
Write-Host ('OS: ' + (Get-CimInstance Win32_OperatingSystem).Caption)
Write-Host ('OS Version: ' + (Get-CimInstance Win32_OperatingSystem).Version)
$cs = Get-CimInstance Win32_ComputerSystem
Write-Host ('CPU: ' + (Get-CimInstance Win32_Processor | Select-Object -First 1 -ExpandProperty Name))
Write-Host ('Logical CPUs: ' + $cs.NumberOfLogicalProcessors)
Write-Host ('RAM GB: ' + [math]::Round($cs.TotalPhysicalMemory / 1GB, 2))

Write-Host '`nDRIVES'
Get-PSDrive -PSProvider FileSystem | Select-Object Name, @{N='FreeGB';E={[math]::Round($_.Free/1GB,2)}}, @{N='UsedGB';E={[math]::Round($_.Used/1GB,2)}} | Format-Table -AutoSize

Write-Host 'RUNTIME'
if (Test-CommandExists node) { node --version } else { Write-Host 'node: MISSING' }
if (Test-CommandExists npm) { npm --version } else { Write-Host 'npm: MISSING' }
if (Test-CommandExists psql) { psql --version } else { Write-Host 'psql: MISSING' }
if (Test-CommandExists pg_dump) { pg_dump --version } else { Write-Host 'pg_dump: MISSING' }
if (Test-CommandExists cloudflared) { cloudflared --version } else { Write-Host 'cloudflared: MISSING' }

Write-Host '`nSERVICES'
Get-Service | Where-Object { $_.Name -match 'postgres|cloudflared|acme' -or $_.DisplayName -match 'postgres|cloudflared|acme' } | Select-Object Name, Status, StartType, DisplayName | Format-Table -AutoSize

Write-Host '`nNETWORK LISTENERS'
Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
  Where-Object { $_.LocalPort -in 3000,5432 } |
  Select-Object LocalAddress, LocalPort, OwningProcess | Format-Table -AutoSize

Write-Host '`nFIREWALL'
Get-NetFirewallProfile | Select-Object Name, Enabled, DefaultInboundAction, DefaultOutboundAction | Format-Table -AutoSize

Write-Host '`nNOTES'
Write-Host 'This script is inventory-only. It does not install, modify, expose, delete, or publish anything.'
Write-Host 'M7-8B is not accepted from this output alone; review storage separation, backup target, recovery tests, and security gates in M7-8A.'
