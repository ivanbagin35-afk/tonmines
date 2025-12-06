import React, { useState, useEffect } from "react";
import { useTonWallet } from "@tonconnect/ui-react";
import { api } from "../api";
import "./AdminPanel.css";

interface Withdrawal {
  id: number;
  wallet: string;
  amountTon: number;
  createdAt: number;
}

export const AdminPanel: React.FC<{ onBack: () => void }> = ({ onBack }) => {
  const wallet = useTonWallet();
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [refreshing, setRefreshing] = useState(false);

  const loadPendingWithdrawals = async () => {
    try {
      setRefreshing(true);
      
      if (!wallet?.account?.address) {
        setError("Подключите кошелек для доступа к админ-панели");
        return;
      }

      const walletAddress = wallet.account.address;
      const response = await fetch(`/admin/withdrawals/pending?adminAddress=${encodeURIComponent(walletAddress)}`);
      if (!response.ok) {
        if (response.status === 403 || response.status === 401) {
          throw new Error("У вас нет прав доступа к админ-панели. Этот адрес не является администратором.");
        }
        throw new Error("Failed to load withdrawals");
      }
      const data = await response.json();
      setWithdrawals(data.withdrawals || []);
      setError("");
    } catch (err: any) {
      setError(err.message || "Ошибка загрузки запросов на вывод");
      console.error("Failed to load withdrawals:", err);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadPendingWithdrawals();
    // Автообновление каждые 5 секунд
    const interval = setInterval(loadPendingWithdrawals, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleApprove = async (withdrawalId: number) => {
    if (!confirm(`Подтвердить вывод #${withdrawalId}?`)) {
      return;
    }

    if (!wallet?.account?.address) {
      setError("Подключите кошелек");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const response = await fetch(`/admin/withdrawals/${withdrawalId}/approve?adminAddress=${encodeURIComponent(wallet.account.address)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Ошибка подтверждения");
      }

      const result = await response.json();
      alert(`Вывод #${withdrawalId} подтвержден! TX Hash: ${result.txHash || "N/A"}`);
      await loadPendingWithdrawals();
    } catch (err: any) {
      setError(err.message || "Ошибка подтверждения вывода");
      console.error("Failed to approve withdrawal:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (withdrawalId: number) => {
    const reason = prompt("Причина отклонения (необязательно):");
    if (reason === null) {
      return; // Пользователь отменил
    }

    if (!wallet?.account?.address) {
      setError("Подключите кошелек");
      return;
    }

    try {
      setLoading(true);
      setError("");
      const response = await fetch(`/admin/withdrawals/${withdrawalId}/reject?adminAddress=${encodeURIComponent(wallet.account.address)}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason: reason || undefined }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Ошибка отклонения");
      }

      alert(`Вывод #${withdrawalId} отклонен`);
      await loadPendingWithdrawals();
    } catch (err: any) {
      setError(err.message || "Ошибка отклонения вывода");
      console.error("Failed to reject withdrawal:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString("ru-RU");
  };

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <button onClick={onBack} className="admin-back-button">
          ← Назад
        </button>
        <h2>Админ-панель</h2>
        <button
          onClick={loadPendingWithdrawals}
          disabled={refreshing}
          className="admin-refresh-button"
        >
          {refreshing ? "Обновление..." : "🔄 Обновить"}
        </button>
      </div>

      {error && (
        <div className="admin-error">
          {error}
        </div>
      )}

      <div className="admin-content">
        <h3>Запросы на вывод (ожидают подтверждения)</h3>
        {withdrawals.length === 0 ? (
          <div className="admin-empty">
            Нет запросов на вывод
          </div>
        ) : (
          <div className="admin-withdrawals-list">
            {withdrawals.map((withdrawal) => (
              <div key={withdrawal.id} className="admin-withdrawal-item">
                <div className="withdrawal-info">
                  <div className="withdrawal-id">#{withdrawal.id}</div>
                  <div className="withdrawal-wallet">
                    {withdrawal.wallet.slice(0, 8)}...{withdrawal.wallet.slice(-8)}
                  </div>
                  <div className="withdrawal-amount">
                    {withdrawal.amountTon.toFixed(4)} TON
                  </div>
                  <div className="withdrawal-date">
                    {formatDate(withdrawal.createdAt)}
                  </div>
                </div>
                <div className="withdrawal-actions">
                  <button
                    onClick={() => handleApprove(withdrawal.id)}
                    disabled={loading}
                    className="admin-button approve-button"
                  >
                    ✓ Подтвердить
                  </button>
                  <button
                    onClick={() => handleReject(withdrawal.id)}
                    disabled={loading}
                    className="admin-button reject-button"
                  >
                    ✗ Отклонить
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

