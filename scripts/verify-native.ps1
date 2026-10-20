$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
New-Item -ItemType Directory -Force -Path (Join-Path $projectRoot 'artifacts') | Out-Null
$testExe = Join-Path $projectRoot 'artifacts\NativeSmoke.exe'
& $compiler /nologo /target:exe "/out:$testExe" (Join-Path $projectRoot 'tests\NativeSmoke.cs')
if ($LASTEXITCODE -ne 0) { throw 'Test compilation failed.' }
& $testExe (Join-Path $projectRoot 'extension\bin\SoundPrime.Hotkeys.exe')
if ($LASTEXITCODE -ne 0) { throw 'Native smoke failed.' }
