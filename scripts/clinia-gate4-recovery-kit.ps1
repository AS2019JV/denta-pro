param([Parameter(Mandatory)][ValidatePattern('^kit-[0-9]{2}$')][string]$KitId)
$ErrorActionPreference='Stop'
function Assert-KitNoReparse([string]$Path) {
  $taskCheckedPath=[IO.Path]::GetFullPath($Path)
  while ($true) {
    $taskCheckedItem=Get-Item -LiteralPath $taskCheckedPath
    if (($taskCheckedItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {throw 'Kit ancestor reparse refused'}
    $taskParentPath=[IO.Path]::GetDirectoryName($taskCheckedPath)
    if ([string]::IsNullOrEmpty($taskParentPath) -or $taskParentPath -eq $taskCheckedPath) {break}
    $taskCheckedPath=$taskParentPath
  }
}
$taskRoot=Split-Path -Parent $PSScriptRoot
$taskPrivate=Join-Path $taskRoot '.gate4-private'
$taskKit=Join-Path $taskPrivate $KitId
$taskZip=Join-Path $taskPrivate "recovery-$KitId.zip"
$taskVerify=Join-Path $taskPrivate "$KitId-verify"
if (Test-Path -LiteralPath (Join-Path $taskRoot "docs/production/evidence/2026-10-24-gate4-recovery-ops/$KitId.json")) {throw 'Preserve previous kit receipt'}
if ((Test-Path -LiteralPath $taskKit) -or (Test-Path -LiteralPath $taskZip) -or (Test-Path -LiteralPath $taskVerify)) {throw 'New kit identity required'}
Assert-KitNoReparse $taskPrivate
$taskItem=Get-Item -LiteralPath $taskPrivate
if (($taskItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {throw 'Private root reparse refused'}
$taskAcl=Get-Acl -LiteralPath $taskPrivate
if (-not $taskAcl.AreAccessRulesProtected) {throw 'Restricted private root required'}
$taskAllowed=@([Security.Principal.WindowsIdentity]::GetCurrent().User.Value,'S-1-5-18')
foreach ($taskRule in $taskAcl.Access) {
  if ($taskRule.AccessControlType -eq 'Allow' -and $taskRule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -notin $taskAllowed) {throw 'Unexpected kit custody principal'}
}
& node (Join-Path $PSScriptRoot 'clinia-recovery-package.cjs')
if ($LASTEXITCODE -ne 0) {throw 'Frozen package changed'}
New-Item -ItemType Directory -Path $taskKit | Out-Null
$taskManifest=Get-Content -LiteralPath (Join-Path $taskRoot 'docs/production/recovery-profile/manifest.json') -Raw | ConvertFrom-Json
$taskFiles=@($taskManifest.files.path)+@(
  'docs/production/recovery-profile/manifest.json',
  'docs/production/gate4-recovery-ops/RUNBOOK.md',
  'docs/production/gate4-recovery-ops/policy.proposed.json',
  'docs/production/gate4-recovery-ops/custody-request.json',
  'scripts/clinia-gate4-recovery-ops.cjs',
  'scripts/clinia-gate4-local-custody.cjs',
  'scripts/clinia-gate4-custody.ps1',
  'scripts/clinia-gate4-recovery-kit.ps1',
  'scripts/clinia-gate4-scan.cjs',
  'test/production/gate4-recovery-ops.test.cjs',
  'package.json','package-lock.json'
)
$taskRows=@()
foreach ($taskFile in ($taskFiles | Sort-Object -Unique)) {
  if ($taskFile -notmatch '^(scripts|docs/production/(recovery-profile|migration-package|gate4-recovery-ops)|test/production)/[a-zA-Z0-9_./-]+$' -and $taskFile -notin @('package.json','package-lock.json')) {throw 'Kit file not allowlisted'}
  if ($taskFile.Split('/') -contains '..') {throw 'Kit traversal refused'}
  $taskSource=Join-Path $taskRoot $taskFile
  Assert-KitNoReparse $taskSource
  $taskDest=Join-Path $taskKit $taskFile
  New-Item -ItemType Directory -Force (Split-Path -Parent $taskDest) | Out-Null
  Assert-KitNoReparse (Split-Path -Parent $taskDest)
  [IO.File]::Copy($taskSource,$taskDest,$false)
  $taskRows+=[ordered]@{path=$taskFile;bytes=(Get-Item -LiteralPath $taskDest).Length;sha256=(Get-FileHash -LiteralPath $taskDest -Algorithm SHA256).Hash.ToLowerInvariant()}
}
$taskKitManifest=[ordered]@{version=1;baseSHA='902999c6b7b7ee696982d87e8ce7f6e5087f75e2';kitId=$KitId;files=$taskRows;backupIncluded=$false;keyIncluded=$false;imagesIncluded=$false;applicationCheckoutIncluded=$false;limit='Supplement to exact Git checkout; not a standalone offline full application recovery. MANIFEST.json excludes itself.'}
$taskKitManifest | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $taskKit 'MANIFEST.json') -Encoding utf8NoBOM
# Known-secret and bounded credential scan before packaging. No values emitted.
$env:CLINIA_GATE4_KIT_SCAN=$taskKit
& node (Join-Path $PSScriptRoot 'clinia-gate4-scan.cjs')
if ($LASTEXITCODE -ne 0) {throw 'Public kit scan refused; retain private directory'}
Compress-Archive -Path (Join-Path $taskKit '*') -DestinationPath $taskZip -CompressionLevel Optimal
Expand-Archive -LiteralPath $taskZip -DestinationPath $taskVerify
$taskRestoredManifest=Get-Content -LiteralPath (Join-Path $taskVerify 'MANIFEST.json') -Raw | ConvertFrom-Json
foreach ($taskEntry in $taskRestoredManifest.files) {
  if ((Get-FileHash -LiteralPath (Join-Path $taskVerify $taskEntry.path) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $taskEntry.sha256) {throw 'Kit readback hash mismatch'}
}
& node (Join-Path $taskVerify 'scripts/clinia-recovery-package.cjs')
if ($LASTEXITCODE -ne 0) {throw 'Extracted kit package failed'}
$taskReceipt=[ordered]@{
  status='PASS_LOCAL_KIT_ZIP_EXTRACT_AND_HASHES'
  kitId=$KitId
  recordedAt=[DateTime]::UtcNow.ToString('o')
  path=".gate4-private/recovery-$KitId.zip"
  zipSha256=(Get-FileHash -LiteralPath $taskZip -Algorithm SHA256).Hash.ToLowerInvariant()
  bytes=(Get-Item -LiteralPath $taskZip).Length
  sourceFiles=$taskRows.Count
  frozenPackageSources=164
  backupIncluded=$false
  keyIncluded=$false
  imagesIncluded=$false
  sameComputer=$true
  offsite=$false
  independentRecovery=$false
  independentDeviceTest=$false
}
$taskReceipt | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $taskRoot "docs/production/evidence/2026-10-24-gate4-recovery-ops/$KitId.json") -Encoding utf8NoBOM
$taskReceipt | ConvertTo-Json -Compress
