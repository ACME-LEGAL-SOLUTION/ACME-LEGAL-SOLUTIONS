const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const scriptPath = path.join(__dirname, '..', '..', 'deploy', 'postgresql-backup.ps1');
const script = fs.readFileSync(scriptPath, 'utf8');

test('PostgreSQL backup runner preserves the production backup contract', () => {
  assert.match(script, /--format=custom/);
  assert.match(script, /--no-password/);
  assert.match(script, /& \$pgRestore '--list' \$tempPath/);
  assert.doesNotMatch(script, /& \$pgRestore '--list' '--file', \$tempPath/);
  assert.match(script, /Get-FileHash.*SHA256/);
  assert.match(script, /credentialsRecorded\s*=\s*\$false/);
  assert.match(script, /Refusing to overwrite existing backup/);
  assert.match(script, /Move-Item -LiteralPath \$tempPath -Destination \$finalPath/);
  assert.match(script, /Remove-Item -LiteralPath \$tempPath/);
  assert.doesNotMatch(script, /PGPASSWORD\s*=/i);
  assert.doesNotMatch(script, /postgresql:\/\/[^\s"']+:[^\s"']+@/i);
});
