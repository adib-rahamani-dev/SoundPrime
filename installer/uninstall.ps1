param([switch]$Quiet)
$ErrorActionPreference = 'Stop'
try {
    if (Get-Process 'Adobe Premiere Pro' -ErrorAction SilentlyContinue) { throw 'Close Premiere Pro before uninstalling.' }
    $cepRoot = [IO.Path]::GetFullPath((Join-Path $env:APPDATA 'Adobe\CEP\extensions'))
    $target = [IO.Path]::GetFullPath((Join-Path $cepRoot 'ir.oteener.soundprime'))
    if ([IO.Path]::GetDirectoryName($target) -ne $cepRoot -or [IO.Path]::GetFileName($target) -ne 'ir.oteener.soundprime') { throw 'Unexpected extension path.' }
    if (Test-Path -LiteralPath $target) {
        Get-CimInstance Win32_Process -Filter "Name='SoundPrime.Hotkeys.exe'" | Where-Object { $_.ExecutablePath -eq (Join-Path $target 'bin\SoundPrime.Hotkeys.exe') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
        Remove-Item -LiteralPath $target -Recurse -Force
    }
    $record = Join-Path $env:APPDATA 'Oteener\SoundPrime\install.json'
    $registryPath = 'HKCU:\Software\Adobe\CSXS.11'
    if (Test-Path -LiteralPath $record) {
        $old = Get-Content -LiteralPath $record -Raw | ConvertFrom-Json
        $current = Get-ItemProperty -LiteralPath $registryPath -Name PlayerDebugMode -ErrorAction SilentlyContinue
        if ($current -and [string]$current.PlayerDebugMode -eq '1') {
            if ($old.debugModeExisted) { New-ItemProperty -Path $registryPath -Name PlayerDebugMode -Value $old.debugModeValue -PropertyType $old.debugModeKind -Force | Out-Null }
            else { Remove-ItemProperty -LiteralPath $registryPath -Name PlayerDebugMode }
        }
        Remove-Item -LiteralPath $record -Force
    }
    Write-Host 'Oteener Sound Design removed. Your sound bank and audio files were kept.' -ForegroundColor Yellow
    if (-not $Quiet) { Read-Host 'Press Enter to finish' | Out-Null }
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    if (-not $Quiet) { Read-Host 'Press Enter to close' | Out-Null }
    exit 1
}
