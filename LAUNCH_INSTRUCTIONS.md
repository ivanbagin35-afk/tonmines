# Инструкция по запуску проекта

## 🚀 Локальная разработка (на вашем компьютере)

### 1. Запуск фронтенда

Откройте терминал в папке `frontend` и выполните:

```bash
cd frontend
npm run dev
```

Фронтенд запустится на `http://localhost:5173`

### 2. Запуск backend (если нужно тестировать локально)

Откройте другой терминал в папке `backend` и выполните:

```bash
cd backend
npm start
```

Backend запустится на `http://localhost:3000`

**Примечание:** Для локальной разработки фронтенд уже настроен на использование `https://tonimi.fun` через прокси, поэтому backend запускать не обязательно.

---

## 🌐 Запуск на продакшн сервере

### Вариант 1: Использовать уже собранные файлы

Фронтенд уже собран в папке `frontend/dist/`. Просто загрузите эти файлы на сервер:

```bash
# На сервере
cd /var/www/tonmines/frontend
# Загрузите файлы из frontend/dist/ в эту папку
```

### Вариант 2: Собрать заново на сервере

```bash
# На сервере
cd /var/www/tonmines/frontend
npm install
npm run build
# Файлы будут в папке dist/
```

### Настройка Nginx

Убедитесь, что Nginx настроен на обслуживание статических файлов из папки `frontend/dist/`:

```nginx
server {
    listen 80;
    server_name tonimi.fun;

    root /var/www/tonmines/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Прокси для API запросов к backend
    location /api/ {
        proxy_pass http://localhost:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /balance/ {
        proxy_pass http://localhost:3000/balance/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    location /deposit {
        proxy_pass http://localhost:3000/deposit;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    location /withdraw {
        proxy_pass http://localhost:3000/withdraw;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    location /health {
        proxy_pass http://localhost:3000/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    location /pvp/ {
        proxy_pass http://localhost:3000/pvp/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }
}
```

### Запуск backend на сервере

```bash
# На сервере
cd /var/www/tonmines/backend
npm install
npm start
# Или используйте PM2 для постоянной работы:
pm2 start dist/server.js --name tonmines-backend
pm2 save
```

---

## 📝 Быстрый старт

### Локально (для тестирования):

1. Откройте терминал в `frontend`
2. Выполните: `npm run dev`
3. Откройте браузер: `http://localhost:5173`

### На сервере:

1. Загрузите файлы из `frontend/dist/` на сервер
2. Убедитесь, что Nginx настроен правильно
3. Перезапустите Nginx: `sudo systemctl reload nginx`
4. Запустите backend: `cd backend && npm start` (или через PM2)

---

## ⚠️ Важные замечания

- **HTTPS обязателен** для TON Connect (работает только через HTTPS)
- Убедитесь, что `tonconnect-manifest.json` доступен по адресу `https://tonimi.fun/tonconnect-manifest.json`
- Backend должен быть доступен на порту 3000 (или настройте Nginx прокси)
- Для продакшна используйте PM2 или systemd для постоянной работы backend





