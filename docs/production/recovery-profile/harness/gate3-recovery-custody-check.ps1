$ErrorActionPreference='Stop'
$root=Split-Path -Parent $PSScriptRoot
$allowed=@([Security.Principal.WindowsIdentity]::GetCurrent().User.Value,'S-1-5-18')
$dirs=@((Join-Path $env:CLINIA_RECOVERY_WORKSPACE '.temp/gate3-hosted-access'),(Join-Path $env:CLINIA_RECOVERY_WORKSPACE '.temp/gate3-bootstrap-keys'))
$files=@((Join-Path $dirs[0] 'clinia-test-20261021-baseline.aesgcm'),(Join-Path $dirs[1] 'clinia-test-20261021-baseline.key'))
foreach($p in ($dirs+$files)){
 $item=Get-Item -LiteralPath $p
 if(($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0){throw 'Custody reparse point refused'}
 $acl=Get-Acl -LiteralPath $p
 if($p -in $dirs -and -not $acl.AreAccessRulesProtected){throw 'Unprotected custody inheritance'}
 foreach($rule in @($acl.Access | Where-Object AccessControlType -eq Allow)){if($rule.IdentityReference.Translate([Security.Principal.SecurityIdentifier]).Value -notin $allowed){throw 'Unexpected custody principal'}}
}
$r=[ordered]@{recordedAt=[DateTime]::UtcNow.ToString('o');status='PASS_OWNER_SYSTEM_ONLY_BACKUP_KEY_CUSTODY';files=2;keyAvailable=(Test-Path -LiteralPath $files[1]);keyContentsPrinted=$false;reparsePoints=$false;logicalSeparation=$true;offsite=$false;sourceModified=$false}
$r | ConvertTo-Json -Compress
