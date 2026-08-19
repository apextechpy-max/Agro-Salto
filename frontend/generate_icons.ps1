Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\carlo\.gemini\antigravity-ide\scratch\Agro-Salto-1\frontend\src\assets\medallon_final.png"
$resBase = "C:\Users\carlo\.gemini\antigravity-ide\scratch\Agro-Salto-1\frontend\android\app\src\main\res"

$srcImage = [System.Drawing.Image]::FromFile($srcPath)

$configs = @(
    @{ Folder = "mipmap-mdpi"; Size = 48; ForeSize = 108; SafeSize = 72 },
    @{ Folder = "mipmap-hdpi"; Size = 72; ForeSize = 162; SafeSize = 108 },
    @{ Folder = "mipmap-xhdpi"; Size = 96; ForeSize = 216; SafeSize = 144 },
    @{ Folder = "mipmap-xxhdpi"; Size = 144; ForeSize = 324; SafeSize = 216 },
    @{ Folder = "mipmap-xxxhdpi"; Size = 192; ForeSize = 432; SafeSize = 288 }
)

foreach ($cfg in $configs) {
    $targetDir = Join-Path $resBase $cfg.Folder
    if (!(Test-Path $targetDir)) { New-Item -ItemType Directory -Path $targetDir -Force }

    # 1. ic_launcher.png & ic_launcher_round.png
    $bmp = New-Object System.Drawing.Bitmap $cfg.Size, $cfg.Size
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.DrawImage($srcImage, 0, 0, $cfg.Size, $cfg.Size)
    $g.Dispose()

    $bmp.Save((Join-Path $targetDir "ic_launcher.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Save((Join-Path $targetDir "ic_launcher_round.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()

    # 2. ic_launcher_foreground.png (Adaptive Icon with safe zone padding)
    $bmpFore = New-Object System.Drawing.Bitmap $cfg.ForeSize, $cfg.ForeSize
    $gFore = [System.Drawing.Graphics]::FromImage($bmpFore)
    $gFore.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $gFore.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $gFore.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $gFore.Clear([System.Drawing.Color]::Transparent)

    $offset = [int](($cfg.ForeSize - $cfg.SafeSize) / 2)
    $gFore.DrawImage($srcImage, $offset, $offset, $cfg.SafeSize, $cfg.SafeSize)
    $gFore.Dispose()

    $bmpFore.Save((Join-Path $targetDir "ic_launcher_foreground.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $bmpFore.Dispose()
}

$srcImage.Dispose()
Write-Host "Icons generated successfully!"
