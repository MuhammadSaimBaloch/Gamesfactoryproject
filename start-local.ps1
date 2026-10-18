$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    $runtimeRoot = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies'
    $nodeDirectory = Join-Path $runtimeRoot 'node\bin'
    $pnpmDirectory = Join-Path $runtimeRoot 'bin\fallback'
    if (-not (Test-Path -LiteralPath (Join-Path $nodeDirectory 'node.exe'))) {
        throw 'Install Node.js 24 and pnpm 11, then run this script again. See README.md.'
    }
    $env:PATH = "$nodeDirectory;$pnpmDirectory;" + $env:PATH
}
pnpm dev
