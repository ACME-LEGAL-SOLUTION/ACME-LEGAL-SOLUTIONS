[CmdletBinding()]
param(
    [string]$AppRoot = (Split-Path -Parent $PSScriptRoot)
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if (-not (Test-Path (Join-Path $AppRoot 'package.json'))) {
    throw "AppRoot does not contain package.json: $AppRoot"
}

$git = Get-Command git -ErrorAction SilentlyContinue
if (-not $git) {
    throw "Required command 'git' is not available."
}

$sqlFiles = @(git -C $AppRoot ls-files '*.sql')
if ($sqlFiles.Count -eq 0) {
    throw 'No tracked SQL sources found.'
}

$crlfFiles = @()
foreach ($relativePath in $sqlFiles) {
    $fullPath = Join-Path $AppRoot $relativePath
    $bytes = [System.IO.File]::ReadAllBytes($fullPath)
    for ($i = 0; $i -lt ($bytes.Length - 1); $i++) {
        if ($bytes[$i] -eq 13 -and $bytes[$i + 1] -eq 10) {
            $crlfFiles += $relativePath
            break
        }
    }
}

if ($crlfFiles.Count -gt 0) {
    throw ('SQL checkout contains CRLF line endings: ' + ($crlfFiles -join ', '))
}

$manifestPath = Join-Path $AppRoot 'api/persistence/migration-manifest.json'
if (-not (Test-Path $manifestPath)) {
    throw "Migration manifest is missing: $manifestPath"
}

$manifest = Get-Content -Raw -Path $manifestPath | ConvertFrom-Json
foreach ($migration in $manifest.migrations) {
    if ($migration.checksumAlgorithm -ne 'git-blob-sha1') {
        throw "Unsupported production migration checksum algorithm: $($migration.version)"
    }

    $schemaPath = Join-Path $AppRoot $migration.schema
    if (-not (Test-Path $schemaPath)) {
        throw "Migration schema is missing: $($migration.schema)"
    }

    $actual = (git -C $AppRoot hash-object -- $migration.schema).Trim()
    if ($actual -ne $migration.checksum) {
        throw "Migration source checksum drift: $($migration.version). Expected $($migration.checksum), got $actual."
    }
}

git -C $AppRoot ls-files --eol '*.sql'
Write-Output "SQL_PREFLIGHT=PASS"
Write-Output "SQL_FILES=$($sqlFiles.Count)"
Write-Output "MIGRATION_CHECKSUMS=PASS"
