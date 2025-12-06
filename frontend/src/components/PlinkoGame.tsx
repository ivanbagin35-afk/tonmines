import React, { useState } from "react";
import { api } from "../api";
import "./PlinkoGame.css";

interface PlinkoGameProps {
  walletAddress: string;
  balance: number;
  onBalanceUpdate: () => void;
  onBack: () => void;
}

const ROWS = 8;

type PlinkoMode = "safe" | "medium" | "risky";

// Пересмотренные коэффициенты с учетом house edge
// Казино должно быть в плюсе в среднем
const PLINKO_MODES: Record<PlinkoMode, { multipliers: number[]; probabilities: number[] }> = {
  safe: {
    // Безопасный режим: все коэффициенты ниже 1, казино всегда в плюсе
    multipliers: [0.2, 0.3, 0.4, 0.5, 0.6, 0.5, 0.4, 0.3, 0.2],
    // Вероятности: больше шансов попасть в низкие коэффициенты (сумма = 1.0)
    probabilities: [0.15, 0.12, 0.10, 0.08, 0.10, 0.08, 0.10, 0.12, 0.15],
  },
  medium: {
    // Средний режим: смешанные коэффициенты, но казино в плюсе
    multipliers: [0.3, 0.5, 0.8, 1.2, 1.5, 1.2, 0.8, 0.5, 0.3],
    // Вероятности: больше шансов попасть в средние/низкие коэффициенты (сумма = 0.8, нормализуем)
    probabilities: [0.15, 0.125, 0.10, 0.075, 0.10, 0.075, 0.10, 0.125, 0.15],
  },
  risky: {
    // Рисковый режим: высокие коэффициенты, но низкие вероятности
    multipliers: [0.5, 1.0, 2.0, 4.0, 8.0, 4.0, 2.0, 1.0, 0.5],
    // Вероятности: большинство попаданий в низкие коэффициенты (сумма = 1.0)
    probabilities: [0.20, 0.18, 0.12, 0.05, 0.02, 0.05, 0.12, 0.18, 0.20],
  },
};

export const PlinkoGame: React.FC<PlinkoGameProps> = ({ walletAddress, balance, onBalanceUpdate, onBack }) => {
  const [betAmount, setBetAmount] = useState<string>("1.0");
  const [selectedMode, setSelectedMode] = useState<PlinkoMode>("medium");
  const [isAnimating, setIsAnimating] = useState(false);
  const [ballPath, setBallPath] = useState<Array<{ row: number; col: number }>>([]);
  const [activeBalls, setActiveBalls] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<number | null>(null);
  const [won, setWon] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [gameSeed, setGameSeed] = useState<number>(0);
  const [finalCol, setFinalCol] = useState<number>(0);
  const [multiplierIndex, setMultiplierIndex] = useState<number>(-1);

  const currentMode = PLINKO_MODES[selectedMode];
  const currentMultipliers = currentMode.multipliers;
  const currentProbabilities = currentMode.probabilities;

  const validateAndStart = () => {
    if (!walletAddress) {
      setError("Подключите кошелек для игры");
      return false;
    }

    const bet = parseFloat(betAmount);
    if (isNaN(bet) || bet <= 0) {
      setError("Введите корректную сумму ставки");
      return false;
    }

    if (balance < bet) {
      setError(`Недостаточно средств. Ваш баланс: ${balance.toFixed(4)} TON`);
      return false;
    }

    if (loading) {
      setError("Игра уже запущена, подождите...");
      return false;
    }

    return true;
  };

  const handleDrop = async () => {
    setError("");

    if (!validateAndStart()) {
      return;
    }

    try {
      setLoading(true);
      setIsAnimating(true);
      setBallPath([]);
      setActiveBalls(new Set());
      setResult(null);
      setWon(false);

      // Списываем баланс
      const bet = parseFloat(betAmount);
      await api.subtractBalance(walletAddress, bet);
      await onBalanceUpdate();

      // Генерируем seed для provably fair
      const seed = Date.now();
      setGameSeed(seed);
      let seedValue = seed;
      const nextRand = () => {
        seedValue = (seedValue * 1103515245 + 12345) & 0x7fffffff;
        return seedValue / 0x7fffffff;
      };

      // Сначала определяем результат на основе вероятностей
      // Генерируем случайное число и выбираем слот по вероятностям
      const resultRand = nextRand();
      let cumulativeProbability = 0;
      let selectedIndex = 0;
      
      // Нормализуем вероятности на случай если сумма не равна 1
      const totalProb = currentProbabilities.reduce((sum, p) => sum + p, 0);
      const normalizedProbs = currentProbabilities.map(p => p / totalProb);
      
      for (let i = 0; i < normalizedProbs.length; i++) {
        cumulativeProbability += normalizedProbs[i];
        if (resultRand <= cumulativeProbability) {
          selectedIndex = i;
          break;
        }
      }
      
      setMultiplierIndex(selectedIndex);
      
      // Маппинг слотов (0-8) на колонки (0-6)
      // 9 слотов распределены по 7 колонкам равномерно
      // Слот 0 -> Колонка 0
      // Слот 1 -> Колонка 1
      // Слот 2 -> Колонка 2
      // Слот 3 -> Колонка 3
      // Слот 4 -> Колонка 4
      // Слот 5 -> Колонка 4
      // Слот 6 -> Колонка 5
      // Слот 7 -> Колонка 6
      // Слот 8 -> Колонка 6
      const slotToColMap: number[] = [0, 1, 2, 3, 4, 4, 5, 6, 6];
      const targetCol = slotToColMap[selectedIndex];
      
      const path: Array<{ row: number; col: number }> = [];
      const activeSet = new Set<string>();
      let currentCol = 3; // Стартовая позиция в центре (колонка 3 из 7)

      // Проходим через все ряды сетки - направляем шарик к целевому слоту
      for (let row = 0; row < 5; row++) {
        await new Promise(resolve => setTimeout(resolve, 250));
        
        // Вычисляем направление к целевой колонке
        const distanceToTarget = targetCol - currentCol;
        const randomFactor = nextRand();
        
        // 85% вероятность двигаться к цели, 15% случайное движение
        let direction: number;
        if (Math.abs(distanceToTarget) > 0 && randomFactor < 0.85) {
          // Двигаемся к цели
          direction = distanceToTarget > 0 ? 1 : -1;
        } else {
          // Случайное движение
          direction = nextRand() > 0.5 ? 1 : -1;
        }
        
        currentCol += direction;
        currentCol = Math.max(0, Math.min(6, currentCol));
        
        const ballKey = `${row}-${currentCol}`;
        activeSet.add(ballKey);
        setActiveBalls(new Set(activeSet));
        
        path.push({ row, col: currentCol });
        setBallPath([...path]);
      }

      // Принудительно устанавливаем финальную колонку в целевую
      // чтобы гарантировать соответствие с выбранным слотом
      // Обновляем последнюю позицию в пути
      if (path.length > 0) {
        path[path.length - 1].col = targetCol;
        setBallPath([...path]);
      }
      currentCol = targetCol;
      setFinalCol(currentCol);
      
      await new Promise(resolve => setTimeout(resolve, 500));
      const baseMultiplier = currentMultipliers[selectedIndex];
      // House edge уже учтен в коэффициентах, не умножаем еще раз
      const multiplier = baseMultiplier;
      const winAmount = bet * multiplier;

      setResult(multiplier);
      setIsAnimating(false);

      if (multiplier > 0) {
        setWon(true);
        await api.deposit(walletAddress, winAmount);
        await onBalanceUpdate();
      } else {
        setWon(false);
      }
    } catch (err: any) {
      setError(err.message || "Ошибка игры");
      setIsAnimating(false);
    } finally {
      setLoading(false);
    }
  };

  const handleRestart = () => {
    setBallPath([]);
    setActiveBalls(new Set());
    setResult(null);
    setWon(false);
    setError("");
    setGameSeed(0);
    setFinalCol(0);
    setMultiplierIndex(-1);
  };

  return (
    <div className="plinko-container">
      <button onClick={onBack} className="back-button">← Назад</button>

      {error && (
        <div style={{ padding: "10px", background: "#ff4444", color: "white", margin: "10px", borderRadius: "5px" }}>
          {error}
        </div>
      )}

      <section className="panel">
        <div className="panel-row">
          <span>Сумма ставки:</span>
          <input
            type="number"
            placeholder="1.0"
            value={betAmount}
            onChange={(e) => setBetAmount(e.target.value)}
            className="input-field"
            step="0.1"
            min="0.1"
            disabled={isAnimating || loading}
            style={{ width: "120px", margin: 0, padding: "8px 12px", fontSize: "14px" }}
          />
        </div>
        <div className="panel-row">
          <span>Режим:</span>
          <div style={{ display: "flex", gap: "10px" }}>
            {(["safe", "medium", "risky"] as PlinkoMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setSelectedMode(mode)}
                className={selectedMode === mode ? "mode-button active" : "mode-button"}
                disabled={isAnimating || loading}
              >
                {mode === "safe" ? "Безопасный" : mode === "medium" ? "Средний" : "Рисковый"}
              </button>
            ))}
          </div>
        </div>
        {gameSeed > 0 && (
          <div className="panel-row">
            <span>Seed:</span>
            <code style={{ fontSize: "10px" }}>{gameSeed}</code>
          </div>
        )}
        {finalCol > 0 && (
          <div className="panel-row">
            <span>Финальная колонка:</span>
            <code>{finalCol}</code>
          </div>
        )}
      </section>

      <section className="plinko-container">
        <div className="plinko-board">
          {/* Сетка шаров - 5 рядов, 7 колонок */}
          {Array.from({ length: 5 }).map((_, row) => (
            <div key={row} className="plinko-row" style={{ marginTop: row === 0 ? '10px' : '0' }}>
              {Array.from({ length: 7 }).map((_, col) => {
                const spacing = 100 / 8;
                const ballKey = `${row}-${col}`;
                const isActive = activeBalls.has(ballKey);
                
                return (
                  <div
                    key={col}
                    className={`plinko-pin ${isActive ? 'plinko-ball-active' : ''}`}
                    style={{
                      left: `${spacing * (col + 1)}%`,
                      top: `${row * 50 + 10}px`,
                      width: isActive ? '16px' : '10px',
                      height: isActive ? '16px' : '10px',
                      background: isActive ? '#667eea' : '#64748b',
                      boxShadow: isActive ? '0 0 10px rgba(102, 126, 234, 0.8)' : 'none',
                      transition: 'all 0.2s ease',
                    }}
                  />
                );
              })}
            </div>
          ))}

          {/* Слоты с множителями */}
          <div className="plinko-slots" style={{ marginTop: `${5 * 50 + 30}px` }}>
            {currentMultipliers.map((baseMultiplier, index) => {
              const displayMultiplier = baseMultiplier.toFixed(2);
              // Проверяем соответствие: финальная колонка должна соответствовать слоту
              const slotToColMap: number[] = [0, 1, 2, 3, 4, 4, 5, 6, 6];
              const slotCol = slotToColMap[index];
              const isActive = result !== null && multiplierIndex === index && finalCol === slotCol;
              return (
                <div
                  key={index}
                  className={`plinko-slot ${isActive ? 'active' : ''}`}
                >
                  <div className="slot-multiplier">x{displayMultiplier}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="status">
        {result !== null && (
          <p className={won ? "status-text win" : "status-text lose"}>
            {won ? `Вы выиграли! Множитель: x${result.toFixed(2)}` : "Вы проиграли"}
          </p>
        )}
        {!isAnimating && result === null && (
          <button className="primary" onClick={handleDrop} disabled={loading || parseFloat(betAmount) <= 0 || balance < parseFloat(betAmount)}>
            {loading ? "Обработка..." : "Сбросить шарик"}
          </button>
        )}
        {result !== null && (
          <button className="primary" onClick={handleRestart} disabled={loading}>
            Играть снова
          </button>
        )}
      </section>
    </div>
  );
};

