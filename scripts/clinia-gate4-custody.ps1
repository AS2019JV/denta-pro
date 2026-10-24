param(
  [Parameter(Mandatory)][ValidateSet('Prepare','Verify')][string]$Mode,
  [Parameter(Mandatory)][ValidatePattern('^custody-[0-9]{2}$')][string]$Attempt,
  [Parameter(Mandatory)][ValidatePattern('^[a-z0-9-]+\.json$')][string]$ReceiptName,
  [string]$SourceArchive,
  [string]$SourceKey
)
$ErrorActionPreference='Stop'
$taskStartedAt=[DateTime]::UtcNow
$taskTimer=[Diagnostics.Stopwatch]::StartNew()
$taskRoot=Split-Path -Parent $PSScriptRoot
$taskPrivate=Join-Path $taskRoot '.gate4-private'
$taskSid=[Security.Principal.WindowsIdentity]::GetCurrent().User
$taskAllowed=@($taskSid.Value,'S-1-5-18')
function Assert-NoReparse([string]$Path) {
  $taskCurrent=Get-Item -LiteralPath $Path
  while ($null -ne $taskCurrent) {
    if (($taskCurrent.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) {throw 'Reparse point refused'}
    $taskCurrent=$taskCurrent.Parent
  }
}
function Assert-Custody([string]$Path) {
  Assert-NoReparse $Path
  $taskAcl=Get-Acl -LiteralPath $Path
  if ((Get-Item -LiteralPath $Path).PSIsContainer -and -not $taskAcl.AreAccessRulesProtected) {throw 'Custody directory inheritance not protected'}
  if ($taskAcl.GetOwner([Security.Principal.SecurityIdentifier]).Value -notin $taskAllowed) {throw 'Unexpected custody owner'}
  $taskAllowCount=0
  foreach ($taskRule in $taskAcl.Access) {
    if ($taskRule.AccessControlType -eq 'Allow') {
      $taskAllowCount++
      if ($taskRule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -notin $taskAllowed) {throw 'Unexpected custody principal'}
    }
  }
  if ($taskAllowCount -lt 1) {throw 'Custody allow list empty'}
}
function New-CustodyDirectory([string]$Path) {
  if (Test-Path -LiteralPath $Path) {Assert-Custody $Path;return}
  Assert-NoReparse (Split-Path -Parent $Path)
  New-Item -ItemType Directory -Path $Path | Out-Null
  # No secret is written before the restricted DACL is installed.
  $taskAcl=[Security.AccessControl.DirectorySecurity]::new()
  $taskAcl.SetOwner($taskSid)
  $taskAcl.SetAccessRuleProtection($true,$false)
  foreach ($taskPrincipal in $taskAllowed) {
    $taskIdentity=[Security.Principal.SecurityIdentifier]::new($taskPrincipal)
    $taskRule=[Security.AccessControl.FileSystemAccessRule]::new($taskIdentity,'FullControl','ContainerInherit,ObjectInherit','None','Allow')
    $taskAcl.AddAccessRule($taskRule)
  }
  Set-Acl -LiteralPath $Path -AclObject $taskAcl
  Assert-Custody $Path
}
Assert-NoReparse $taskRoot
$taskGitRoot=(& git -C $taskRoot rev-parse --show-toplevel).Trim()
if ($LASTEXITCODE -ne 0 -or $taskGitRoot -ne $taskRoot.Replace('\','/')) {throw 'Own Git worktree required'}
$taskBranch=(& git -C $taskRoot branch --show-current).Trim()
if ($taskBranch -ne 'codex/gate4-recovery-ops') {throw 'Exclusive Gate4 branch required'}
& git -C $taskRoot check-ignore -q '.gate4-private/probe'
if ($LASTEXITCODE -ne 0) {throw 'Private root must be ignored before creation'}
$taskArchive=Join-Path $taskPrivate "archives/$Attempt/baseline.aesgcm"
$taskKey=Join-Path $taskPrivate "keys/$Attempt/baseline.key"
if ($Mode -eq 'Prepare') {
  if (-not $SourceArchive -or -not $SourceKey) {throw 'Explicit read-only source files required'}
  foreach ($taskSource in @($SourceArchive,$SourceKey)) {
    Assert-Custody (Split-Path -Parent $taskSource)
    Assert-Custody $taskSource
  }
  if ((Test-Path -LiteralPath (Split-Path -Parent $taskArchive)) -or (Test-Path -LiteralPath (Split-Path -Parent $taskKey))) {throw 'New custody attempt required'}
  New-CustodyDirectory $taskPrivate
  New-CustodyDirectory (Join-Path $taskPrivate 'archives')
  New-CustodyDirectory (Join-Path $taskPrivate 'keys')
  New-CustodyDirectory (Split-Path -Parent $taskArchive)
  New-CustodyDirectory (Split-Path -Parent $taskKey)
} else {
  foreach ($taskPath in @($taskPrivate,(Join-Path $taskPrivate 'archives'),(Join-Path $taskPrivate 'keys'),(Split-Path -Parent $taskArchive),(Split-Path -Parent $taskKey),$taskArchive,$taskKey)) {Assert-Custody $taskPath}
}
$taskReceipt=Join-Path $taskRoot "docs/production/evidence/2026-10-24-gate4-recovery-ops/$ReceiptName"
if (Test-Path -LiteralPath $taskReceipt) {throw 'Preserve previous receipt'}
$taskNodeMode=if ($Mode -eq 'Prepare') {'copy'} else {'verify'}
& node (Join-Path $PSScriptRoot 'clinia-gate4-local-custody.cjs') $taskNodeMode $Attempt $taskReceipt $SourceArchive $SourceKey
if ($LASTEXITCODE -ne 0) {throw 'Local custody check refused; preserve destination'}
foreach ($taskPath in @($taskArchive,$taskKey)) {Assert-Custody $taskPath}
# Metadata-only receipt: no key value, JWT, object name, email, or protected URL.
$taskAclReceipt=$taskReceipt.Replace('.json','.acl.json')
$taskAclJson=([ordered]@{status='PASS_OWNER_SYSTEM_ONLY_LOCAL_COPY';attempt=$Attempt;recordedAt=[DateTime]::UtcNow.ToString('o');principals='Current user and SYSTEM';protectedDirectories=$true;reparsePoints=$false;logicalKeySeparation=$true;offsite=$false;independentCustodian=$false;sourceAclModified=$false}) | ConvertTo-Json
$taskStream=[IO.File]::Open($taskAclReceipt,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
try {
  $taskBytes=[Text.UTF8Encoding]::new($false).GetBytes($taskAclJson+[Environment]::NewLine)
  $taskStream.Write($taskBytes,0,$taskBytes.Length)
  $taskStream.Flush($true)
} finally {$taskStream.Dispose()}

# End time is taken only after final ACL verification and durable ACL receipt.
$taskTimer.Stop()
$taskTiming=[ordered]@{
  status='PASS_COMPLETE_LOCAL_CUSTODY_VERIFICATION'
  attempt=$Attempt
  startedAt=$taskStartedAt.ToString('o')
  allChecksCompletedAt=[DateTime]::UtcNow.ToString('o')
  elapsedSeconds=[Math]::Round($taskTimer.Elapsed.TotalSeconds,3)
  scope='Own-worktree guard, ACLs, ciphertext authentication, dump and all captured byte hashes, original-factor payload preservation, negative crypto controls, ACL recheck and receipt'
  databaseRestore=$false
  applicationRuntime=$false
  productionRto=$null
  currentSourceRpo=$null
  offsite=$false
}
$taskTimingPath=$taskReceipt.Replace('.json','.timing.json')
$taskTimingStream=[IO.File]::Open($taskTimingPath,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write,[IO.FileShare]::None)
try {
  $taskTimingBytes=[Text.UTF8Encoding]::new($false).GetBytes(($taskTiming | ConvertTo-Json)+[Environment]::NewLine)
  $taskTimingStream.Write($taskTimingBytes,0,$taskTimingBytes.Length)
  $taskTimingStream.Flush($true)
} finally {$taskTimingStream.Dispose()}