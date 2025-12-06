#!/bin/bash
# Скрипт для деплоя на сервере (выполнять на сервере)

set -e

echo "🚀 Начало деплоя на сервере..."

# Создаем директории
mkdir -p /var/www/tonmines/backend
mkdir -p /var/www/tonmines/frontend

# Если проект уже есть, переходим в него
if [ -d "/var/www/tonmines/.git" ]; then
    echo "📥 Обновление проекта из Git..."
    cd /var/www/tonmines
    git pull
else
    echo "⚠️  Проект не найден. Нужно загрузить файлы вручную."
    echo "Создайте папку /var/www/tonmines и загрузите туда проект"
    exit 1
fi

# Собираем backend
echo "🔨 Сборка backend..."
cd /var/www/tonmines/backend
npm install
npm run build

# Собираем frontend
echo "🔨 Сборка frontend..."
cd /var/www/tonmines/frontend
npm install
npm run build

# Устанавливаем production зависимости для backend
echo "📦 Установка production зависимостей..."
cd /var/www/tonmines/backend
npm install --production

# Создаем директории для данных
echo "📁 Создание директорий для данных..."
mkdir -p /var/www/tonmines/backend/data
mkdir -p /var/www/tonmines/backend/logs
chmod 755 /var/www/tonmines/backend/data
chmod 755 /var/www/tonmines/backend/logs

echo ""
echo "✅ Сборка завершена!"
echo ""
echo "Следующие шаги:"
echo "1. Настройте .env файл:"
echo "   nano /var/www/tonmines/backend/.env"
echo ""
echo "2. Запустите backend:"
echo "   cd /var/www/tonmines/backend && npm start"
echo "   или через PM2:"
echo "   pm2 start dist/server.js --name tonmines-backend"

