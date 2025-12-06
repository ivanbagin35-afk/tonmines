import React, { useState } from "react";
import { api } from "../api";
import "./MinesGame.css";

interface MinesGameProps {
  walletAddress: string;
  balance: number;
  onBalanceUpdate: () => void;
  onBack: () => void;
}

const GRID_SIZE = 5;
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;
const MIN_MINES = 1;
const MAX_MINES = TOTAL_CELLS - 1;
const HOUSE_EDGE = 0.96; // 4% преимущество казино

type CellState = "hidden" | "safe" | "mine";

interface Cell {
  hasMine: boolean;
  state: CellState;
}

function generateField(seed: number, minesCount: number): Cell[] {
  const cells: Cell[] = Array.from({ length: TOTAL_CELLS }, () => ({
    hasMine: false,
    state: "hidden",
  }));

  let minesPlaced = 0;
  let s = seed || 1;
  const nextRand = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };

  while (minesPlaced < minesCount) {
    const idx = Math.floor(nextRand() * cells.length);
    if (!cells[idx].hasMine) {
      cells[idx].hasMine = true;
      minesPlaced += 1;
    }
  }

  return cells;
}

function combination(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  let res = 1;
  const kk = Math.min(k, n - k);
  for (let i = 1; i <= kk; i += 1) {
    res *= (n - kk + i) / i;
  }
  return res;
}

function calcFairMultiplier(minesCount: number, openedSafe: number): number {
  if (openedSafe <= 0) return 1;
  const totalSafe = TOTAL_CELLS - minesCount;
  if (openedSafe > totalSafe) return 0;
  const waysSafe = combination(totalSafe, openedSafe);
  const waysTotal = combination(TOTAL_CELLS, openedSafe);
  if (waysTotal === 0) return 0;
  const probSurvive = waysSafe / waysTotal;
  if (probSurvive <= 0) return 0;
  return 1 / probSurvive;
}

export const MinesGame: React.FC<MinesGameProps> = ({ walletAddress, balance, onBalanceUpdate, onBack }) => {
  const [betAmount, setBetAmount] = useState<string>("1.0");
  const [minesCount, setMinesCount] = useState<number>(5);
  const [gameSeed, setGameSeed] = useState<number>(() => Date.now() & 0xffffffff);
  const [field, setField] = useState<Cell[]>(() => generateField(Date.now(), 5));
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [openedSafe, setOpenedSafe] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [gameHash, setGameHash] = useState<string>("");

  const handleCellClick = async (index: number) => {
    if (gameOver || loading) return;

    if (openedSafe === 0) {
      // Первый клик - начинаем игру
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
        // Списываем баланс
        await api.subtractBalance(walletAddress, bet);
        await onBalanceUpdate();

        // Генерируем hash для provably fair
        const hash = btoa(String(gameSeed)).slice(0, 16);
        setGameHash(hash);
      } catch (err: any) {
        setError(err.message || "Ошибка начала игры");
        return;
      } finally {
        setLoading(false);
      }
    }

    setField((prev) => {
      const next = [...prev];
      const cell = next[index];
      if (cell.state !== "hidden") return prev;

      if (cell.hasMine) {
        cell.state = "mine";
        setGameOver(true);
        setWon(false);
        // Вскрываем все мины с анимацией
        const hiddenMines: number[] = [];
        next.forEach((c, idx) => {
          if (c.hasMine && c.state === "hidden") {
            hiddenMines.push(idx);
          }
        });
        hiddenMines.forEach((idx, i) => {
          setTimeout(() => {
            setField((current) => {
              const updated = [...current];
              updated[idx].state = "mine";
              return updated;
            });
          }, 300 + i * 50);
        });
      } else {
        cell.state = "safe";
        const newOpenedSafe = openedSafe + 1;
        setOpenedSafe(newOpenedSafe);

        const allSafeOpened = next.every(
          (c) => (c.hasMine && c.state !== "safe") || (!c.hasMine && c.state !== "hidden"),
        );
        if (allSafeOpened) {
          setGameOver(true);
          setWon(true);
          // Вскрываем все мины с анимацией
          const hiddenMines: number[] = [];
          next.forEach((c, idx) => {
            if (c.hasMine && c.state === "hidden") {
              hiddenMines.push(idx);
            }
          });
          hiddenMines.forEach((idx, i) => {
            setTimeout(() => {
              setField((current) => {
                const updated = [...current];
                updated[idx].state = "mine";
                return updated;
              });
            }, 300 + i * 50);
          });
        }
      }

      return next;
    });
  };

  const handleCashOut = async () => {
    if (openedSafe === 0 || gameOver) return;

    try {
      setLoading(true);
      setError("");
      const bet = parseFloat(betAmount);
      const fairMultiplier = calcFairMultiplier(minesCount, openedSafe);
      const houseMultiplier = fairMultiplier * HOUSE_EDGE;
      const winAmount = bet * houseMultiplier;
      await api.deposit(walletAddress, winAmount);
      await onBalanceUpdate();
      setGameOver(true);
      setWon(true);
      // Вскрываем все мины с анимацией
      const hiddenMines: number[] = [];
      setField((prevField) => {
        const updated = [...prevField];
        updated.forEach((c, idx) => {
          if (c.hasMine && c.state === "hidden") {
            hiddenMines.push(idx);
          }
        });
        return updated;
      });
      hiddenMines.forEach((idx, i) => {
        setTimeout(() => {
          setField((current) => {
            const updated = [...current];
            updated[idx].state = "mine";
            return updated;
          });
        }, 300 + i * 50);
      });
    } catch (err: any) {
      setError(err.message || "Ошибка вывода");
    } finally {
      setLoading(false);
    }
  };

  const handleRestart = () => {
    const newSeed = (Date.now() & 0xffffffff);
    setGameSeed(newSeed);
    setGameOver(false);
    setWon(false);
    setOpenedSafe(0);
    setField(generateField(newSeed, minesCount));
    setGameHash("");
    setError("");
  };

  const handleMinesChange = (value: number) => {
    const clamped = Math.min(MAX_MINES, Math.max(MIN_MINES, value));
    setMinesCount(clamped);
    if (!gameOver && openedSafe === 0) {
      const newSeed = (Date.now() & 0xffffffff) + clamped;
      setGameSeed(newSeed);
      setField(generateField(newSeed, clamped));
    }
  };

  const fairMultiplier = calcFairMultiplier(minesCount, openedSafe);
  const houseMultiplier = fairMultiplier * HOUSE_EDGE;
  const displayMultiplier = gameOver && !won ? 0 : openedSafe <= 0 ? 1 : Number(houseMultiplier.toFixed(2));

  return (
    <div className="mines-container">
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
            disabled={openedSafe > 0 || loading}
            style={{ width: "120px", margin: 0, padding: "8px 12px", fontSize: "14px" }}
          />
        </div>
        <div className="panel-row">
          <span>Мин:</span>
          <strong>{minesCount}</strong>
        </div>
        <div className="panel-row panel-range">
          <span>Выбор мин:</span>
          <input
            type="range"
            min={MIN_MINES}
            max={MAX_MINES}
            value={minesCount}
            onChange={(e) => handleMinesChange(Number(e.target.value))}
            disabled={openedSafe > 0}
          />
        </div>
        {gameHash && (
          <div className="panel-row">
            <span>Hash:</span>
            <code style={{ fontSize: "10px" }}>{gameHash}</code>
          </div>
        )}
        {gameSeed && (
          <div className="panel-row">
            <span>Seed:</span>
            <code style={{ fontSize: "10px" }}>{gameSeed}</code>
          </div>
        )}
      </section>

      <section className="grid">
        {field.map((cell, idx) => {
          let label = "";
          if (cell.state === "hidden") label = "";
          if (cell.state === "safe") label = "✓";
          if (cell.state === "mine") label = "💣";

          return (
            <button
              key={idx}
              className={`cell cell-${cell.state}`}
              onClick={() => handleCellClick(idx)}
              disabled={gameOver || loading}
            >
              {label}
            </button>
          );
        })}
      </section>

      <section className="status">
        <p className="status-text">
          Открытых безопасных клеток: <strong>{openedSafe}</strong>
        </p>
        <p className="status-text">
          Текущий коэффициент (с учётом 4% преимущества казино): <strong>x{displayMultiplier}</strong>
        </p>
        {!gameOver && openedSafe > 0 && (
          <button className="primary" onClick={handleCashOut} disabled={loading}>
            {loading ? "Обработка..." : "Забрать выигрыш"}
          </button>
        )}
        {gameOver && (
          <>
            <p className={won ? "status-text win" : "status-text lose"}>
              {won ? "Вы выиграли!" : "Вы подорвались на мине"}
            </p>
            <button className="primary" onClick={handleRestart} disabled={loading}>
              Играть снова
            </button>
          </>
        )}
        {!gameOver && openedSafe === 0 && (
          <p className="status-text">Откройте ячейки и избегайте мин.</p>
        )}
      </section>
    </div>
  );
};

