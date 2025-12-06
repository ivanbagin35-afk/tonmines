#!/bin/bash
# Скрипт для создания бэкапа проекта TON Mines
# Использование: bash scripts/backup.sh

set -e

TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_DIR="backups"
BACKUP_NAME="tonmines_backup_$TIMESTAMP"

echo "Создание бэкапа проекта TON Mines..."

# Создаем директорию для бэкапов
mkdir -p "$BACKUP_DIR"
BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"
mkdir -p "$BACKUP_PATH"

echo "Копирование файлов..."

# Бэкап backend
echo "  - Backend данные..."
if [ -d "backend/data" ]; then
    cp -r backend/data "$BACKUP_PATH/backend_data"
fi

# Бэкап backend logs
echo "  - Backend логи..."
if [ -d "backend/logs" ]; then
    cp -r backend/logs "$BACKUP_PATH/backend_logs"
fi

# Бэкап backend dist
echo "  - Backend dist..."
if [ -d "backend/dist" ]; then
    cp -r backend/dist "$BACKUP_PATH/backend_dist"
fi

# Бэкап backend конфигов
echo "  - Backend конфиги..."
[ -f "backend/package.json" ] && cp backend/package.json "$BACKUP_PATH/"
[ -f "backend/package-lock.json" ] && cp backend/package-lock.json "$BACKUP_PATH/"
[ -f "backend/tsconfig.json" ] && cp backend/tsconfig.json "$BACKUP_PATH/"

# Бэкап frontend build
echo "  - Frontend build..."
if [ -d "frontend/dist" ]; then
    cp -r frontend/dist "$BACKUP_PATH/frontend_dist"
fi

# Бэкап frontend конфигов
echo "  - Frontend конфиги..."
[ -f "frontend/package.json" ] && cp frontend/package.json "$BACKUP_PATH/"
[ -f "frontend/package-lock.json" ] && cp frontend/package-lock.json "$BACKUP_PATH/"
[ -f "frontend/vite.config.ts" ] && cp frontend/vite.config.ts "$BACKUP_PATH/"
[ -f "frontend/tsconfig.json" ] && cp frontend/tsconfig.json "$BACKUP_PATH/"

# Бэкап .env файлов
echo "  - Environment файлы..."
find . -name ".env*" -type f | while read -r envfile; do
    relpath=$(echo "$envfile" | sed "s|^\./||")
    destdir=$(dirname "$BACKUP_PATH/$relpath")
    mkdir -p "$destdir"
    cp "$envfile" "$BACKUP_PATH/$relpath"
done

# Создаем архив
echo "Создание архива..."
cd "$BACKUP_DIR"
tar -czf "${BACKUP_NAME}.tar.gz" "$BACKUP_NAME"
rm -rf "$BACKUP_NAME"
cd ..

ZIP_SIZE=$(du -h "$BACKUP_DIR/${BACKUP_NAME}.tar.gz" | cut -f1)
echo ""
echo "Бэкап создан успешно!"
echo "  Путь: $BACKUP_DIR/${BACKUP_NAME}.tar.gz"
echo "  Размер: $ZIP_SIZE"
echo ""
echo "Для восстановления распакуйте архив и скопируйте файлы обратно."


