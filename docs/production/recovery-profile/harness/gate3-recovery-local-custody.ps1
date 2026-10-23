param([ValidatePattern('^p[1-9]$')][string]$Target)
$ErrorActionPreference='Stop'
$taskBase=Join-Path $env:CLINIA_RECOVERY_WORKSPACE '.temp/gate3-recovery-private'
$taskDir=Join-Path $taskBase $Target
$taskAllow=@([Security.Principal.WindowsIdentity]::GetCurrent().User.Value,'S-1-5-18')
$taskItems=@((Get-Item -LiteralPath $taskBase),(Get-Item -LiteralPath $taskDir))+@(Get-ChildItem -LiteralPath $taskDir -File)
foreach($taskItem in $taskItems){if(($taskItem.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'Reparse point refused'};$taskAcl=Get-Acl -LiteralPath $taskItem.FullName;foreach($taskRule in @($taskAcl.Access | Where-Object AccessControlType -eq Allow)){if($taskRule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -notin $taskAllow){throw 'Unexpected local custody principal'}}}
[ordered]@{recordedAt=[DateTime]::UtcNow.ToString('o');status='PASS_LOCAL_USER_SYSTEM_ONLY_CUSTODY';target=$Target;items=$taskItems.Count;secretValuesRead=$false;actorOrTotpCopiesCreated=$false} | ConvertTo-Json -Compress
