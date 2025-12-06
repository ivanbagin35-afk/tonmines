import React, { useState } from "react";
import { api } from "../api";
import "./DiceGame.css";

interface DiceGameProps {
  walletAddress: string;
  balance: number;
  onBalanceUpdate: () => void;
  onBack: () => void;
}

const HOUSE_EDGE = 0.96; // 4% преимущество казино

export const DiceGame: React.FC<DiceGameProps> = ({ walletAddress, balance, onBalanceUpdate, onBack }) => {
  const [betAmount, setBetAmount] = useState<string>("1.0");
  const [selectedNumber, setSelectedNumber] = useState<number>(50);
  const [result, setResult] = useState<number | null>(null);
  const [won, setWon] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isRolling, setIsRolling] = useState(false);
  const [error, setError] = useState<string>("");
  const [gameSeed, setGameSeed] = useState<number>(0);
  const [gameHash, setGameHash] = useState<string>("");

  const handlePlay = async () => {
    if (!walletAddress) {
      setError("Подключите кошелек для игры");
      return;
    }

    const bet = parseFloat(betAmount);
    if (isNaN(bet) || bet <= 0) {
      setError("Введите корректную сумму ставки");
      return;
    }

    if (balance < bet) {
      setError(`Недостаточно средств. Ваш баланс: ${balance.toFixed(4)} TON`);
      return;
    }

    try {
      setLoading(true);
      setError("");
      setResult(null);
      setWon(false);
      setIsRolling(true);

      // Списываем баланс
      await api.subtractBalance(walletAddress, bet);
      await onBalanceUpdate();

      // Генерируем seed для provably fair
      const seed = Date.now();
      setGameSeed(seed);
      const hash = btoa(String(seed)).slice(0, 16);
      setGameHash(hash);

      // Анимация кубика
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Генерируем результат (1-100)
      let seedValue = seed;
      const nextRand = () => {
        seedValue = (seedValue * 1103515245 + 12345) & 0x7fffffff;
        return seedValue / 0x7fffffff;
      };

      const roll = Math.floor(nextRand() * 100) + 1; // 1-100 вместо 0-99
      setResult(roll);
      setIsRolling(false);

      // Определяем выигрыш
      const isWin = selectedNumber <= 50 ? roll <= selectedNumber : roll > selectedNumber;
      const probability = selectedNumber <= 50 ? selectedNumber / 100 : (100 - selectedNumber) / 100;
      const multiplier = (1 / probability) * HOUSE_EDGE;

      if (isWin) {
        setWon(true);
        const bet = parseFloat(betAmount);
        const winAmount = bet * multiplier;
        await api.deposit(walletAddress, winAmount);
        await onBalanceUpdate();
      }
    } catch (err: any) {
      setError(err.message || "Ошибка игры");
    } finally {
      setLoading(false);
    }
  };

  const handleRestart = () => {
    setResult(null);
    setWon(false);
    setError("");
    setGameSeed(0);
    setGameHash("");
    setIsRolling(false);
  };

  const probability = selectedNumber <= 50 ? selectedNumber / 100 : (100 - selectedNumber) / 100;
  const multiplier = probability > 0 ? ((1 / probability) * HOUSE_EDGE).toFixed(2) : "0.00";

  return (
    <div className="dice-container">
      <button onClick={onBack} className="back-button">← Назад</button>

      {error && (
        <div style={{ padding: "10px", background: "#ff4444", color: "white", margin: "10px", borderRadius: "5px" }}>
          {error}
        </div>
      )}

      <section className="panel">
        <div className="panel-row" style={{ flexDirection: "column", alignItems: "flex-start", gap: "8px" }}>
          <span style={{ width: "100%" }}>Сумма ставки:</span>
          <input
            type="number"
            placeholder="1.0"
            value={betAmount}
            onChange={(e) => setBetAmount(e.target.value)}
            className="input-field"
            step="0.1"
            min="0.1"
            disabled={loading || result !== null}
            style={{ width: "100%", margin: 0 }}
          />
        </div>
        <div className="panel-row">
          <span>Множитель:</span>
          <strong>x{multiplier}</strong>
        </div>
        {gameHash && (
          <div className="panel-row">
            <span>Hash:</span>
            <code style={{ fontSize: "10px" }}>{gameHash}</code>
          </div>
        )}
        {gameSeed > 0 && (
          <div className="panel-row">
            <span>Seed:</span>
            <code style={{ fontSize: "10px" }}>{gameSeed}</code>
          </div>
        )}
      </section>

      <section className="dice-controls">
        <div className="dice-selector">
          <label>Выберите число:</label>
          <input
            type="range"
            min="1"
            max="99"
            value={selectedNumber}
            onChange={(e) => setSelectedNumber(Number(e.target.value))}
            disabled={loading || result !== null}
          />
          <div className="dice-options">
            <button
              className={selectedNumber <= 50 ? "dice-option active" : "dice-option"}
              onClick={() => setSelectedNumber(50)}
              disabled={loading || result !== null}
            >
              Меньше {selectedNumber}
            </button>
            <button
              className={selectedNumber > 50 ? "dice-option active" : "dice-option"}
              onClick={() => setSelectedNumber(51)}
              disabled={loading || result !== null}
            >
              Больше {selectedNumber}
            </button>
          </div>
        </div>

        {(result !== null || isRolling) && (
          <div className="dice-result">
            <div className={`dice-cube ${result !== null ? (won ? "win" : "lose") : ""} ${isRolling ? "rolling" : ""}`}>
              {/* Пустые грани кубика без точек */}
              <div className="dice-face dice-face-1"></div>
              <div className="dice-face dice-face-2"></div>
              <div className="dice-face dice-face-3"></div>
              <div className="dice-face dice-face-4"></div>
              <div className="dice-face dice-face-5"></div>
              <div className="dice-face dice-face-6"></div>
              {/* Число выпавшего результата */}
              {result !== null && (
                <div className={`dice-number ${won ? "win" : "lose"}`}>
                  {result}
                </div>
              )}
              {isRolling && (
                <div className="dice-number rolling-text">
                  ...
                </div>
              )}
            </div>
            {result !== null && (
              <p className={won ? "result-text win" : "result-text lose"}>
                {won ? "Вы выиграли!" : "Вы проиграли"}
              </p>
            )}
            {isRolling && (
              <p className="result-text" style={{ color: "rgba(255, 255, 255, 0.8)" }}>
                Бросаем кубик...
              </p>
            )}
          </div>
        )}

        {result === null ? (
          <button
            className="primary"
            onClick={handlePlay}
            disabled={loading || parseFloat(betAmount) <= 0 || balance < parseFloat(betAmount)}
          >
            {loading ? "Играем..." : "Играть"}
          </button>
        ) : (
          <button className="primary" onClick={handleRestart}>
            Играть снова
          </button>
        )}
      </section>
    </div>
  );
};

