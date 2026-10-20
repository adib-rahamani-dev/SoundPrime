$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$dist = Join-Path $projectRoot 'dist'
$compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
if (-not (Test-Path -LiteralPath $compiler)) { $compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe' }
New-Item -ItemType Directory -Path (Join-Path $projectRoot 'extension\bin') -Force | Out-Null
& $compiler /nologo /target:winexe /optimize+ ('/out:' + (Join-Path $projectRoot 'extension\bin\SoundPrime.Hotkeys.exe')) /reference:System.Windows.Forms.dll (Join-Path $projectRoot 'extension\native\HotkeyHost.cs')
if ($LASTEXITCODE -ne 0) { throw 'Compilation failed.' }
New-Item -ItemType Directory -Path $dist -Force | Out-Null
$stage = Join-Path $dist ('package-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stage | Out-Null
foreach ($item in @('extension','installer','docs','Install.cmd','Uninstall.cmd','README.md','LICENSE')) {
    Copy-Item -LiteralPath (Join-Path $projectRoot $item) -Destination $stage -Recurse -Force
}
$zip = Join-Path $dist 'SoundPrime-1.0.0-Windows.zip'
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip -Force
# Only remove the verified staging directory created by this invocation.
$resolvedStage = [IO.Path]::GetFullPath($stage)
if ([IO.Path]::GetDirectoryName($resolvedStage) -ne [IO.Path]::GetFullPath($dist) -or [IO.Path]::GetFileName($resolvedStage) -notmatch '^package-[a-f0-9]{32}$') { throw 'Unexpected staging path.' }
Remove-Item -LiteralPath $resolvedStage -Recurse -Force
$hashStream = [IO.File]::OpenRead($zip)
try { $hash = [Security.Cryptography.SHA256]::Create(); Write-Host ('SHA256: ' + ([BitConverter]::ToString($hash.ComputeHash($hashStream))).Replace('-', '').ToLowerInvariant()) }
finally { $hashStream.Dispose(); if ($hash) { $hash.Dispose() } }
Write-Host "Built: $zip"
