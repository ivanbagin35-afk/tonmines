# Скрипт для создания бэкапа проекта TON Mines
# Использование: .\scripts\backup.ps1

$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$backupDir = "backups"
$backupName = "tonmines_backup_$timestamp"

Write-Host "Создание бэкапа проекта TON Mines..." -ForegroundColor Green

# Создаем директорию для бэкапов
if (-not (Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir | Out-Null
}

$backupPath = Join-Path $backupDir $backupName
New-Item -ItemType Directory -Path $backupPath | Out-Null

Write-Host "Копирование файлов..." -ForegroundColor Yellow

# Бэкап backend
Write-Host "  - Backend данные..." -ForegroundColor Cyan
if (Test-Path "backend\data") {
    Copy-Item -Path "backend\data" -Destination "$backupPath\backend_data" -Recurse -Force
}

# Бэкап backend logs
Write-Host "  - Backend логи..." -ForegroundColor Cyan
if (Test-Path "backend\logs") {
    Copy-Item -Path "backend\logs" -Destination "$backupPath\backend_logs" -Recurse -Force
}

# Бэкап backend dist (скомпилированный код)
Write-Host "  - Backend dist..." -ForegroundColor Cyan
if (Test-Path "backend\dist") {
    Copy-Item -Path "backend\dist" -Destination "$backupPath\backend_dist" -Recurse -Force
}

# Бэкап backend package.json и конфигов
Write-Host "  - Backend конфиги..." -ForegroundColor Cyan
$backendConfigs = @("backend\package.json", "backend\package-lock.json", "backend\tsconfig.json")
foreach ($config in $backendConfigs) {
    if (Test-Path $config) {
        Copy-Item -Path $config -Destination "$backupPath\" -Force
    }
}

# Бэкап frontend build (если есть)
Write-Host "  - Frontend build..." -ForegroundColor Cyan
if (Test-Path "frontend\dist") {
    Copy-Item -Path "frontend\dist" -Destination "$backupPath\frontend_dist" -Recurse -Force
}

# Бэкап frontend конфигов
Write-Host "  - Frontend конфиги..." -ForegroundColor Cyan
$frontendConfigs = @("frontend\package.json", "frontend\package-lock.json", "frontend\vite.config.ts", "frontend\tsconfig.json")
foreach ($config in $frontendConfigs) {
    if (Test-Path $config) {
        Copy-Item -Path $config -Destination "$backupPath\" -Force
    }
}

# Бэкап .env файлов (если есть)
Write-Host "  - Environment файлы..." -ForegroundColor Cyan
$envFiles = Get-ChildItem -Path . -Filter ".env*" -Recurse -ErrorAction SilentlyContinue
foreach ($envFile in $envFiles) {
    $relativePath = $envFile.FullName.Replace((Get-Location).Path + "\", "")
    $destPath = Join-Path $backupPath $relativePath
    $destDir = Split-Path $destPath -Parent
    if (-not (Test-Path $destDir)) {
        New-Item -ItemType Directory -Path $destDir | Out-Null
    }
    Copy-Item -Path $envFile.FullName -Destination $destPath -Force
}

# Создаем архив
Write-Host "Создание архива..." -ForegroundColor Yellow
$zipPath = "$backupPath.zip"
Compress-Archive -Path $backupPath -DestinationPath $zipPath -Force

# Удаляем временную папку
Remove-Item -Path $backupPath -Recurse -Force

$zipSize = (Get-Item $zipPath).Length / 1MB
Write-Host "`nБэкап создан успешно!" -ForegroundColor Green
Write-Host "  Путь: $zipPath" -ForegroundColor Cyan
Write-Host "  Размер: $([math]::Round($zipSize, 2)) MB" -ForegroundColor Cyan
Write-Host "`nДля восстановления распакуйте архив и скопируйте файлы обратно." -ForegroundColor Yellow


