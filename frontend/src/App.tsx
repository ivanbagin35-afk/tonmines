import React, { useState, useEffect, useMemo } from "react";
import { useTonConnectUI, useTonWallet } from "@tonconnect/ui-react";
import { Address, toNano } from "@ton/core";
import { api } from "./api";

// Конвертирует адрес в UQ формат (V5 non-bounceable)
// UQ = non-bounceable, используем bounceable: false
function toUQAddress(address: string): string {
  try {
    if (address.startsWith('UQ')) {
      return address;
    }
    
    const parsed = Address.parse(address);
    const workchain = parsed.workChain;
    const hash = parsed.hash;
    const newAddr = new Address(workchain, hash);
    
    // Для UQ формата используем bounceable: false (non-bounceable)
    const uqAddr = newAddr.toString({ 
      urlSafe: true, 
      bounceable: false,  // false = non-bounceable = UQ
      testOnly: false
    });
    
    if (!uqAddr.startsWith('UQ')) {
      throw new Error(`Failed to convert to UQ format. Got: ${uqAddr.substring(0, 2)}`);
    }
    
    return uqAddr;
  } catch (err) {
    console.error("[App] Failed to convert address to UQ:", address, err);
    throw err;
  }
}
import { MinesGame } from "./components/MinesGame";
import { DiceGame } from "./components/DiceGame";
import { PlinkoGame } from "./components/PlinkoGame";
import { PvPGame } from "./components/PvPGame";
import { FAQ } from "./components/FAQ";
import { AdminPanel } from "./components/AdminPanel";

type GameType = "mines" | "dice" | "plinko" | "pvp" | "faq" | "admin" | null;

const App: React.FC = () => {
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();
  const [balance, setBalance] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [selectedGame, setSelectedGame] = useState<GameType>(null);
  const [depositAmount, setDepositAmount] = useState<string>("");
  const [withdrawAmount, setWithdrawAmount] = useState<string>("");
  const [withdrawAddress, setWithdrawAddress] = useState<string>("");
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [pendingWithdraw, setPendingWithdraw] = useState<{ address: string; amount: number } | null>(null);
  const [showFAQ, setShowFAQ] = useState(false);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  
  // Конвертируем адрес для отображения (UQ формат)
  const displayAddress = useMemo(() => {
    if (!wallet?.account?.address) return "";
    return toUQAddress(wallet.account.address);
  }, [wallet?.account?.address]);

  const loadBalance = async () => {
    if (!wallet?.account?.address) return;
    try {
      const data = await api.getBalance(wallet.account.address);
      setBalance(data.balance);
    } catch (err: any) {
      console.error("Failed to load balance:", err);
    }
  };

  useEffect(() => {
    if (wallet?.account?.address) {
      loadBalance();
      // Проверяем права админа
      api.checkAdminAccess(wallet.account.address).then((result) => {
        setIsAdmin(result.isAdmin);
      }).catch(() => {
        setIsAdmin(false);
      });
    } else {
      setIsAdmin(false);
    }
  }, [wallet?.account?.address]);

  const handleDeposit = async () => {
    if (!wallet?.account?.address) {
      setError("Подключите кошелек");
      return;
    }

    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      setError("Введите корректную сумму");
      return;
    }

    try {
      setLoading(true);
      setError("");

      // Создаем транзакцию для депозита
      // Используем адрес из backend (HOT_WALLET_ADDRESS)
      const hotWalletAddressStr = "UQBIFltVTOL72H_uGF52qCf44xyJl7xv4DhkUVQr8eL_aV_l";
      try {
        const hotWalletAddress = Address.parse(hotWalletAddressStr);
        const transaction = {
          messages: [
            {
              address: hotWalletAddress.toString({ urlSafe: true, bounceable: false }), // Правильный формат для TON Connect
              amount: toNano(amount).toString(), // Конвертируем в нанотоны через toNano
            },
          ],
          validUntil: Math.floor(Date.now() / 1000) + 300, // 5 минут
        };

        // Отправляем транзакцию через TON Connect
        await tonConnectUI.sendTransaction(transaction);
      } catch (addrError: any) {
        // Если не удалось распарсить адрес, пробуем использовать как есть
        const transaction = {
          messages: [
            {
              address: hotWalletAddressStr, // Используем адрес как есть
              amount: toNano(amount).toString(),
            },
          ],
          validUntil: Math.floor(Date.now() / 1000) + 300,
        };
        await tonConnectUI.sendTransaction(transaction);
      }

      // После успешной транзакции, уведомляем backend
      await api.deposit(wallet.account.address, amount);
      await loadBalance();
      setDepositAmount("");
      alert(`Депозит ${amount} TON успешно обработан!`);
    } catch (err: any) {
      setError(err.message || "Ошибка депозита");
    } finally {
      setLoading(false);
    }
  };

  const handleWithdrawRequest = async () => {
    if (!wallet?.account?.address) {
      setError("Подключите кошелек");
      return;
    }

    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      setError("Введите корректную сумму");
      return;
    }

    if (amount > balance) {
      setError("Недостаточно средств");
      return;
    }

    // Валидация адреса TON
    if (!withdrawAddress) {
      setError("Введите адрес получателя");
      return;
    }
    
    try {
      // Пытаемся распарсить адрес - если не получится, значит адрес невалидный
      Address.parse(withdrawAddress);
    } catch (e) {
      setError("Введите корректный адрес TON");
      return;
    }

    setPendingWithdraw({ address: withdrawAddress, amount });
    setShowWithdrawModal(true);
    setError("");
  };

  const handleWithdrawConfirm = async () => {
    if (!pendingWithdraw) return;

    try {
      setLoading(true);
      setError("");
      await api.withdraw(pendingWithdraw.address, pendingWithdraw.amount);
      await loadBalance();
      setWithdrawAmount("");
      setWithdrawAddress("");
      setShowWithdrawModal(false);
      setPendingWithdraw(null);
      alert(`Запрос на вывод ${pendingWithdraw.amount} TON создан и ожидает подтверждения администратора!`);
    } catch (err: any) {
      setError(err.message || "Ошибка вывода");
    } finally {
      setLoading(false);
    }
  };

  const handleWithdrawCancel = () => {
    setShowWithdrawModal(false);
    setPendingWithdraw(null);
  };

  const handleBalanceUpdate = () => {
    loadBalance();
  };

  if (selectedGame === "mines") {
    return (
      <MinesGame
        walletAddress={wallet?.account?.address || ""}
        balance={balance}
        onBalanceUpdate={handleBalanceUpdate}
        onBack={() => setSelectedGame(null)}
      />
    );
  }

  if (selectedGame === "dice") {
    return (
      <DiceGame
        walletAddress={wallet?.account?.address || ""}
        balance={balance}
        onBalanceUpdate={handleBalanceUpdate}
        onBack={() => setSelectedGame(null)}
      />
    );
  }

  if (selectedGame === "plinko") {
    return (
      <PlinkoGame
        walletAddress={wallet?.account?.address || ""}
        balance={balance}
        onBalanceUpdate={handleBalanceUpdate}
        onBack={() => setSelectedGame(null)}
      />
    );
  }

  if (selectedGame === "pvp") {
    return (
      <PvPGame
        walletAddress={wallet?.account?.address || ""}
        balance={balance}
        onBalanceUpdate={setBalance}
        onBack={() => setSelectedGame(null)}
      />
    );
  }

  if (selectedGame === "faq" || showFAQ) {
    return <FAQ onBack={() => { setSelectedGame(null); setShowFAQ(false); }} />;
  }

  if (selectedGame === "admin") {
    if (!wallet?.account?.address) {
      return (
        <div className="app">
          <div className="panel">
            <h2>Админ-панель</h2>
            <p>Для доступа к админ-панели необходимо подключить кошелек администратора.</p>
            <button onClick={() => setSelectedGame(null)} className="action-button">
              ← Назад
            </button>
          </div>
        </div>
      );
    }
    return <AdminPanel onBack={() => setSelectedGame(null)} />;
  }

  return (
    <div className="app">
      <header className="header">
        <h1>TON Casino</h1>
        <p className="subtitle">Играйте и выигрывайте TON</p>
      </header>

      {error && (
        <div style={{ padding: "10px", background: "#ff4444", color: "white", margin: "10px", borderRadius: "5px" }}>
          {error}
        </div>
      )}

        <section className="panel">
        {wallet?.account?.address ? (
          <>
            <div className="panel-row">
              <span>Кошелек:</span>
              <code>{displayAddress ? displayAddress.slice(0, 8) + "..." + displayAddress.slice(-8) : ""}</code>
            </div>
          <div className="panel-row">
              <span>Баланс:</span>
              <strong>{balance.toFixed(4)} TON</strong>
          </div>
          <div className="panel-row">
              <button
                onClick={() => tonConnectUI.disconnect()}
                className="action-button"
                style={{ background: "rgba(100, 116, 139, 0.8)" }}
              >
                Отключить кошелек
              </button>
          </div>
          </>
        ) : (
          <div className="panel-row">
            <button
              onClick={() => tonConnectUI.openModal()}
              className="action-button"
              style={{ background: "#0088cc" }}
            >
              Подключить кошелек
            </button>
          </div>
        )}
      </section>

      {wallet?.account?.address && (
        <>
          <section className="panel">
            <h2>Депозит</h2>
            <div className="panel-row">
            <input
                type="number"
                placeholder="Сумма в TON"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="input-field"
                step="0.01"
                min="0.01"
            />
          </div>
            <div className="panel-row">
              <button
                onClick={handleDeposit}
                disabled={loading || !depositAmount}
                className="action-button"
              >
                {loading ? "Обработка..." : "Пополнить"}
              </button>
            </div>
        </section>

          <section className="panel">
            <h2>Вывод</h2>
            <div className="panel-row">
              <input
                type="text"
                placeholder="Адрес получателя"
                value={withdrawAddress}
                onChange={(e) => setWithdrawAddress(e.target.value)}
                className="input-field"
              />
            </div>
            <div className="panel-row">
              <input
                type="number"
                placeholder="Сумма в TON"
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="input-field"
                step="0.01"
                min="0.01"
              />
            </div>
            <div className="panel-row">
              <button
                onClick={handleWithdrawRequest}
                disabled={loading || !withdrawAmount || !withdrawAddress}
                className="action-button"
                style={{ background: "rgba(99, 102, 241, 0.8)" }}
              >
                Запросить вывод
              </button>
            </div>
        </section>

          {import.meta.env.DEV && wallet?.account?.address && (
            <div className="panel-row" style={{ justifyContent: "center", marginTop: "10px" }}>
              <button 
                onClick={async () => {
                  try {
                    setLoading(true);
                    setError("");
                    const result = await api.restoreBalance(wallet.account.address, 100);
                    console.log("[App] Restore balance result:", result);
                    // Обновляем баланс из результата и перезагружаем
                    if (result.balance !== undefined) {
                      setBalance(result.balance);
                    }
                    await loadBalance();
                    alert(`Тестовый баланс 100 TON выдан! Текущий баланс: ${result.balance?.toFixed(4) || balance.toFixed(4)} TON`);
                  } catch (err: any) {
                    console.error("[App] Restore balance error:", err);
                    setError(err.message || "Ошибка выдачи тестового баланса");
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                className="action-button"
                style={{ background: "#f97316", color: "white" }}
              >
                🧪 Тест: 100 TON
              </button>
            </div>
          )}
        </>
      )}

      {/* Основные игры - внизу в ряд для Telegram Mini App */}
      <div className="bottom-nav">
        <button
          onClick={() => setSelectedGame("mines")}
          className="nav-button"
          disabled={!wallet?.account?.address}
          title="Mines"
        >
          <span className="nav-icon">💣</span>
          <span className="nav-label">Mines</span>
        </button>
        <button
          onClick={() => setSelectedGame("dice")}
          className="nav-button"
          disabled={!wallet?.account?.address}
          title="Dice"
        >
          <span className="nav-icon">🎲</span>
          <span className="nav-label">Dice</span>
        </button>
        <button
          onClick={() => setSelectedGame("plinko")}
          className="nav-button"
          disabled={!wallet?.account?.address}
          title="Plinko"
        >
          <span className="nav-icon">🎯</span>
          <span className="nav-label">Plinko</span>
        </button>
        <button
          onClick={() => setSelectedGame("pvp")}
          className="nav-button"
          disabled={!wallet?.account?.address}
          title="PvP"
        >
          <span className="nav-icon">⚔️</span>
          <span className="nav-label">PvP</span>
        </button>
        <button
          onClick={() => setShowFAQ(true)}
          className="nav-button"
          title="FAQ"
        >
          <span className="nav-icon">❓</span>
          <span className="nav-label">FAQ</span>
        </button>
        {isAdmin && (
          <button
            onClick={() => setSelectedGame("admin")}
            className="nav-button"
            title="Admin"
          >
            <span className="nav-icon">⚙️</span>
            <span className="nav-label">Admin</span>
          </button>
        )}
      </div>

      {showWithdrawModal && pendingWithdraw && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "#1e293b",
              padding: "20px",
              borderRadius: "10px",
              maxWidth: "400px",
              width: "90%",
            }}
          >
            <h3>Подтвердите вывод</h3>
            <p>Адрес: {pendingWithdraw.address}</p>
            <p>Сумма: {pendingWithdraw.amount} TON</p>
            <div style={{ display: "flex", gap: "10px", marginTop: "20px" }}>
              <button
                onClick={handleWithdrawConfirm}
                disabled={loading}
                className="action-button"
                style={{ flex: 1 }}
              >
                {loading ? "Обработка..." : "Да"}
              </button>
              <button
                onClick={handleWithdrawCancel}
                disabled={loading}
                className="action-button"
                style={{ flex: 1, background: "#ef4444" }}
              >
                Нет
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
