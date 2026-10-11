param([ValidateSet('Start','Inspect','Status','Stop')][string]$Action = 'Inspect')
$ErrorActionPreference = 'Stop'
$repository = Split-Path $PSScriptRoot
$workdir = Join-Path $repository 'tools/local-supabase'
$privateDirectory = Join-Path $workdir 'supabase/.temp'
$project = 'clinia-acceptance'
$network = 'clinia-acceptance-loopback'
$docker = Join-Path $env:LOCALAPPDATA 'Programs/DockerDesktop/resources/bin/docker.exe'
if (!(Test-Path -LiteralPath $docker)) {
    $docker = 'C:/Program Files/Docker/Docker/resources/bin/docker.exe'
}
if (!(Test-Path -LiteralPath $docker)) { throw 'Docker CLI not found; install/start Desktop through the user.' }
$cli = Join-Path $repository 'node_modules/.bin/supabase.cmd'
if (!(Test-Path -LiteralPath $cli)) { throw 'Use the repository Supabase CLI dependency.' }
$env:PATH = (Split-Path $docker) + ';' + $env:PATH
$env:SUPABASE_TELEMETRY_DISABLED = '1'
$env:DO_NOT_TRACK = '1'

function Docker-Result([string[]]$Arguments) {
    $result = & $docker @Arguments 2>&1
    if ($LASTEXITCODE -ne 0) { throw "Docker $($Arguments[0]) failed: $($result -join ' ')" }
    return ($result | Out-String).Trim()
}

$context = Docker-Result @('context','show')
$endpoint = Docker-Result @('context','inspect',$context,'--format','{{.Endpoints.docker.Host}}')
if ($context -ne 'desktop-linux' -or $endpoint -ne 'npipe:////./pipe/dockerDesktopLinuxEngine') {
    throw 'Expected local Desktop Linux named pipe; refusing remote/context switch.'
}
$config = Get-Content -Raw -LiteralPath (Join-Path $workdir 'supabase/config.toml')
if ($config -notmatch '(?m)^project_id = "clinia-acceptance"$') { throw 'Acceptance project ID mismatch.' }
if (Test-Path -LiteralPath (Join-Path $privateDirectory 'project-ref')) { throw 'Local acceptance must not be linked to remote.' }
New-Item -ItemType Directory -Force -Path $privateDirectory | Out-Null

if ($Action -eq 'Start') {
    # CLI 2.117.0 published on all interfaces despite the bridge default in this
    # Desktop version. Only the captured runtime with explicit host_ip is allowed.
    if (!(Test-Path -LiteralPath (Join-Path $privateDirectory 'runtime.compose.json'))) {
        throw 'Reviewed private Compose capture required; do not start CLI with application fixtures.'
    }
    & node (Join-Path $PSScriptRoot 'prepare-clinia-compose.cjs') start
    if ($LASTEXITCODE -ne 0) { throw 'Loopback runtime start failed; private diagnostics preserved.' }
} elseif ($Action -eq 'Stop') {
    & node (Join-Path $PSScriptRoot 'prepare-clinia-compose.cjs') stop
    if ($LASTEXITCODE -ne 0) { throw 'Local Compose stop failed; private diagnostics preserved.' }
    'Acceptance stack stopped; volumes preserved.'
} elseif ($Action -eq 'Status') {
    & $cli status --workdir $workdir --output json *> (Join-Path $privateDirectory 'status.json')
    if ($LASTEXITCODE -ne 0) { throw 'Local status failed; private output preserved.' }
    'Local status captured without printing credentials.'
}

if ($Action -in @('Start','Inspect')) {
    $allContainers = (Docker-Result @('ps','-a','--format','{{.Names}}')) -split '\r?\n'
    $containers = @($allContainers | Where-Object { $_ -match ('_' + [regex]::Escape($project) + '$') })
    foreach ($container in $containers) {
        $safe = (Docker-Result @('inspect',$container,'--format','{"name":{{json .Name}},"state":{{json .State.Status}},"health":{{if .State.Health}}{{json .State.Health.Status}}{{else}}null{{end}},"ports":{{json .NetworkSettings.Ports}},"privileged":{{json .HostConfig.Privileged}},"mounts":{{json .Mounts}}}')) | ConvertFrom-Json
        if ($safe.privileged) { throw "Unexpected privileged container: $container" }
        foreach ($binding in $safe.ports.PSObject.Properties.Value) {
            foreach ($port in $binding) {
                if ($port.HostIp -notin @('127.0.0.1','::1')) { throw "Non-loopback publication in $container; stop this project and review." }
            }
        }
        $safe | ConvertTo-Json -Depth 6 -Compress
    }
    if ($containers.Count -eq 0) { 'No acceptance containers exist yet.' }
}
