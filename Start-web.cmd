@echo off
setlocal DisableDelayedExpansion
set "JOVIAN_START_FILE=%~f0"
set "JOVIAN_START_PORT="
set "JOVIAN_START_CONFIG="
set "JOVIAN_START_CHECK="
:arguments
if "%~1"=="" goto launch
if /i "%~1"=="-CheckServices" (
    set "JOVIAN_START_CHECK=1"
    shift
    goto arguments
)
if /i "%~1"=="-WebPort" (
    if "%~2"=="" goto usage
    set "JOVIAN_START_PORT=%~2"
    shift
    shift
    goto arguments
)
if /i "%~1"=="-ServiceConfig" (
    if "%~2"=="" goto usage
    set "JOVIAN_START_CONFIG=%~2"
    shift
    shift
    goto arguments
)
:usage
echo Usage: Start-web.cmd [-WebPort port] [-ServiceConfig path ^| -CheckServices]
pause
exit /b 1
:launch
powershell.exe -NoLogo -NoProfile -Command "$script = [IO.File]::ReadAllText($env:JOVIAN_START_FILE) -split '(?m)^# Launcher script\r?$', 2; $options = @{}; if ($env:JOVIAN_START_PORT) { $options.WebPort = $env:JOVIAN_START_PORT }; if ($env:JOVIAN_START_CONFIG) { $options.ServiceConfig = $env:JOVIAN_START_CONFIG }; if ($env:JOVIAN_START_CHECK) { $options.CheckServices = $true }; & ([scriptblock]::Create($script[1])) @options"
set "JOVIAN_START_EXIT=%errorlevel%"
if not "%JOVIAN_START_EXIT%"=="0" pause
exit /b %JOVIAN_START_EXIT%

# Launcher script
param(
    [ValidateRange(1, 65535)]
    [int]$WebPort = 8081,
    [string]$ServiceConfig,
    [switch]$CheckServices
)

$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $env:JOVIAN_START_FILE
$started = @()
$exitCode = 0

function Find-FreePort([int[]]$candidates, [string]$name) {
    $listeners = [Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners()
    $taken = @($listeners | ForEach-Object { $_.Port })
    foreach ($candidate in $candidates) {
        if ($candidate -notin $taken) { return $candidate }
    }
    throw "All ports for $name are in use ($($candidates -join ', '))."
}

function Wait-JovianService($service, $process) {
    $deadline = [DateTime]::UtcNow.AddSeconds(45)
    $method = if ($service.Probe -eq '/fortune/time') { 'Get' } else { 'Options' }
    $expectedStatus = if ($method -eq 'Get') { 200 } else { 204 }
    $url = "http://127.0.0.1:$($service.Port)$($service.Probe)"
    while (!$process.HasExited -and [DateTime]::UtcNow -lt $deadline) {
        try {
            $reply = Invoke-WebRequest -Uri $url -Method $method -UseBasicParsing -Headers @{ Origin = $webOrigin } -TimeoutSec 2
            if ($reply.StatusCode -eq $expectedStatus -and $reply.Headers['Access-Control-Allow-Origin'] -eq $webOrigin) {
                Write-Host "$($service.Name) ready at http://localhost:$($service.Port)"
                return
            }
        } catch {
            # The server may not have opened its listener yet.
        }
        Start-Sleep -Milliseconds 250
    }
    throw "$($service.Name) did not start. See $($service.ErrorLog)."
}

Push-Location -LiteralPath $project
try {
    $flutter = Join-Path $project '.local\flutter-toolchain\flutter\bin\flutter.bat'
    if (!$CheckServices -and !(Test-Path -LiteralPath $flutter -PathType Leaf)) {
        $flutter = Get-Command flutter -CommandType Application -ErrorAction Stop | Select-Object -First 1 -ExpandProperty Source
    }
    if ($CheckServices -and $ServiceConfig) {
        throw '-CheckServices checks the local services started by this launcher.'
    }
    $picked = if ($PSBoundParameters.ContainsKey('WebPort') -or $ServiceConfig) {
        Find-FreePort @($WebPort) 'Flutter Web'
    } else {
        Find-FreePort @(8081, 8082, 8083, 8084, 8085) 'Flutter Web'
    }
    $webOrigin = "http://localhost:$picked"

    if ($ServiceConfig) {
        $config = (Resolve-Path -LiteralPath $ServiceConfig).Path
    } else {
        $legacy = (Resolve-Path -LiteralPath (Join-Path $project '..\app')).Path
        $node = Get-Command node.exe -CommandType Application -ErrorAction Stop | Select-Object -First 1 -ExpandProperty Source
        $versionOutput = & $node --version
        if ($LASTEXITCODE -ne 0 -or $versionOutput -notmatch '^v(\d+\.\d+\.\d+)') {
            throw 'Could not determine the installed Node.js version.'
        }
        $nodeVersion = [version]$Matches[1]
        if ($nodeVersion -lt [version]'22.13.0') { throw 'Node.js 22.13 or newer is required.' }

        $nodeRoot = $env:JOVIAN_LEGACY_NODE_ROOT
        if (!$nodeRoot) {
            $nodeRoot = @($legacy, 'E:\app') |
                Where-Object { Test-Path -LiteralPath (Join-Path $_ 'node_modules') -PathType Container } |
                Select-Object -First 1
        }
        if (!$nodeRoot -or !(Test-Path -LiteralPath (Join-Path $nodeRoot 'node_modules') -PathType Container)) {
            throw 'Install the original Node dependencies or set JOVIAN_LEGACY_NODE_ROOT to their checkout.'
        }
        $nodeRoot = (Resolve-Path -LiteralPath $nodeRoot).Path
        if ($nodeRoot -ne $legacy -and $nodeVersion -lt [version]'22.15.0') {
            throw 'Node.js 22.15 or newer is required to use dependencies from another checkout.'
        }

        $services = @(
            @{ Name='Account'; Key='ACCOUNT_API_URL'; Env='APP_ACCOUNT_PORT'; Ports=@(8787,8801,8803,8805)
               File='src/features/account/server/index.mjs'; Probe='/account/session' },
            @{ Name='Divination'; Key='DIVINATION_REPORT_URL'; Env='DIVINATION_REPORT_PORT'; Ports=@(8115,8117,8120)
               File='src/features/divination/server/index.mjs'; Probe='/reading/report' },
            @{ Name='Destiny'; Key='DESTINY_REPORT_URL'; Env='DESTINY_PORT'; Ports=@(8788,8790,8799,8807)
               File='src/features/destiny/server/index.mjs'; Probe='/destiny/report' },
            @{ Name='Fortune'; Key='FORTUNE_TIME_URL'; Env='FORTUNE_TIME_PORT'; Ports=@(8791,8794,8809,8811)
               File='src/features/fortune/server/index.mjs'; Probe='/fortune/time' },
            @{ Name='Synastry'; Key='SYNASTRY_REPORT_URL'; Env='SYNASTRY_PORT'; Ports=@(8812,8813,8814,8815)
               File='src/features/synastry/server/summary.mjs'; Probe='/synastry/summary' }
        )
        $runDirectory = Join-Path $project ('.local\start-web\' + [guid]::NewGuid().ToString('N'))
        $null = New-Item -ItemType Directory -Path $runDirectory
        $defines = @{}
        foreach ($service in $services) {
            $service.Port = Find-FreePort $service.Ports $service.Name
            if (!(Test-Path -LiteralPath (Join-Path $legacy $service.File) -PathType Leaf)) {
                throw "The original $($service.Name) entry is missing in $legacy."
            }
            $service.ErrorLog = Join-Path $runDirectory "$($service.Name).stderr.log"
            [Environment]::SetEnvironmentVariable($service.Env, [string]$service.Port, 'Process')
            $defines[$service.Key] = "http://localhost:$($service.Port)"
        }

        $env:APP_ACCOUNT_HOST = '127.0.0.1'
        $env:APP_WEB_ORIGIN = $webOrigin
        $env:APP_ACCOUNT_ISOLATE_WEB_SESSION = if ($picked -eq 8081) { '0' } else { '1' }
        $env:DIVINATION_REPORT_BIND = '127.0.0.1'
        $env:DIVINATION_REPORT_WEB_ORIGIN = $webOrigin
        $env:DIVINATION_REPORT_HOSTS = "localhost:$env:DIVINATION_REPORT_PORT,127.0.0.1:$env:DIVINATION_REPORT_PORT"
        $env:DESTINY_HOST = '127.0.0.1'
        $env:DESTINY_ALLOWED_ORIGINS = $webOrigin
        $env:FORTUNE_ACCOUNT_BASE_URL = "http://127.0.0.1:$env:APP_ACCOUNT_PORT"
        if (!$env:FORTUNE_FACT_DIRECTORY) {
            $env:FORTUNE_FACT_DIRECTORY = Join-Path $legacy '.local\fortune'
        }

        $provider = ([string]$env:APP_LOCAL_AUTH_PROVIDER_PATH).Trim()
        if (!$provider) {
            $provider = @((Join-Path $legacy '..\virtual-auth-provider\provider.mjs'), 'E:\virtual-auth-provider\provider.mjs') |
                Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
        }
        if ($provider) {
            $env:APP_LOCAL_AUTH_PROVIDER_PATH = (Resolve-Path -LiteralPath $provider).Path
            $env:NODE_ENV = 'development'
            $env:APP_PHONE_CODES = 'local'
        } else {
            $env:NODE_ENV = 'production'
            $env:APP_PHONE_CODES = 'off'
        }
        if (!$env:DEEPSEEK_API_KEY -and !$env:DEEPSEEK_API_KEY_FILE -and
            (Test-Path -LiteralPath 'E:\deepseek\deepseek api.txt' -PathType Leaf)) {
            $env:DEEPSEEK_API_KEY_FILE = 'E:\deepseek\deepseek api.txt'
        }
        if (!$env:DEEPSEEK_API_KEY -and !$env:DEEPSEEK_API_KEY_FILE) {
            Write-Warning 'DeepSeek is unconfigured. Online reports need an existing key or key file.'
        }

        $env:JOVIAN_LEGACY_NODE_ROOT = $nodeRoot
        $env:JOVIAN_WEB_NODE_FALLBACK = if ($nodeRoot -ne $legacy) { $nodeRoot } else { $null }
        $watchdog = @'
import * as nodeModule from 'node:module';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const fallback = process.env.JOVIAN_WEB_NODE_FALLBACK;
if (fallback) {
    const owner = pathToFileURL(join(fallback, 'package.json')).href;
    nodeModule.registerHooks({ resolve(specifier, context, next) {
        try {
            return next(specifier, context);
        } catch (error) {
            if (error.code !== 'ERR_MODULE_NOT_FOUND' || !/^(?:@[^/]+\/)?[a-zA-Z0-9][^:\\]*$/.test(specifier)) throw error;
            return next(specifier, { ...context, parentURL: owner });
        }
    } });
}

const parent = process.ppid;
setInterval(() => {
    try {
        process.kill(parent, 0);
    } catch (error) {
        if (error.code === 'ESRCH') process.exit(0);
    }
}, 1000).unref();
'@
        $preload = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($watchdog))
        foreach ($service in $services) {
            $processOptions = @{
                FilePath = $node
                ArgumentList = @("--import=data:text/javascript;base64,$preload", '--experimental-strip-types', $service.File)
                WorkingDirectory = $legacy
                WindowStyle = 'Hidden'
                RedirectStandardOutput = Join-Path $runDirectory "$($service.Name).stdout.log"
                RedirectStandardError = $service.ErrorLog
                PassThru = $true
            }
            $started += Start-Process @processOptions
        }
        for ($index = 0; $index -lt $services.Count; $index++) {
            Wait-JovianService $services[$index] $started[$index]
        }
        if ($provider) {
            $capabilities = Invoke-RestMethod -Uri "http://127.0.0.1:$env:APP_ACCOUNT_PORT/account/auth/capabilities" -TimeoutSec 3
            if ($capabilities.localSocialProviders) {
                Write-Host 'Virtual authentication provider ready.'
            } else {
                Write-Warning 'The account service did not load the virtual authentication provider.'
            }
        }

        $config = Join-Path $runDirectory 'services.json'
        [IO.File]::WriteAllText($config, ($defines | ConvertTo-Json))
        if (!$CheckServices -and !(Test-Path -LiteralPath 'web/legacy-compute.js' -PathType Leaf)) {
            & $node 'tool/legacy_compute/build.mjs'
            if ($LASTEXITCODE -ne 0) { throw 'Could not prepare the original TypeScript chart assets.' }
        }
    }

    if (!$CheckServices) {
        Write-Host "Starting Flutter Web at $webOrigin. Keep this window open."
        & $flutter run -d chrome --release --no-pub --web-hostname localhost --web-port $picked --target src/app/main.dart "--dart-define-from-file=$config"
        $exitCode = $LASTEXITCODE
    }
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    $exitCode = 1
} finally {
    foreach ($process in $started) {
        if (!$process.HasExited) { Stop-Process -InputObject $process -ErrorAction SilentlyContinue }
    }
    Pop-Location
}
exit $exitCode
