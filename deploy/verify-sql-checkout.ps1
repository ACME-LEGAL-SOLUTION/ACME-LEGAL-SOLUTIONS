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

# The dedicated Windows runner can still materialize tracked LF blobs as CRLF
# despite the repository EOL contract. Normalize the checkout in-place before
# checksum validation so production validation is independent of runner EOL
# configuration. Only CRLF is rewritten; all other bytes are preserved.
$normalizedFiles = @()
foreach ($relativePath in $sqlFiles) {
    $fullPath = Join-Path $AppRoot $relativePath
    $bytes = [System.IO.File]::ReadAllBytes($fullPath)
    $hasCrlf = $false
    for ($i = 0; $i -lt ($bytes.Length - 1); $i++) {
        if ($bytes[$i] -eq 13 -and $bytes[$i + 1] -eq 10) {
            $hasCrlf = $true
            break
        }
    }

    if ($hasCrlf) {
        $normalized = New-Object System.Collections.Generic.List[byte]
        for ($i = 0; $i -lt $bytes.Length; $i++) {
            if ($bytes[$i] -eq 13 -and $i -lt ($bytes.Length - 1) -and $bytes[$i + 1] -eq 10) {
                [void]$normalized.Add(10)
                $i++
            } else {
                [void]$normalized.Add($bytes[$i])
            }
        }
        [System.IO.File]::WriteAllBytes($fullPath, $normalized.ToArray())
        $normalizedFiles += $relativePath
    }
}

$remainingCrlfFiles = @()
foreach ($relativePath in $sqlFiles) {
    $fullPath = Join-Path $AppRoot $relativePath
    $bytes = [System.IO.File]::ReadAllBytes($fullPath)
    for ($i = 0; $i -lt ($bytes.Length - 1); $i++) {
        if ($bytes[$i] -eq 13 -and $bytes[$i + 1] -eq 10) {
            $remainingCrlfFiles += $relativePath
            break
        }
    }
}

if ($remainingCrlfFiles.Count -gt 0) {
    throw ('SQL checkout still contains CRLF line endings after canonicalization: ' + ($remainingCrlfFiles -join ', '))
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
Write-Output "SQL_NORMALIZED=$($normalizedFiles.Count)"
Write-Output "MIGRATION_CHECKSUMS=PASS"
