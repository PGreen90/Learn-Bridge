# Genererar public/og-image.jpg (1200x630) - lankforhandsvisningen som
# Messenger/WhatsApp/Discord visar nar nagon delar en rebidz-lank (og:image
# i index.html). Ritas med System.Drawing (finns i Windows) i appens
# formsprak: mork smaragd, guldspader, ordmarket med guld-"bid" och taglinen.
# Georgia ar medvetet vald: det ar varumarkesserifens reservtypsnitt i
# src/index.css (--font-brand: 'Fraunces Variable', Georgia, ...).
#
# Kor om vid behov:  powershell -File scripts/generate-og-image.ps1
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$w = 1200; $h = 630
$bmp = New-Object System.Drawing.Bitmap($w, $h)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.TextRenderingHint = 'AntiAliasGridFit'

# Bakgrund: mork smaragd, ljusast pa mitten (tva staplade gradienter)
$bgRect = New-Object System.Drawing.Rectangle(0, 0, $w, $h)
$bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  $bgRect,
  [System.Drawing.Color]::FromArgb(7, 18, 14),
  [System.Drawing.Color]::FromArgb(5, 42, 31),
  [System.Drawing.Drawing2D.LinearGradientMode]::Vertical)
$mitten = New-Object System.Drawing.Drawing2D.ColorBlend
$mitten.Colors = @(
  [System.Drawing.Color]::FromArgb(7, 18, 14),
  [System.Drawing.Color]::FromArgb(10, 59, 44),
  [System.Drawing.Color]::FromArgb(5, 42, 31))
$mitten.Positions = @(0.0, 0.5, 1.0)
$bg.InterpolationColors = $mitten
$g.FillRectangle($bg, $bgRect)

# Mjuk guldglod bakom spadern
$glowPath = New-Object System.Drawing.Drawing2D.GraphicsPath
$glowPath.AddEllipse(180, -180, 840, 840)
$glow = New-Object System.Drawing.Drawing2D.PathGradientBrush($glowPath)
$glow.CenterColor = [System.Drawing.Color]::FromArgb(40, 217, 181, 86)
$glow.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 217, 181, 86))
$g.FillPath($glow, $glowPath)

# Guldpensel (vertikal gradient ljus -> mork guld, appens gold-200 -> gold-600)
function New-GoldBrush([int]$y0, [int]$y1) {
  $r = New-Object System.Drawing.Rectangle(0, $y0, $w, ($y1 - $y0))
  $b = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    $r,
    [System.Drawing.Color]::FromArgb(243, 228, 179),
    [System.Drawing.Color]::FromArgb(161, 124, 36),
    [System.Drawing.Drawing2D.LinearGradientMode]::Vertical)
  return $b
}

$vit = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(248, 250, 252))
$vitSvag = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(210, 248, 250, 252))
$vitSvagare = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(128, 248, 250, 252))

# Spadern (Segoe UI Symbol har glyfen)
$fSpade = New-Object System.Drawing.Font('Segoe UI Symbol', 100, 'Regular', 'Point')
$fmt = New-Object System.Drawing.StringFormat
$fmt.Alignment = 'Center'
$g.DrawString([char]0x2660, $fSpade, (New-GoldBrush 40 220), 600, 40, $fmt)

# Ordmarket: re (vitt) + bid (guld) + z (vitt), Georgia fet
$fBrand = New-Object System.Drawing.Font('Georgia', 105, 'Bold', 'Point')
$szRe = $g.MeasureString('re', $fBrand)
$szBid = $g.MeasureString('bid', $fBrand)
$szZ = $g.MeasureString('z', $fBrand)
# MeasureString raknar med luft pa bada sidor - overlappa darfor nagot
$overlap = 42
$total = $szRe.Width + $szBid.Width + $szZ.Width - 2 * $overlap
$x = 600 - $total / 2
$y = 235
$g.DrawString('re', $fBrand, $vit, $x, $y)
$x += $szRe.Width - $overlap
$g.DrawString('bid', $fBrand, (New-GoldBrush ($y + 40) ($y + 190)), $x, $y)
$x += $szBid.Width - $overlap
$g.DrawString('z', $fBrand, $vit, $x, $y)

# Guldharlinjen (tonar ut at bada hall)
$lineRect = New-Object System.Drawing.Rectangle(420, 462, 360, 2)
$line = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
  $lineRect,
  [System.Drawing.Color]::FromArgb(0, 217, 181, 86),
  [System.Drawing.Color]::FromArgb(0, 217, 181, 86),
  [System.Drawing.Drawing2D.LinearGradientMode]::Horizontal)
$lineBlend = New-Object System.Drawing.Drawing2D.ColorBlend
$lineBlend.Colors = @(
  [System.Drawing.Color]::FromArgb(0, 217, 181, 86),
  [System.Drawing.Color]::FromArgb(230, 217, 181, 86),
  [System.Drawing.Color]::FromArgb(0, 217, 181, 86))
$lineBlend.Positions = @(0.0, 0.5, 1.0)
$line.InterpolationColors = $lineBlend
$g.FillRectangle($line, $lineRect)

# Taglinen + domanen. a-med-prickar byggs ur teckenkoden (0x00E4) sa att
# skriptet inte ar beroende av vilken teckenkodning PowerShell laser filen med.
$ae = [char]0x00E4
$fTag = New-Object System.Drawing.Font('Segoe UI', 30, 'Regular', 'Point')
$g.DrawString("Tr${ae}na, spela, t${ae}vla", $fTag, $vitSvag, 600, 490, $fmt)
$fDom = New-Object System.Drawing.Font('Segoe UI', 20, 'Regular', 'Point')
$g.DrawString('rebidz.com', $fDom, $vitSvagare, 600, 560, $fmt)

# Spara som JPEG (kvalitet 90) - gradienter blir sma i JPEG, stora i PNG
$enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
  Where-Object { $_.MimeType -eq 'image/jpeg' }
$encParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
$encParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
  [System.Drawing.Imaging.Encoder]::Quality, [long]90)
$out = Join-Path $PSScriptRoot '..\public\og-image.jpg'
$bmp.Save($out, $enc, $encParams)
$g.Dispose(); $bmp.Dispose()
Write-Host "Skrev $out ($([math]::Round((Get-Item $out).Length / 1KB)) kB)"
