[CmdletBinding()]
param(
    [string]$BackupDirectory = $env:ACME_PG_BACKUP_DIR,
    [string]$HostName = $env:ACME_PG_HOST,
    [string]$Port = $env:ACME_PG_PORT,
    [string]$Database = $env:ACME_PG_DATABASE,
    [string]$User = $env:ACME_PG_USER,
    [string]$PgBinDirectory = $env:ACME_PG_BIN_DIR
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Require-Value([string]$Name, [string]$Value) {
    if ([string]::IsNullOrWhiteSpace($Value)) {
        throw "Required backup setting '$Name' is not configured."
    }
}

function Resolve-PgTool([string]$Name) {
    if ($PgBinDirectory) {
        $candidate = Join-Path $PgBinDirectory $Name
        if (Test-Path $candidate) { return $candidate }
    }

    $command = Get-Command $Name -ErrorAction SilentlyContinue
    if ($command) { return $command.Source }
    throw "Required PostgreSQL tool '$Name' is not available."
}

Require-Value 'ACME_PG_BACKUP_DIR' $BackupDirectory
Require-Value 'ACME_PG_HOST' $HostName
Require-Value 'ACME_PG_PORT' $Port
Require-Value 'ACME_PG_DATABASE' $Database
Require-Value 'ACME_PG_USER' $User

$pgDump = Resolve-PgTool 'pg_dump.exe'
$pgRestore = Resolve-PgTool 'pg_restore.exe'

if (-not (Test-Path $BackupDirectory)) {
    New-Item -ItemType Directory -Path $BackupDirectory -Force | Out-Null
}

$resolvedDirectory = (Resolve-Path $BackupDirectory).Path
$timestamp = [DateTime]::Now.ToString('yyyy-MM-dd_HHmmss')
$baseName = "${Database}-${timestamp}"
$finalPath = Join-Path $resolvedDirectory "$baseName.dump"
$tempPath = Join-Path $resolvedDirectory ".$baseName.$PID.tmp.dump"
$evidencePath = Join-Path $resolvedDirectory "$baseName.json"

if (Test-Path $finalPath) {
    throw "Refusing to overwrite existing backup: $finalPath"
}

$startedAt = [DateTime]::UtcNow
$dumpArgs = @(
    '--host', $HostName,
    '--port', $Port,
    '--username', $User,
    '--dbname', $Database,
    '--format=custom',
    '--file', $tempPath,
    '--no-password'
)

try {
    & $pgDump @dumpArgs
    if ($LASTEXITCODE -ne 0) {
        throw "pg_dump failed with exit code $LASTEXITCODE."
    }

    if (-not (Test-Path $tempPath)) {
        throw 'pg_dump reported success but did not create the temporary backup file.'
    }

    & $pgRestore '--list' '--file', $tempPath
    if ($LASTEXITCODE -ne 0) {
        throw "pg_restore verification failed with exit code $LASTEXITCODE."
    }

    Move-Item -LiteralPath $tempPath -Destination $finalPath
    $hash = Get-FileHash -LiteralPath $finalPath -Algorithm SHA256
    $file = Get-Item -LiteralPath $finalPath
    $completedAt = [DateTime]::UtcNow

    $evidence = [ordered]@{
        status = 'verified'
        database = $Database
        backupFile = $file.Name
        backupPath = $finalPath
        sizeBytes = $file.Length
        sha256 = $hash.Hash
        startedAtUtc = $startedAt.ToString('o')
        completedAtUtc = $completedAt.ToString('o')
        durationSeconds = [Math]::Round(($completedAt - $startedAt).TotalSeconds, 3)
        verification = 'pg_restore --list'
        credentialsRecorded = $false
    }

    $evidence | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $evidencePath -Encoding utf8

    Write-Output "BACKUP_STATUS=verified"
    Write-Output "BACKUP_FILE=$($file.Name)"
    Write-Output "BACKUP_SIZE_BYTES=$($file.Length)"
    Write-Output "BACKUP_SHA256=$($hash.Hash)"
    Write-Output "BACKUP_EVIDENCE=$evidencePath"
    Write-Output "BACKUP_COMPLETED_AT_UTC=$($completedAt.ToString('o'))"
}
catch {
    if (Test-Path $tempPath) {
        Remove-Item -LiteralPath $tempPath -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path $finalPath) {
        Remove-Item -LiteralPath $finalPath -Force -ErrorAction SilentlyContinue
    }
    throw
}
