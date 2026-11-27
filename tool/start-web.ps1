param(
    [ValidateRange(1, 65535)]
    [int]$WebPort = 8081,
    [string]$ServiceConfig = 'config/local-web.example.json'
)

$ErrorActionPreference = 'Stop'
Push-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
try {
    $flutter = '.\.local\flutter-toolchain\flutter\bin\flutter.bat'
    if (!(Test-Path -LiteralPath $flutter -PathType Leaf)) {
        $flutter = (Get-Command flutter -CommandType Application -ErrorAction Stop).Source
    }
    $config = (Resolve-Path -LiteralPath $ServiceConfig -ErrorAction Stop).Path
    & $flutter run -d chrome --release --no-pub --web-hostname localhost --web-port $WebPort --target src/app/main.dart "--dart-define-from-file=$config"
    exit $LASTEXITCODE
} finally {
    Pop-Location
}
