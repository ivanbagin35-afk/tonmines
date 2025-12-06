// API клиент для работы с backend
import { Address } from "@ton/core";

// Для локальной разработки используем прокси через Vite (относительные пути)
// Для продакшена используем абсолютный URL
const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "" : "https://tonimi.fun");

// Конвертирует адрес в UQ формат (V5 non-bounceable)
// UQ = non-bounceable, EQ = bounceable
// Для UQ используем bounceable: false
function toUQAddress(address: string): string {
  try {
    // Если адрес уже в формате UQ, возвращаем как есть
    if (address.startsWith('UQ')) {
      return address;
    }
    
    // Парсим адрес в любом формате (0:..., EQ..., UQ...)
    const parsed = Address.parse(address);
    
    // Получаем workchain и hash
    const workchain = parsed.workChain;
    const hash = parsed.hash;
    
    // Создаем новый адрес с теми же данными
    const newAddr = new Address(workchain, hash);
    
    // Для UQ формата используем bounceable: false (non-bounceable)
    const uqAddr = newAddr.toString({ 
      urlSafe: true, 
      bounceable: false,  // false = non-bounceable = UQ
      testOnly: false
    });
    
    // Проверяем что получили UQ
    if (!uqAddr.startsWith('UQ')) {
      throw new Error(`Failed to convert to UQ format. Got: ${uqAddr.substring(0, 2)}`);
    }
    
    return uqAddr;
  } catch (err) {
    console.error("[API] Failed to convert address to UQ format:", address, err);
    throw err;
  }
}

export interface BalanceResponse {
  wallet: string;
  balance: number;
}

export interface AdminCheckResponse {
  isAdmin: boolean;
}

export interface DepositRequest {
  wallet: string;
  amountTon: number;
}

export interface WithdrawRequest {
  address: string;
  amountTon: number;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  uptime: number;
  environment: string;
  wallet: string;
  version: string;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async getBalance(wallet: string): Promise<BalanceResponse> {
    try {
      // Конвертируем адрес в UQ формат
      const walletParam = toUQAddress(wallet);
      const encoded = encodeURIComponent(walletParam);
      
      const response = await fetch(`${this.baseUrl}/balance/${encoded}`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to get balance: ${response.status} ${response.statusText}`);
      }
      return response.json();
    } catch (err: any) {
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        throw new Error('Не удалось подключиться к серверу. Проверьте интернет-соединение.');
      }
      throw err;
    }
  }

  async deposit(wallet: string, amountTon: number): Promise<BalanceResponse> {
    try {
      // Конвертируем адрес в UQ формат
      const walletParam = toUQAddress(wallet);
      
      const response = await fetch(`${this.baseUrl}/deposit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ wallet: walletParam, amountTon }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let error;
        try {
          error = JSON.parse(errorText);
        } catch {
          error = { error: errorText || response.statusText };
        }
        console.error("[API] Deposit error:", error, response.status);
        throw new Error(error.error || `Failed to deposit: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log("[API] Deposit success:", result);
      return result;
    } catch (err: any) {
      console.error("[API] Deposit exception:", err);
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        throw new Error('Не удалось подключиться к серверу. Проверьте интернет-соединение.');
      }
      throw err;
    }
  }

  async subtractBalance(wallet: string, amountTon: number): Promise<BalanceResponse> {
    try {
      console.log("[API] subtractBalance INPUT:", wallet, "startsWith UQ:", wallet.startsWith('UQ'), "startsWith EQ:", wallet.startsWith('EQ'));
      
      // Конвертируем адрес в UQ формат
      const walletParam = toUQAddress(wallet);
      
      console.log("[API] subtractBalance AFTER CONVERSION:", walletParam, "startsWith UQ:", walletParam.startsWith('UQ'), "startsWith EQ:", walletParam.startsWith('EQ'));
      
      // КРИТИЧЕСКАЯ ПРОВЕРКА: адрес ДОЛЖЕН быть UQ
      if (!walletParam.startsWith('UQ')) {
        console.error("[API] CRITICAL: Address is not UQ after conversion!", { input: wallet, output: walletParam });
        throw new Error(`Cannot convert address to UQ. Input: ${wallet}, Output: ${walletParam}`);
      }
      
      const encoded = encodeURIComponent(walletParam);
      const url = `/balance/${encoded}/subtract`;
      
      console.log("[API] subtractBalance FINAL URL:", url, "contains UQ:", url.includes('UQ'), "contains EQ:", url.includes('EQ'));
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amountTon }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let error;
        try {
          error = JSON.parse(errorText);
        } catch {
          error = { error: errorText || response.statusText };
        }
        console.error("[API] Subtract balance error:", error, response.status, response.statusText, url);
        throw new Error(error.error || `Failed to subtract balance: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log("[API] Subtract balance success:", result);
      return result;
    } catch (err: any) {
      console.error("[API] Subtract balance exception:", err);
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        throw new Error('Не удалось подключиться к серверу. Проверьте интернет-соединение.');
      }
      throw err;
    }
  }

  async withdraw(address: string, amountTon: number): Promise<void> {
    const response = await fetch(`${this.baseUrl}/withdraw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ address, amountTon }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || `Failed to withdraw: ${response.statusText}`);
    }
  }

  async health(): Promise<HealthResponse> {
    const response = await fetch(`${this.baseUrl}/health`);
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.statusText}`);
    }
    return response.json();
  }

  async getPvpState(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/pvp/state`);
    if (!response.ok) {
      throw new Error(`Failed to get PvP state: ${response.statusText}`);
    }
    return response.json();
  }

  async joinPvp(wallet: string, amountTon: number): Promise<any> {
    try {
      // Конвертируем адрес в UQ формат
      const walletParam = toUQAddress(wallet);
      
      const response = await fetch(`${this.baseUrl}/pvp/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ wallet: walletParam, amountTon }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let error;
        try {
          error = JSON.parse(errorText);
        } catch {
          error = { error: errorText || response.statusText };
        }
        console.error("[API] Join PvP error:", error, response.status);
        throw new Error(error.error || `Failed to join PvP: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log("[API] Join PvP success:", result);
      return result;
    } catch (err: any) {
      console.error("[API] Join PvP exception:", err);
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        throw new Error('Не удалось подключиться к серверу. Проверьте интернет-соединение.');
      }
      throw err;
    }
  }

  async checkAdminAccess(wallet: string): Promise<AdminCheckResponse> {
    try {
      const walletParam = toUQAddress(wallet);
      const encoded = encodeURIComponent(walletParam);
      const response = await fetch(`${this.baseUrl}/admin/check?adminAddress=${encoded}`);
      if (!response.ok) {
        if (response.status === 403 || response.status === 401) {
          return { isAdmin: false };
        }
        throw new Error(`Failed to check admin access: ${response.status} ${response.statusText}`);
      }
      return await response.json();
    } catch (err: any) {
      console.error("[API] Check admin access error:", err);
      return { isAdmin: false };
    }
  }

  async restoreBalance(wallet: string, amountTon: number): Promise<BalanceResponse> {
    try {
      // Конвертируем адрес в UQ формат
      const walletParam = toUQAddress(wallet);
      
      const response = await fetch(`${this.baseUrl}/balance/restore`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ wallet: walletParam, amountTon }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        let error;
        try {
          error = JSON.parse(errorText);
        } catch {
          error = { error: errorText || response.statusText };
        }
        console.error("[API] Restore balance error:", error, response.status);
        throw new Error(error.error || `Failed to restore balance: ${response.status} ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log("[API] Restore balance success:", result);
      return result;
    } catch (err: any) {
      console.error("[API] Restore balance exception:", err);
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        throw new Error('Не удалось подключиться к серверу. Проверьте интернет-соединение.');
      }
      throw err;
    }
  }
}

export const api = new ApiClient();

