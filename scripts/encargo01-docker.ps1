param([ValidateSet('Provision','Verify','Stop')][string]$Action = 'Verify')
$ErrorActionPreference = 'Stop'
$docker = Join-Path $env:LOCALAPPDATA 'Programs\DockerDesktop\resources\bin\docker.exe'
$env:PATH = (Split-Path $docker) + ';' + $env:PATH
$name = 'denta-encargo01-disposable'
$network = 'denta-encargo01-internal'
$volume = 'denta-encargo01-pgdata'
$evidence = Join-Path $PSScriptRoot '../docs/production/evidence/docker-encargo01'
New-Item -ItemType Directory -Force -Path $evidence | Out-Null
function Invoke-Docker([string[]]$Arguments) {
    $output = & $docker @Arguments 2>&1
    $code = $LASTEXITCODE
    $output | Out-File (Join-Path $evidence 'runtime.log') -Append -Encoding utf8
    "exit=$code command=$($Arguments[0])" | Out-File (Join-Path $evidence 'runtime.log') -Append -Encoding utf8
    if ($code -ne 0) { throw ($output -join "`n") }
    return $output
}
$context = (Invoke-Docker @('context','show') | Out-String).Trim()
$endpoint = (Invoke-Docker @('context','inspect',$context,'--format','{{.Endpoints.docker.Host}}') | Out-String).Trim()
if ($context -ne 'desktop-linux' -or $endpoint -ne 'npipe:////./pipe/dockerDesktopLinuxEngine') { throw 'Expected local Docker Desktop Linux named pipe; refusing mutation.' }
if ($Action -eq 'Provision') {
    # Never reuse an unidentified database or overwrite an existing resource.
    foreach ($resource in @(@('container',$name), @('network',$network), @('volume',$volume))) {
        & $docker $resource[0] inspect $resource[1] *> $null
        if ($LASTEXITCODE -eq 0) { throw "Resource already exists: $($resource[1]); refusing reuse." }
    }
    $image = (Invoke-Docker @('image','inspect','postgres:17.11-alpine','--format','{{index .RepoDigests 0}}') | Out-String).Trim()
    if ($image -notmatch '^postgres@sha256:[a-f0-9]{64}$') { throw 'Missing immutable official image digest.' }
    $image | Set-Content (Join-Path $evidence 'image.txt') -Encoding utf8
    Invoke-Docker @('network','create','--internal','--label','encargo=01',$network)
    Invoke-Docker @('volume','create','--label','encargo=01',$volume)
    # Secret stays in the disposable Docker volume (0600), never host env/repo/logs.
    $bootstrap = 'umask 077; if test -s /var/lib/postgresql/data/.encargo01-secret; then cat /var/lib/postgresql/data/.encargo01-secret > /tmp/pg-secret; else head -c 32 /dev/urandom | sha256sum | cut -d " " -f 1 > /tmp/pg-secret; fi; export POSTGRES_PASSWORD_FILE=/tmp/pg-secret; exec /usr/local/bin/docker-entrypoint.sh postgres'
    Invoke-Docker @('run','-d','--name',$name,'--label','encargo=01','--user','70:70','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges:true','--network',$network,'--memory','512m','--cpus','1','--pids-limit','128','--restart','no','--mount',"type=volume,source=$volume,target=/var/lib/postgresql/data",'--tmpfs','/tmp:rw,noexec,nosuid,size=16m','--tmpfs','/var/run/postgresql:rw,noexec,nosuid,size=8m,uid=70,gid=70','--env','POSTGRES_INITDB_ARGS=--auth-host=scram-sha-256 --auth-local=trust','--health-cmd','pg_isready -U postgres','--health-interval','2s','--health-retries','20','--health-timeout','2s',$image,'sh','-c',$bootstrap)
    for ($i=0; $i -lt 30; $i++) {
        $health = & $docker inspect $name --format '{{.State.Health.Status}}'
        if ($health -eq 'healthy') { break }
        Start-Sleep -Seconds 1
    }
    if ($health -ne 'healthy') { throw 'PostgreSQL did not become healthy; preserve logs and diagnose.' }
    Invoke-Docker @('exec',$name,'sh','-c','umask 077; cp /tmp/pg-secret /var/lib/postgresql/data/.encargo01-secret')
} elseif ($Action -eq 'Stop') {
    $label = (Invoke-Docker @('inspect',$name,'--format','{{index .Config.Labels "encargo"}}') | Out-String).Trim()
    if ($label -ne '01') { throw 'Ownership label mismatch.' }
    Invoke-Docker @('stop',$name)
} else {
    Invoke-Docker @('version')
    Invoke-Docker @('inspect',$name,'--format','{"state":{{json .State}},"user":{{json .Config.User}},"privileged":{{json .HostConfig.Privileged}},"readonly":{{json .HostConfig.ReadonlyRootfs}},"caps":{{json .HostConfig.CapDrop}},"security":{{json .HostConfig.SecurityOpt}},"ports":{{json .HostConfig.PortBindings}},"network":{{json .HostConfig.NetworkMode}},"mounts":{{json .Mounts}},"memory":{{.HostConfig.Memory}},"cpu":{{.HostConfig.NanoCpus}},"pids":{{.HostConfig.PidsLimit}}}') | Set-Content (Join-Path $evidence 'container.json') -Encoding utf8
    Invoke-Docker @('network','inspect',$network,'--format','{"internal":{{.Internal}},"driver":{{json .Driver}}}') | Set-Content (Join-Path $evidence 'network.json') -Encoding utf8
    Invoke-Docker @('exec',$name,'psql','-X','-U','postgres','-v','ON_ERROR_STOP=1','-Atc','SELECT version();')
}
