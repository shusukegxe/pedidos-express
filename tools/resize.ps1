Add-Type -AssemblyName System.Drawing
$dir = 'C:\Users\etc\Desktop\prototipo-pedidos\assets'
Get-ChildItem $dir -Filter *.png | ForEach-Object {
  $img = [System.Drawing.Image]::FromFile($_.FullName)
  $max = 420.0
  $r = $max / [Math]::Max($img.Width, $img.Height)
  if ($r -gt 1) { $r = 1 }
  $w = [int]($img.Width * $r)
  $h = [int]($img.Height * $r)
  $bmp = New-Object System.Drawing.Bitmap($w, $h)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($img, 0, 0, $w, $h)
  $tmp = Join-Path $dir ($_.BaseName + '.opt.png')
  $bmp.Save($tmp, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
  $img.Dispose()
  Move-Item -Force $tmp $_.FullName
  Write-Host ("{0} -> {1}x{2}" -f $_.Name, $w, $h)
}
