param([string]$InputFile,[string]$OutputDirectory)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$lines = Get-Content -LiteralPath $InputFile -Raw -Encoding UTF8 | ConvertFrom-Json
$speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
  $speaker.SelectVoice('Microsoft Heami Desktop')
  $speaker.Rate = 1
  for ($i=0; $i -lt $lines.Count; $i++) {
    $speaker.SetOutputToWaveFile((Join-Path $OutputDirectory "$i.wav"))
    $speaker.Speak([string]$lines[$i])
    $speaker.SetOutputToNull()
  }
} finally { $speaker.Dispose() }
