# RuneLuck Auto-Update v2
$dl = "$HOME\Downloads\runeluck-update"
$rl = "C:\Users\deniz\Desktop\runeluck"

# Find latest zip and extract
$zip = Get-ChildItem "$HOME\Downloads\files*.zip" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if ($zip) {
    Write-Host "Extracting $($zip.Name)..." -ForegroundColor Yellow
    Expand-Archive $zip.FullName $dl -Force
}

# Map files to destinations
$map = @{
    "build.js"       = "js\build.js"
    "style.css"      = "css\style.css"
    "manifest.json"  = "models\manifest.json"
    "furniture.js"   = "js\furniture.js"
    "environment.js" = "js\environment.js"
    "npcs.js"        = "js\npcs.js"
    "slots-game.js"  = "js\slots-game.js"
    "index.html"     = "index.html"
    "slots.html"     = "slots.html"
    "update.ps1"     = "update.ps1"
}

# Copy from Downloads (loose files)
foreach ($f in $map.Keys) {
    $src = Join-Path "$HOME\Downloads" $f
    $dst = Join-Path $rl $map[$f]
    if (Test-Path $src) {
        Copy-Item $src $dst -Force
        Write-Host "OK  $f -> $($map[$f])" -ForegroundColor Green
    }
}

# Copy from extracted zip
if (Test-Path $dl) {
    Get-ChildItem $dl -Recurse -File | ForEach-Object {
        if ($map.ContainsKey($_.Name)) {
            $dst = Join-Path $rl $map[$_.Name]
            Copy-Item $_.FullName $dst -Force
            Write-Host "OK  $($_.Name) -> $($map[$_.Name]) (from zip)" -ForegroundColor Green
        }
    }
}

Write-Host "`nDone! Refresh localhost:3000" -ForegroundColor Cyan
