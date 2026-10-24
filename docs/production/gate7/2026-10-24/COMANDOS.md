# Comandos y verificación delimitada — Gate7

Base: `902999c6b7b7ee696982d87e8ce7f6e5087f75e2`. Worktree:
`C:/Users/aleja/.codex/worktrees/gate7-clinical-acceptance/denta-pro`.
Rama: `codex/gate7-clinical-acceptance`.

## Identidad y CI

Herramientas nativas `list_artifacts` (sin worktree adjunto previo), `create_worktree` con ref completo 902999c6b7b7ee696982d87e8ce7f6e5087f75e2 y nombre gate7-clinical-acceptance, y `get_worktree_creation_status` confirmaron creación/registro. No se usó main como base.

```powershell
git cat-file -t 902999c6b7b7ee696982d87e8ce7f6e5087f75e2
git show -s --format=fuller 902999c6b7b7ee696982d87e8ce7f6e5087f75e2
git switch -c codex/gate7-clinical-acceptance
git rev-parse HEAD
git branch --show-current
gh run view 40003941444 --repo AS2019JV/denta-pro --json headSha,conclusion,status,url
git diff --name-only 902999c6b7b7ee696982d87e8ce7f6e5087f75e2 5a7a24af57c645bfc1cf8c70594cc568e03a7176
```

Resultados: commit válido/base exacta; rama propia creada; CI completed/success del SHA exacto 5a7a24af57c645bfc1cf8c70594cc568e03a7176; siete archivos de delta, sin SQL. GitHub connector confirmó además job offline-contracts SUCCESS y estado Vercel success. El primer intento de switch fue denegado por permisos de .git y el primer gh por lectura de configuración; ambos se completaron con escalación acotada. No cambió el checkout compartido ni se inició CI.

Para siete rutas se ejecutó `git rev-parse SHA:ruta` en b7a0f2fff972b0b71dc7ad5664a4dc2b13d0bf2d, 902999c6b7b7ee696982d87e8ce7f6e5087f75e2 y 5a7a24af57c645bfc1cf8c70594cc568e03a7176. Los 21 blobs resolvieron; las siete comparaciones fueron idénticas. Rutas/hashes y límites: `evidence/verification.json`. Las dependencias PDF cambian aunque esos consumidores no cambien.

## Recibos

Lecturas solamente en checkout compartido: sección vigente PRODUCTION_ACCEPTANCE_2026-10-07.md, handoff Gate7, skill dental-clinical-standards, clinical-browser.json/clinical-hosted-integration.json de 9oct y recibos de security-patches-functional de 23oct. No se accedió a cuentas o fixtures.

Verificación ejecutada con PowerShell:
```powershell
$gate7ReceiptRoot = 'C:\Users\aleja\Documents\0-dev\denta-pro\docs\production\evidence\2026-10-23-security-patches-functional'
$gate7Seal = Get-Content -LiteralPath (Join-Path $gate7ReceiptRoot 'SEAL.json') -Raw | ConvertFrom-Json
$gate7ManifestPath = Join-Path $gate7ReceiptRoot 'MANIFEST.sha256'
$gate7ManifestHash = (Get-FileHash -LiteralPath $gate7ManifestPath -Algorithm SHA256).Hash.ToLowerInvariant()
if ($gate7ManifestHash -ne $gate7Seal.manifestSha256) { throw 'Source manifest hash differs from seal' }
$gate7Lines = Get-Content -LiteralPath $gate7ManifestPath
foreach ($gate7Name in @('RESULTADO.md','ci-successor.json','successor-candidate.json','recovery-scope-reuse.json','DEMO_5_MIN.md')) {
  $gate7Match = @($gate7Lines | Where-Object { $_.Substring(66) -eq $gate7Name })
  if ($gate7Match.Count -ne 1) { throw 'Missing or ambiguous receipt' }
  $gate7Actual = (Get-FileHash -LiteralPath (Join-Path $gate7ReceiptRoot $gate7Name) -Algorithm SHA256).Hash.ToLowerInvariant()
  if ($gate7Match[0].Substring(0,64) -ne $gate7Actual) { throw 'Receipt hash mismatch' }
}
```

Resultado: hash del manifest coincide con ancla externa; cinco recibos seleccionados coinciden 5/5. No se revalidaron los 60 artefactos completos ni se confundió integridad con aceptación. Otros cuatro archivos leídos se registraron con hash al momento, sin atribuirles sello o runtime nuevo: `evidence/source-receipts.json`.

## Paquete propio

Verificación local: parseo de dos JSON, resolución de enlaces relativos de Markdown, siete recorridos y guion 0:00–5:00, ausencia de patrones de credenciales/URLs protegidas y de IDs reservados; staging únicamente de la ruta Gate7 explícita; `git diff --cached --check`; diff limitado a docs/production/gate7/2026-10-24. Se genera MANIFEST.sha256 solo para archivos propios (excluye su autorreferencia) y se verifica antes de entrega. Resultados: `evidence/package-checks.json`.

No hubo código/SQL nuevo: cero tests clínicos/producto nuevos, cero suites repetidas, cero instalaciones, cero restores, cero stacks y cero nuevas CI. El chequeo del paquete verifica documentos y procedencia, no funcionamiento alojado.

El commit documental se identifica por SHA completo en el sobre no secreto:
`.release-snapshots/gate7-delivery-2026-10-24/handoff.json`.
El sobre está fuera del commit e ignorado, para incluir resultSHA real sin autorreferencia. Referencia los archivos comprometidos y sus hashes; debe entregarse junto al commit. Ninguna publicación ni actualización de la matriz global se realizó.

El candidato final y la clínica/actores/turno permanecen pendientes por confirmación explícita del usuario. No hay aprobación clínica/legal.
