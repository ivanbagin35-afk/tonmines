# TON Mines Backend

Backend server for TON Mines game.

## Установка

```bash
npm install
```

## Настройка

Создайте файл `.env` в корне директории `backend`:

```env
PORT=3001
NODE_ENV=production

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/tonmines

# TON
HOT_WALLET_ADDRESS=your_hot_wallet_address
HOT_WALLET_PRIVATE_KEY=your_private_key
```

## Запуск

### Production
```bash
npm start
```

### Development
```bash
npm run dev
```

### Build
```bash
npm run build
```

## Endpoints

- `GET /health` - Health check
- `GET /balance/:wallet` - Получить баланс
- `POST /balance/:wallet/subtract` - Списать баланс для игры
- `POST /balance/restore` - Восстановить баланс (для тестирования)
- `POST /deposit` - Депозит
- `POST /withdraw` - Вывод
- `GET /pvp/state` - Состояние PvP игры
- `POST /pvp/join` - Присоединиться к PvP игре




