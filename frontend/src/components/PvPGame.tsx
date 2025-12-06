import React, { useState, useEffect, useRef } from "react";
import { Address } from "@ton/core";
import { api } from "../api";
import "./PvPGame.css";

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
    console.error("[PvP] Failed to convert address to UQ:", address, err);
    throw err;
  }
}

interface PvPGameProps {
  walletAddress: string;
  balance: number;
  onBalanceUpdate: () => void;
  onBack: () => void;
}

interface PvPBet {
  amountTon: number;
  tickets?: number;
}

interface PvPPlayer {
  wallet: string;
  amountTon: number;
  bets?: PvPBet[];
  totalTickets?: number;
  color: string;
}

interface PvPState {
  players: PvPPlayer[];
  countdown: number | null;
  winnerWallet: string | null;
}

export const PvPGame: React.FC<PvPGameProps> = ({ walletAddress, balance, onBalanceUpdate, onBack }) => {
  const [pvpState, setPvpState] = useState<PvPState>({
    players: [],
    countdown: null,
    winnerWallet: null,
  });
  const [betAmount, setBetAmount] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinAngle, setSpinAngle] = useState(0);
  const previousCountdown = useRef<number | null>(null);
  const previousWinner = useRef<string | null>(null);

  useEffect(() => {
    loadPvpState();
    const interval = setInterval(loadPvpState, 2000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (pvpState.countdown === null && previousCountdown.current !== null && pvpState.players.length > 0) {
      const timer = setTimeout(() => {
        loadPvpState();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [pvpState.winnerWallet, pvpState.players.length, pvpState.countdown]);

  useEffect(() => {
    if (previousCountdown.current !== null && pvpState.countdown === null && pvpState.players.length > 0) {
      startRouletteSpin();
    }
    previousCountdown.current = pvpState.countdown;

    if (!previousWinner.current && pvpState.winnerWallet) {
      setIsSpinning(false);
    }
    previousWinner.current = pvpState.winnerWallet;
  }, [pvpState.countdown, pvpState.winnerWallet, pvpState.players.length]);

  const loadPvpState = async () => {
    try {
      const data = await api.getPvpState();
      setPvpState(data);
    } catch (err) {
      console.error("Failed to load PvP state:", err);
    }
  };

  const startRouletteSpin = () => {
    setIsSpinning(true);
    let currentAngle = 0;
    const spinDuration = 3000;
    const startTime = Date.now();
    
    const spinInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      if (elapsed >= spinDuration) {
        clearInterval(spinInterval);
      } else {
        const progress = elapsed / spinDuration;
        const speed = 1 - progress;
        currentAngle += 20 * speed;
        setSpinAngle(currentAngle);
      }
    }, 16);
  };

  const handleJoin = async () => {
    const amount = parseFloat(betAmount);
    if (isNaN(amount) || amount <= 0) {
      setError("Введите корректную сумму ставки");
      return;
    }

    if (amount > balance) {
      setError("Недостаточно средств");
      return;
    }

    try {
      setLoading(true);
      setError("");
      await api.joinPvp(walletAddress, amount);
      await loadPvpState();
      onBalanceUpdate();
      setBetAmount("");
    } catch (err: any) {
      setError(err.message || "Ошибка присоединения к PvP");
    } finally {
      setLoading(false);
    }
  };

  const totalBank = pvpState.players.reduce((sum, p) => sum + p.amountTon, 0);
  const totalTickets = pvpState.players.reduce((sum, p) => sum + (p.totalTickets || 0), 0);
  const myPlayer = pvpState.players.find(p => p.wallet === walletAddress);

  const getWinnerPosition = () => {
    if (!pvpState.winnerWallet || pvpState.players.length === 0) return null;
    const winnerIndex = pvpState.players.findIndex(p => p.wallet === pvpState.winnerWallet);
    if (winnerIndex === -1) return null;
    return (winnerIndex / pvpState.players.length) * 360;
  };

  return (
    <div>
      <button onClick={onBack} className="back-button">← Назад</button>

      {error && (
        <div style={{ padding: "10px", background: "#ff4444", color: "white", margin: "10px", borderRadius: "5px" }}>
          {error}
        </div>
      )}

      <section className="panel">
        <div className="panel-row">
          <span>Общий банк:</span>
          <strong>{totalBank.toFixed(4)} TON</strong>
        </div>
        <div className="panel-row">
          <span>Всего билетов:</span>
          <strong>{totalTickets > 0 ? totalTickets : pvpState.players.reduce((sum, p) => {
            const tickets = p.totalTickets !== undefined ? p.totalTickets : Math.floor((p.amountTon || 0) * 1000);
            return sum + tickets;
          }, 0)}</strong>
        </div>
        <div className="panel-row">
          <span>Игроков:</span>
          <strong>{pvpState.players.length}</strong>
        </div>
        {pvpState.countdown !== null && (
          <div className="panel-row">
            <span>До розыгрыша:</span>
            <strong className="countdown-timer">{pvpState.countdown} сек</strong>
          </div>
        )}
        {pvpState.winnerWallet && (
          <div className="panel-row">
            <span>Победитель:</span>
            <strong style={{ color: "#4ade80" }}>
              {pvpState.winnerWallet === walletAddress ? "ВЫ!" : pvpState.winnerWallet.slice(0, 8) + "..."}
            </strong>
          </div>
        )}
      </section>

      {/* Рулетка - показываем всегда, даже пустую */}
      <section className="roulette-container">
        <div className="roulette-wrapper">
          <div 
            className={`roulette-wheel ${isSpinning ? 'spinning' : ''}`}
            style={{
              transform: `rotate(${spinAngle}deg)`,
              transition: isSpinning ? 'none' : 'transform 0.5s ease-out',
            }}
          >
            {(() => {
              // Если нет игроков - показываем пустое колесо
              if (pvpState.players.length === 0) {
                return (
                  <div
                    className="roulette-segment"
                    style={{
                      background: '#1e293b',
                      clipPath: 'none',
                      borderRadius: '50%',
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#64748b',
                      fontSize: '14px',
                    }}
                  >
                    Ожидание игроков...
                  </div>
                );
              }
              
              // Если один игрок - заливаем весь круг
              if (pvpState.players.length === 1) {
                const player = pvpState.players[0];
                const isWinner = player.wallet === pvpState.winnerWallet;
                return (
                  <div
                    key={player.wallet}
                    className={`roulette-segment ${isWinner ? 'winner' : ''}`}
                    style={{
                      background: player.color || "#4ade80",
                      clipPath: 'none',
                      borderRadius: '50%',
                      width: '100%',
                      height: '100%',
                    }}
                  >
                    <div 
                      className="segment-content" 
                      style={{ 
                        position: 'absolute',
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                      }}
                    >
                      <div className="segment-amount">{player.amountTon.toFixed(2)}</div>
                      <div className="segment-wallet">
                        {player.wallet === walletAddress ? "ВЫ" : player.wallet.slice(0, 6)}
                      </div>
                      <div className="segment-tickets" style={{ fontSize: "9px", opacity: 0.8 }}>
                        {player.totalTickets !== undefined ? player.totalTickets : Math.floor((player.amountTon || 0) * 1000)} бил.
                      </div>
                    </div>
                  </div>
                );
              }
              
              // Если больше одного игрока - делим пропорционально билетам
              const calculatedTotalTickets = pvpState.players.reduce((sum, p) => {
                const tickets = p.totalTickets !== undefined ? p.totalTickets : Math.floor((p.amountTon || 0) * 1000);
                return sum + tickets;
              }, 0);
              
              let currentAngle = -90;
              
              return pvpState.players.map((player, index) => {
                const playerTickets = player.totalTickets !== undefined 
                  ? player.totalTickets 
                  : Math.floor((player.amountTon || 0) * 1000);
                
                const segmentAngle = calculatedTotalTickets > 0 
                  ? (playerTickets / calculatedTotalTickets) * 360 
                  : 360 / pvpState.players.length;
                
                const startAngle = currentAngle;
                currentAngle += segmentAngle;
                
                const isWinner = player.wallet === pvpState.winnerWallet;
                const midAngle = startAngle + segmentAngle / 2;
                
                return (
                  <div
                    key={`${player.wallet}-${index}`}
                    className={`roulette-segment ${isWinner ? 'winner' : ''}`}
                    style={{
                      background: player.color || "#4ade80",
                      clipPath: `polygon(50% 50%, ${50 + 50 * Math.cos((startAngle * Math.PI) / 180)}% ${50 + 50 * Math.sin((startAngle * Math.PI) / 180)}%, ${50 + 50 * Math.cos((currentAngle * Math.PI) / 180)}% ${50 + 50 * Math.sin((currentAngle * Math.PI) / 180)}%)`,
                    }}
                  >
                    <div 
                      className="segment-content" 
                      style={{ 
                        position: 'absolute',
                        left: `${50 + 35 * Math.cos((midAngle * Math.PI) / 180)}%`,
                        top: `${50 + 35 * Math.sin((midAngle * Math.PI) / 180)}%`,
                        transform: 'translate(-50%, -50%)',
                      }}
                    >
                      <div className="segment-amount">{player.amountTon.toFixed(2)}</div>
                      <div className="segment-wallet">
                        {player.wallet === walletAddress ? "ВЫ" : player.wallet.slice(0, 6)}
                      </div>
                      <div className="segment-tickets" style={{ fontSize: "9px", opacity: 0.8 }}>
                        {playerTickets} бил.
                      </div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
          <div className="roulette-pointer">▼</div>
        </div>
      </section>

      <section className="panel">
        <div className="panel-row">
          <span>Ваша ставка:</span>
          <input
            type="number"
            placeholder="Сумма в TON"
            value={betAmount}
            onChange={(e) => setBetAmount(e.target.value)}
            className="input-field"
            step="0.01"
            min="0.01"
            disabled={pvpState.countdown === null && pvpState.players.length > 0 && pvpState.winnerWallet === null}
          />
        </div>
        <div className="panel-row">
          <button
            onClick={handleJoin}
            disabled={loading || !betAmount || pvpState.countdown === null && pvpState.players.length > 0 && pvpState.winnerWallet === null}
            className="action-button"
          >
            {loading ? "Обработка..." : myPlayer ? "Добавить ставку" : "Сделать ставку"}
          </button>
        </div>
        {myPlayer && (
          <div className="panel-row">
            <span>Ваши билеты:</span>
            <strong>{myPlayer.totalTickets !== undefined ? myPlayer.totalTickets : Math.floor((myPlayer.amountTon || 0) * 1000)}</strong>
          </div>
        )}
      </section>

      <section className="panel">
        <h3>Участники:</h3>
        {pvpState.players.length === 0 ? (
          <p style={{ color: "#64748b" }}>Нет участников</p>
        ) : (
          pvpState.players.map((player) => (
            <div key={player.wallet} className="panel-row">
              <span style={{ color: player.color || "#4ade80" }}>
                {player.wallet === walletAddress ? "ВЫ" : (() => {
                  const uq = toUQAddress(player.wallet);
                  return uq.slice(0, 8) + "...";
                })()}
              </span>
              <strong>
                {player.amountTon.toFixed(4)} TON ({player.totalTickets !== undefined ? player.totalTickets : Math.floor((player.amountTon || 0) * 1000)} бил.)
              </strong>
            </div>
          ))
        )}
      </section>
    </div>
  );
};


