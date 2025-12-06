# Инструкция по деплою с Windows

## Проблема с scp в PowerShell

В PowerShell команда `scp` может работать некорректно из-за синтаксиса путей. Используйте один из вариантов ниже.

## Вариант 1: Использование WinSCP (Рекомендуется для Windows)

1. **Скачайте WinSCP**: https://winscp.net/eng/download.php

2. **Подключитесь к серверу**:
   - Host name: `6176891-oa392772` (или IP адрес)
   - User name: `root`
   - Password: ваш пароль
   - Protocol: SFTP

3. **Скопируйте файлы**:
   - Перетащите `backend/dist` → `/var/www/tonmines/backend/`
   - Перетащите `backend/package.json` → `/var/www/tonmines/backend/`
   - Перетащите `backend/package-lock.json` → `/var/www/tonmines/backend/`
   - Перетащите все файлы из `frontend/dist/` → `/var/www/tonmines/frontend/`

## Вариант 2: Использование Git Bash

Если у вас установлен Git для Windows, используйте Git Bash:

1. Откройте **Git Bash** (не PowerShell)

2. Перейдите в папку проекта:
```bash
cd /c/Users/ivanb/OneDrive/Desktop/tonmines
```

3. Выполните команды:
```bash
SERVER="root@6176891-oa392772"

# Backend
scp -r backend/dist $SERVER:/var/www/tonmines/backend/
scp backend/package.json $SERVER:/var/www/tonmines/backend/
scp backend/package-lock.json $SERVER:/var/www/tonmines/backend/

# Frontend
scp -r frontend/dist/* $SERVER:/var/www/tonmines/frontend/
```

## Вариант 3: Сборка на сервере (Если есть Git)

Если проект в Git репозитории, проще собрать на сервере:

1. **На сервере** выполните:
```bash
# Создайте директорию
mkdir -p /var/www/tonmines
cd /var/www/tonmines

# Клонируйте проект (замените URL на ваш репозиторий)
git clone <ваш-репозиторий> .

# Или если уже есть, обновите:
git pull

# Соберите проект
cd backend
npm install
npm run build

cd ../frontend
npm install
npm run build

# Установите production зависимости
cd ../backend
npm install --production
```

## Вариант 4: Использование правильного синтаксиса PowerShell

Если у вас есть IP адрес сервера вместо hostname:

```powershell
# Используйте IP адрес
$SERVER = "root@YOUR_IP_ADDRESS"

# Backend
scp -r backend\dist "${SERVER}:/var/www/tonmines/backend/"
scp backend\package.json "${SERVER}:/var/www/tonmines/backend/"
scp backend\package-lock.json "${SERVER}:/var/www/tonmines/backend/"

# Frontend - копируем каждый файл отдельно
Get-ChildItem -Path frontend\dist -Recurse | ForEach-Object {
    $relativePath = $_.FullName.Substring((Resolve-Path frontend\dist).Path.Length + 1)
    $remotePath = "${SERVER}:/var/www/tonmines/frontend/$relativePath"
    scp $_.FullName $remotePath
}
```

## После загрузки файлов на сервер

Выполните на сервере:

```bash
# Установите зависимости
cd /var/www/tonmines/backend
npm install --production

# Создайте .env файл
nano .env
# Добавьте необходимые переменные окружения

# Создайте директории
mkdir -p data logs
chmod 755 data logs

# Запустите backend
npm start
# или через PM2:
pm2 start dist/server.js --name tonmines-backend
pm2 save
```

