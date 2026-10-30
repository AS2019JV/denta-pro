param()
$ErrorActionPreference='Stop'
$taskRoot='C:/Users/aleja/.codex/worktrees/clinia-gate4-recovery/denta-pro'
$taskSource=Join-Path $taskRoot 'scripts/clinia-gate4-custody.ps1'
if((Get-FileHash -LiteralPath $taskSource -Algorithm SHA256).Hash.ToLower() -ne '0475da8b858356ae8c3bfd39a1ca69a8b8d18b2b54a56b58e9bdcfe1c5e3d028'){throw 'ORIGINAL_CUSTODY_SOURCE_DRIFT'}
$taskSid=[Security.Principal.WindowsIdentity]::GetCurrent().User
$taskAllowed=@($taskSid.Value,'S-1-5-18')
$taskTokens=$null;$taskErrors=$null
$taskAst=[Management.Automation.Language.Parser]::ParseFile($taskSource,[ref]$taskTokens,[ref]$taskErrors)
if($taskErrors.Count){throw 'ORIGINAL_CUSTODY_PARSE_REFUSED'}
foreach($taskName in @('Assert-NoReparse','Assert-Custody')){
 $taskFunction=$taskAst.Find({param($taskNode) $taskNode -is [Management.Automation.Language.FunctionDefinitionAst] -and $taskNode.Name -eq $taskName},$true)
 if(!$taskFunction){throw 'ORIGINAL_CUSTODY_FUNCTION_ABSENT'}
 Invoke-Expression $taskFunction.Extent.Text
}
$taskParent=Join-Path $taskRoot '.gate4-private'
$taskPrivate=Join-Path $taskParent 'managed-a9'
$taskReference=Join-Path $taskPrivate 'credentials.private.json'
Assert-Custody $taskParent
Assert-Custody $taskPrivate
if(!(Test-Path -LiteralPath $taskReference -PathType Leaf)){throw 'CREDENTIAL_REFERENCE_NOT_A_FILE'}
Assert-Custody $taskReference
$taskMeta=Get-Item -LiteralPath $taskReference
if($taskMeta.Length -lt 170 -or $taskMeta.Length -gt 16384){throw 'CREDENTIAL_REFERENCE_SIZE_REFUSED'}
[ordered]@{guard='ORIGINAL_OWNER_SYSTEM_NO_REPARSE';exists=$true;isFile=$true;sizeBoundPass=$true;contentsRead=$false;secretHashRead=$false;ACLChanged=$false}|ConvertTo-Json -Compress