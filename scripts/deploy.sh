#!/bin/bash
# Скрипт для деплоя проекта TON Mines на сервер
# Использование: bash scripts/deploy.sh [user@host] [remote_path]
# Пример: bash scripts/deploy.sh user@example.com /var/www/tonmines

set -e

if [ $# -lt 2 ]; then
    echo "Использование: $0 [user@host] [remote_path]"
    echo "Пример: $0 user@example.com /var/www/tonmines"
    exit 1
fi

REMOTE_HOST=$1
REMOTE_PATH=$2

echo "🚀 Начало деплоя на $REMOTE_HOST:$REMOTE_PATH"

# Проверяем подключение
echo "Проверка подключения к серверу..."
ssh "$REMOTE_HOST" "echo 'Подключение успешно'" || {
    echo "❌ Ошибка подключения к серверу"
    exit 1
}

# Создаем бэкап перед деплоем
echo "📦 Создание бэкапа перед деплоем..."
bash scripts/backup.sh || echo "⚠️  Предупреждение: не удалось создать бэкап"

# Собираем frontend
echo "🔨 Сборка frontend..."
cd frontend
npm install
npm run build
cd ..

# Создаем временную директорию для деплоя
TEMP_DIR=$(mktemp -d)
echo "📁 Создание временной директории: $TEMP_DIR"

# Копируем необходимые файлы
echo "📋 Копирование файлов..."

# Backend
mkdir -p "$TEMP_DIR/backend"
cp -r backend/dist "$TEMP_DIR/backend/"
cp backend/package.json "$TEMP_DIR/backend/"
cp backend/package-lock.json "$TEMP_DIR/backend/" 2>/dev/null || true
cp backend/tsconfig.json "$TEMP_DIR/backend/" 2>/dev/null || true

# Frontend
mkdir -p "$TEMP_DIR/frontend"
cp -r frontend/dist "$TEMP_DIR/frontend/"

# Конфиги
cp -r scripts "$TEMP_DIR/" 2>/dev/null || true
[ -f ".env.example" ] && cp .env.example "$TEMP_DIR/" || true

# Создаем .gitignore для удаленных файлов
cat > "$TEMP_DIR/.gitignore" << EOF
node_modules/
.env
*.log
data/
logs/
EOF

# Создаем package.json для установки зависимостей на сервере
cat > "$TEMP_DIR/package.json" << EOF
{
  "name": "tonmines-deploy",
  "version": "1.0.0",
  "scripts": {
    "install-backend": "cd backend && npm install --production",
    "install-frontend": "cd frontend && npm install --production",
    "start-backend": "cd backend && npm start",
    "build-frontend": "cd frontend && npm run build"
  }
}
EOF

# Создаем скрипт для запуска на сервере
cat > "$TEMP_DIR/start.sh" << 'EOF'
#!/bin/bash
cd backend
npm install --production
cd ../frontend
npm install --production
echo "✅ Зависимости установлены"
EOF
chmod +x "$TEMP_DIR/start.sh"

# Создаем systemd service файл (пример)
cat > "$TEMP_DIR/tonmines-backend.service" << EOF
[Unit]
Description=TON Mines Backend
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=$REMOTE_PATH/backend
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3001

[Install]
WantedBy=multi-user.target
EOF

# Копируем на сервер
echo "📤 Копирование файлов на сервер..."
ssh "$REMOTE_HOST" "mkdir -p $REMOTE_PATH"
rsync -avz --progress "$TEMP_DIR/" "$REMOTE_HOST:$REMOTE_PATH/" || {
    echo "❌ Ошибка при копировании файлов"
    rm -rf "$TEMP_DIR"
    exit 1
}

# Устанавливаем зависимости на сервере
echo "📦 Установка зависимостей на сервере..."
ssh "$REMOTE_HOST" "cd $REMOTE_PATH/backend && npm install --production" || {
    echo "⚠️  Предупреждение: ошибка установки зависимостей backend"
}

# Создаем директории для данных
echo "📁 Создание директорий для данных..."
ssh "$REMOTE_HOST" "mkdir -p $REMOTE_PATH/backend/data $REMOTE_PATH/backend/logs"

# Очистка
rm -rf "$TEMP_DIR"

echo ""
echo "✅ Деплой завершен успешно!"
echo ""
echo "Следующие шаги:"
echo "1. Настройте .env файлы на сервере:"
echo "   ssh $REMOTE_HOST 'cd $REMOTE_PATH && nano backend/.env'"
echo ""
echo "2. Запустите backend:"
echo "   ssh $REMOTE_HOST 'cd $REMOTE_PATH/backend && npm start'"
echo ""
echo "3. Настройте nginx для frontend (пример конфига в scripts/nginx.conf)"
echo ""
echo "4. (Опционально) Установите systemd service:"
echo "   ssh $REMOTE_HOST 'sudo cp $REMOTE_PATH/tonmines-backend.service /etc/systemd/system/'"
echo "   ssh $REMOTE_HOST 'sudo systemctl enable tonmines-backend'"
echo "   ssh $REMOTE_HOST 'sudo systemctl start tonmines-backend'"


