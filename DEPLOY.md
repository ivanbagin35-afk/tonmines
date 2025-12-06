# Инструкция по деплою TON Mines

## Подготовка к деплою

### 1. Создание бэкапа

**Windows:**
```powershell
.\scripts\backup.ps1
```

**Linux/Mac:**
```bash
bash scripts/backup.sh
```

Бэкап будет создан в папке `backups/` с временной меткой.

### 2. Проверка конфигурации

Перед деплоем убедитесь, что:
- ✅ Backend скомпилирован (`backend/dist/` существует)
- ✅ Frontend собран (`frontend/dist/` существует)
- ✅ Все зависимости установлены
- ✅ `.env` файлы настроены

## Деплой на сервер

### Вариант 1: Автоматический деплой (Linux/Mac)

```bash
bash scripts/deploy.sh user@your-server.com /var/www/tonmines
```

Скрипт автоматически:
1. Создаст бэкап
2. Соберет frontend
3. Скопирует файлы на сервер
4. Установит зависимости

### Вариант 2: Ручной деплой

#### Шаг 1: Сборка проекта

```bash
# Backend (уже скомпилирован в dist/)
cd backend
npm install --production

# Frontend
cd ../frontend
npm install
npm run build
```

#### Шаг 2: Копирование на сервер

```bash
# Создайте директорию на сервере
ssh user@your-server.com "mkdir -p /var/www/tonmines"

# Копируем backend
scp -r backend/dist user@your-server.com:/var/www/tonmines/backend/
scp backend/package.json user@your-server.com:/var/www/tonmines/backend/

# Копируем frontend
scp -r frontend/dist user@your-server.com:/var/www/tonmines/frontend/
```

#### Шаг 3: Установка зависимостей на сервере

```bash
ssh user@your-server.com
cd /var/www/tonmines/backend
npm install --production
```

#### Шаг 4: Настройка переменных окружения

```bash
ssh user@your-server.com
cd /var/www/tonmines/backend
nano .env
```

Добавьте необходимые переменные:
```
PORT=3001
NODE_ENV=production
HOT_WALLET_ADDRESS=UQ...
HOT_WALLET_SECRET_KEY=...
# и другие
```

#### Шаг 5: Создание директорий для данных

```bash
ssh user@your-server.com
cd /var/www/tonmines/backend
mkdir -p data logs
chmod 755 data logs
```

#### Шаг 6: Запуск backend

**Вариант A: PM2 (рекомендуется)**

```bash
npm install -g pm2
cd /var/www/tonmines/backend
pm2 start dist/server.js --name tonmines-backend
pm2 save
pm2 startup
```

**Вариант B: Systemd**

```bash
sudo cp scripts/tonmines-backend.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable tonmines-backend
sudo systemctl start tonmines-backend
sudo systemctl status tonmines-backend
```

**Вариант C: Прямой запуск (для тестирования)**

```bash
cd /var/www/tonmines/backend
node dist/server.js
```

#### Шаг 7: Настройка Nginx

```bash
sudo cp scripts/nginx.conf.example /etc/nginx/sites-available/tonmines
sudo nano /etc/nginx/sites-available/tonmines
# Отредактируйте пути и домены
sudo ln -s /etc/nginx/sites-available/tonmines /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### Шаг 8: SSL сертификат (Let's Encrypt)

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d tonimi.fun -d www.tonimi.fun
```

## Проверка работы

1. **Backend:**
   ```bash
   curl http://localhost:3001/health
   ```

2. **Frontend:**
   Откройте в браузере: `https://tonimi.fun`

3. **Логи:**
   ```bash
   # PM2
   pm2 logs tonmines-backend
   
   # Systemd
   sudo journalctl -u tonmines-backend -f
   
   # Прямой запуск
   tail -f /var/www/tonmines/backend/logs/combined.log
   ```

## Восстановление из бэкапа

```bash
# Распакуйте архив
cd backups
tar -xzf tonmines_backup_YYYY-MM-DD_HH-MM-SS.tar.gz

# Скопируйте файлы обратно
cp -r backend_data/* /var/www/tonmines/backend/data/
cp -r backend_logs/* /var/www/tonmines/backend/logs/
```

## Обновление

```bash
# 1. Создайте бэкап
bash scripts/backup.sh

# 2. Остановите сервис
pm2 stop tonmines-backend
# или
sudo systemctl stop tonmines-backend

# 3. Обновите код (git pull или скопируйте новые файлы)

# 4. Пересоберите
cd frontend && npm run build && cd ..
cd backend && npm run build && cd ..

# 5. Скопируйте на сервер и перезапустите
pm2 restart tonmines-backend
# или
sudo systemctl restart tonmines-backend
```

## Мониторинг

- **PM2:**
  ```bash
  pm2 monit
  pm2 list
  ```

- **Systemd:**
  ```bash
  sudo systemctl status tonmines-backend
  ```

- **Логи:**
  ```bash
  tail -f /var/www/tonmines/backend/logs/combined.log
  tail -f /var/www/tonmines/backend/logs/error.log
  ```

## Troubleshooting

### Backend не запускается
1. Проверьте логи: `pm2 logs` или `sudo journalctl -u tonmines-backend`
2. Проверьте порт: `netstat -tulpn | grep 3001`
3. Проверьте .env файл
4. Проверьте права доступа к папкам `data/` и `logs/`

### Frontend не загружается
1. Проверьте Nginx: `sudo nginx -t`
2. Проверьте логи Nginx: `sudo tail -f /var/log/nginx/tonmines_error.log`
3. Проверьте, что файлы в `frontend/dist/` существуют

### 404 ошибки
1. Проверьте проксирование в Nginx конфиге
2. Убедитесь, что backend запущен на порту 3001
3. Проверьте CORS настройки в backend


