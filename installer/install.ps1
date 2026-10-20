param([switch]$Quiet)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$extensionSource = Join-Path $projectRoot 'extension'
$extensionTarget = Join-Path $env:APPDATA 'Adobe\CEP\extensions\ir.oteener.soundprime'
$settingsDir = Join-Path $env:APPDATA 'Oteener\SoundPrime'
$registryPath = 'HKCU:\Software\Adobe\CSXS.11'
try {
    if (-not (Test-Path -LiteralPath (Join-Path $extensionSource 'CSXS\manifest.xml'))) { throw 'Extension files are missing. Extract the entire ZIP first.' }
    if (Get-Process 'Adobe Premiere Pro' -ErrorAction SilentlyContinue) { throw 'Close Premiere Pro before installing, then run Install.cmd again.' }
    $compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
    if (-not (Test-Path -LiteralPath $compiler)) { $compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe' }
    if (-not (Test-Path -LiteralPath $compiler)) { throw 'Windows .NET Framework 4.x compiler was not found. Enable .NET Framework 4.8 in Windows.' }
    New-Item -ItemType Directory -Force -Path (Join-Path $extensionSource 'bin') | Out-Null
    $exe = Join-Path $extensionSource 'bin\SoundPrime.Hotkeys.exe'
    & $compiler /nologo /target:winexe /optimize+ "/out:$exe" /reference:System.Windows.Forms.dll (Join-Path $extensionSource 'native\HotkeyHost.cs')
    if ($LASTEXITCODE -ne 0) { throw 'Hotkey companion compilation failed.' }
    New-Item -ItemType Directory -Force -Path $settingsDir | Out-Null
    $installRecord = Join-Path $settingsDir 'install.json'
    if (-not (Test-Path -LiteralPath $installRecord)) {
        $oldValue = Get-ItemProperty -LiteralPath $registryPath -Name PlayerDebugMode -ErrorAction SilentlyContinue
        @{ schema = 1; debugModeExisted = ($null -ne $oldValue); debugModeValue = $(if ($oldValue) { $oldValue.PlayerDebugMode } else { $null }); debugModeKind = $(if ($oldValue) { (Get-Item -LiteralPath $registryPath).GetValueKind('PlayerDebugMode').ToString() } else { 'String' }) } | ConvertTo-Json | Set-Content -LiteralPath $installRecord -Encoding UTF8
    }
    if (Test-Path -LiteralPath $extensionTarget) {
        Get-CimInstance Win32_Process -Filter "Name='SoundPrime.Hotkeys.exe'" | Where-Object { $_.ExecutablePath -eq (Join-Path $extensionTarget 'bin\SoundPrime.Hotkeys.exe') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
        $backupDir = Join-Path $settingsDir ('backups\extension-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff'))
        New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
        Copy-Item -LiteralPath $extensionTarget -Destination $backupDir -Recurse -Force
    }
    New-Item -ItemType Directory -Force -Path $extensionTarget | Out-Null
    Get-ChildItem -LiteralPath $extensionSource | Copy-Item -Destination $extensionTarget -Recurse -Force
    # This is an unsigned development CEP extension. Enable only the required per-user CEP runtime.
    New-Item -Path $registryPath -Force | Out-Null
    New-ItemProperty -Path $registryPath -Name PlayerDebugMode -PropertyType String -Value '1' -Force | Out-Null
    Write-Host ''
    Write-Host 'OTINER installed successfully.' -ForegroundColor Yellow
    Write-Host 'Open Premiere Pro 2024 > Window > Extensions > OTINER.'
    Write-Host "Installed at: $extensionTarget"
    Write-Host 'This unsigned CEP panel uses per-user CSXS.11 PlayerDebugMode=1.'
    Write-Host 'No administrator rights, network downloads, or Windows startup entries are needed.'
    if (-not $Quiet) { Read-Host 'Press Enter to finish' | Out-Null }
} catch {
    Write-Host "Installation failed: $($_.Exception.Message)" -ForegroundColor Red
    if (-not $Quiet) { Read-Host 'Press Enter to close' | Out-Null }
    exit 1
}
