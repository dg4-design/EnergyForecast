interface CacheItem<T> {
  data: T;
  timestamp: number;
}

export interface CacheOptions {
  expirationTime: number; // ミリ秒単位
}

export class CacheService {
  private cache: Map<string, CacheItem<any>> = new Map();
  private defaultOptions: CacheOptions = {
    expirationTime: 3 * 60 * 60 * 1000, // デフォルトは3時間（ミリ秒）
  };
  private storageKey = "energy_forecast_cache";

  constructor() {
    this.loadCacheFromStorage();
  }

  /**
   * localStorageからキャッシュを読み込みます
   */
  private loadCacheFromStorage(): void {
    try {
      const storedCache = localStorage.getItem(this.storageKey);
      if (storedCache) {
        const parsedCache = JSON.parse(storedCache, this.dateReviver);
        // オブジェクトをMapに変換
        this.cache = new Map();
        // パースしたオブジェクトの各エントリをMapに追加
        Object.entries(parsedCache).forEach(([key, value]) => {
          if (value && typeof value === "object" && "data" in value && "timestamp" in value) {
            // データオブジェクトの日付文字列をDateオブジェクトに変換
            if (Array.isArray(value.data)) {
              value.data = value.data.map((item) => this.reconstructDates(item));
            } else if (value.data && typeof value.data === "object") {
              value.data = this.reconstructDates(value.data);
            }
            this.cache.set(key, value as CacheItem<any>);
          }
        });

        this.logCacheStatus();
      } else {
      }
    } catch (error) {
      console.error("localStorageからのキャッシュ読み込みエラー:", error);
      // エラーの場合は新しいキャッシュで開始
      this.cache = new Map();
    }
  }

  /**
   * JSON.parseで使用するリバイバー関数（日付文字列をDateオブジェクトに変換）
   */
  private dateReviver(key: string, value: any): any {
    // ISO形式の日付文字列を検出してDateオブジェクトに変換
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(value)) {
      return new Date(value);
    }
    return value;
  }

  /**
   * オブジェクト内の日付文字列をDateオブジェクトに再構築
   */
  private reconstructDates(obj: any): any {
    if (!obj || typeof obj !== "object") return obj;

    // 日付の検出と変換に使用する正規表現
    const isoDatePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;

    // オブジェクトのコピーを作成して変更
    const result = Array.isArray(obj) ? [...obj] : { ...obj };

    // オブジェクトの各プロパティをチェック
    Object.keys(result).forEach((key) => {
      const value = result[key];

      // 日付文字列の場合はDateオブジェクトに変換
      if (typeof value === "string" && isoDatePattern.test(value)) {
        result[key] = new Date(value);
      }
      // ネストされたオブジェクトの場合は再帰的に処理
      else if (value && typeof value === "object") {
        result[key] = this.reconstructDates(value);
      }
    });

    return result;
  }

  /**
   * キャッシュをlocalStorageに保存します
   */
  private saveCacheToStorage(): void {
    try {
      // Mapをオブジェクトに変換してから保存
      const cacheObject = Object.fromEntries(this.cache.entries());
      localStorage.setItem(this.storageKey, JSON.stringify(cacheObject));
    } catch (error) {
      console.error("localStorageへのキャッシュ保存エラー:", error);
      // 容量制限やプライベートブラウジングの場合は処理を続行
    }
  }

  /**
   * キャッシュからデータを取得します
   * @param key キャッシュのキー
   * @returns キャッシュが有効な場合はデータ、無効な場合はnull
   */
  get<T>(key: string): T | null {
    const cachedItem = this.cache.get(key);

    if (!cachedItem) {
      return null;
    }

    const now = Date.now();
    const age = now - cachedItem.timestamp;
    const expiresIn = this.defaultOptions.expirationTime - age;
    const expiresInMinutes = Math.floor(expiresIn / (60 * 1000));

    if (age > this.defaultOptions.expirationTime) {
      // キャッシュが期限切れの場合は削除
      this.cache.delete(key);
      this.saveCacheToStorage();
      return null;
    }

    return cachedItem.data as T;
  }

  /**
   * データをキャッシュに保存します
   * @param key キャッシュのキー
   * @param data 保存するデータ
   */
  set<T>(key: string, data: T): void {
    const dataSize = JSON.stringify(data).length;
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });

    // localStorageに保存
    this.saveCacheToStorage();

    // キャッシュの全体サイズをログに出力
    this.logCacheStatus();
  }

  /**
   * キャッシュを削除します
   * @param key キャッシュのキー
   */
  remove(key: string): void {
    this.cache.delete(key);
    this.saveCacheToStorage();
  }

  /**
   * すべてのキャッシュをクリアします
   */
  clear(): void {
    this.cache.clear();
    localStorage.removeItem(this.storageKey);
  }

  /**
   * キャッシュされているすべてのキーをリストアップします
   */
  getAllCacheKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * キャッシュの現在の状態を取得します
   */
  getCacheStatus(): { key: string; age: string; size: number }[] {
    const now = Date.now();
    return Array.from(this.cache.entries()).map(([key, item]) => {
      const ageMs = now - item.timestamp;
      const ageMinutes = Math.floor(ageMs / (60 * 1000));
      const ageHours = Math.floor(ageMinutes / 60);
      let ageStr: string;

      if (ageHours > 0) {
        ageStr = `${ageHours}時間${ageMinutes % 60}分`;
      } else {
        ageStr = `${ageMinutes}分`;
      }

      return {
        key: this.getShortKey(key),
        age: ageStr,
        size: JSON.stringify(item.data).length,
      };
    });
  }

  /**
   * キャッシュの全体状態をコンソールに出力します
   */
  logCacheStatus(): void {
    const totalKeys = this.cache.size;
    let totalSize = 0;

    this.cache.forEach((item) => {
      totalSize += JSON.stringify(item.data).length;
    });

    console.log(`キャッシュ状況: ${totalKeys}個のキー, 合計サイズ: ${this.formatSize(totalSize)}`);
  }

  /**
   * 経過時間を人間が読みやすい形式にフォーマットします
   */
  private formatAge(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}時間${minutes % 60}分`;
    } else if (minutes > 0) {
      return `${minutes}分${seconds % 60}秒`;
    } else {
      return `${seconds}秒`;
    }
  }

  /**
   * サイズを人間が読みやすい形式にフォーマットします
   */
  private formatSize(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes}B`;
    } else if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)}KB`;
    } else {
      return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    }
  }

  /**
   * デバッグ用にキーを短縮表示する
   */
  private getShortKey(key: string): string {
    if (key.length > 30) {
      return `${key.substring(0, 15)}...${key.substring(key.length - 15)}`;
    }
    return key;
  }
}

// シングルトンインスタンスをエクスポート
export const cacheService = new CacheService();
