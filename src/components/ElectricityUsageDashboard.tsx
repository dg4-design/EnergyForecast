import { useState, useEffect, useCallback, useRef } from "react";
import ElectricityUsageChart, { ViewType } from "./ElectricityUsageChart"; // 同じディレクトリなのでパスを調整
import { apiService, HalfHourlyReading } from "../services/api"; // api.ts の場所に合わせて調整
import { getNowJST } from "../utils/dateUtils";
import { startOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, addDays, subMonths, addMonths, subYears, addYears, addWeeks, subWeeks } from "date-fns";
import { cacheService } from "../utils/cacheUtils";

// ヘルパー関数: 指定された日付とビュータイプに基づいて次の日付を計算
const calculateNextDate = (date: Date, viewType: ViewType): Date => {
  switch (viewType) {
    case "day":
      return addDays(date, 1);
    case "week":
      return addWeeks(date, 1);
    case "month":
      return addMonths(date, 1);
    case "year":
      return addYears(date, 1);
    default:
      return date;
  }
};

// ヘルパー関数: 指定された日付とビュータイプに基づいて前の日付を計算
const calculatePrevDate = (date: Date, viewType: ViewType): Date => {
  switch (viewType) {
    case "day":
      return subDays(date, 1);
    case "week":
      return subWeeks(date, 1);
    case "month":
      return subMonths(date, 1);
    case "year":
      return subYears(date, 1);
    default:
      return date;
  }
};

export interface ElectricityUsageDashboardProps {
  accountNumber: string;
  isLoggedIn: boolean; // isLoggedIn をPropsで受け取る
}

const ElectricityUsageDashboard = ({ accountNumber, isLoggedIn }: ElectricityUsageDashboardProps) => {
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [usageData, setUsageData] = useState<HalfHourlyReading[]>([]);
  const [viewType, setViewType] = useState<ViewType>("day");
  const [currentDate, setCurrentDate] = useState(getNowJST());
  const [displayedDate, setDisplayedDate] = useState<Date | null>(null);
  const [displayedViewType, setDisplayedViewType] = useState<ViewType | null>(null);
  const [nextPeriodData, setNextPeriodData] = useState<HalfHourlyReading[] | null>(null);
  const [prevPeriodData, setPrevPeriodData] = useState<HalfHourlyReading[] | null>(null);
  const [isNextLoading, setIsNextLoading] = useState(false);
  const [isPrevLoading, setIsPrevLoading] = useState(false);
  const initialLoadRef = useRef(true);
  const initialLoadCompleteRef = useRef(false);

  // キャッシュのクリーンアップを行う関数
  const cleanupExpiredCache = useCallback(() => {
    // 現在のキャッシュキーをすべて取得
    const allKeys = cacheService.getAllCacheKeys();

    // 電力使用量関連のキャッシュキーのみを対象にする
    const electricityKeys = allKeys.filter((key) => key.startsWith("electricity_usage_"));

    // キーの数が多すぎる場合は、一部を削除（例えば20件以上の場合）
    if (electricityKeys.length > 20) {
      // 古いキャッシュから順に削除（cacheServiceにキャッシュの年齢を取得する機能がある場合）
      // cacheServiceはタイムスタンプを内部で管理しているので、クリアだけ行う
      electricityKeys.slice(0, electricityKeys.length - 20).forEach((key) => {
        cacheService.remove(key);
      });
    }
  }, []);

  // コンポーネントマウント時にキャッシュクリーンアップを実行
  useEffect(() => {
    if (isLoggedIn && accountNumber) {
      cleanupExpiredCache();
    }

    // コンポーネントアンマウント時にもクリーンアップを実行（オプション）
    return () => {
      if (isLoggedIn && accountNumber) {
        cleanupExpiredCache();
      }
    };
  }, [isLoggedIn, accountNumber, cleanupExpiredCache]);

  const fetchPeriodData = useCallback(
    async (dateForPeriod: Date, type: ViewType) => {
      if (!isLoggedIn || !accountNumber) return null;

      let fromDate: Date;
      let toDate: Date;

      switch (type) {
        case "day":
          fromDate = startOfDay(subDays(dateForPeriod, 1));
          toDate = startOfDay(dateForPeriod);
          break;
        case "week":
          fromDate = startOfWeek(dateForPeriod, { weekStartsOn: 0 });
          toDate = endOfWeek(dateForPeriod, { weekStartsOn: 0 });
          break;
        case "month":
          fromDate = startOfMonth(dateForPeriod);
          toDate = endOfMonth(dateForPeriod);
          break;
        case "year":
          fromDate = startOfYear(dateForPeriod);
          toDate = endOfYear(dateForPeriod);
          const now = new Date();
          if (toDate > now) {
            toDate = now;
          }
          break;
        default:
          console.error("Unknown viewType for fetch:", type);
          return null;
      }

      try {
        const data = await apiService.getElectricityUsage({
          accountNumber,
          fromDatetime: fromDate.toISOString(),
          toDatetime: toDate.toISOString(),
        });
        return data;
      } catch (error) {
        console.error("データ取得エラー (fetchPeriodData - Dashboard):", error);
      }
      return null;
    },
    [isLoggedIn, accountNumber]
  );

  // パラメータからAPIリクエストのキーを生成するヘルパー関数
  const generateCacheKey = useCallback(
    (date: Date, type: ViewType): string => {
      let fromDate: Date;
      let toDate: Date;

      switch (type) {
        case "day":
          fromDate = startOfDay(subDays(date, 1));
          toDate = startOfDay(date);
          break;
        case "week":
          fromDate = startOfWeek(date, { weekStartsOn: 0 });
          toDate = endOfWeek(date, { weekStartsOn: 0 });
          break;
        case "month":
          fromDate = startOfMonth(date);
          toDate = endOfMonth(date);
          break;
        case "year":
          fromDate = startOfYear(date);
          toDate = endOfYear(date);
          const now = new Date();
          if (toDate > now) {
            toDate = now;
          }
          break;
        default:
          throw new Error(`Unknown viewType: ${type}`);
      }

      const params = {
        accountNumber,
        fromDatetime: fromDate.toISOString(),
        toDatetime: toDate.toISOString(),
        viewType: type, // viewTypeをキーに追加して、同じ日付範囲でもビュータイプが違えば別のキャッシュとして保存する
      };

      return `electricity_usage_${JSON.stringify(params)}`;
    },
    [accountNumber]
  );

  // ページ読み込み時にキャッシュをチェックする
  useEffect(() => {
    if (initialLoadRef.current && isLoggedIn && accountNumber) {
      initialLoadRef.current = false;

      // 現在の表示タイプと日付に基づいてキャッシュをチェック
      const checkCacheForCurrentView = async () => {
        try {
          const cacheKey = generateCacheKey(currentDate, viewType);
          const cachedData = cacheService.get<HalfHourlyReading[]>(cacheKey);

          if (cachedData) {
            // キャッシュからのデータをセット
            setUsageData(cachedData);
            setDisplayedDate(new Date(currentDate.getTime()));
            setDisplayedViewType(viewType);

            // グラフの強制再描画のために一時的にローディング状態にする
            setIsDataLoading(true);
            setTimeout(() => {
              setIsDataLoading(false);
            }, 10);

            // 次と前のデータも先にキャッシュをチェック
            const nextDateToFetch = calculateNextDate(currentDate, viewType);
            const prevDateToFetch = calculatePrevDate(currentDate, viewType);

            // 次のデータのキャッシュをチェック
            const nextCacheKey = generateCacheKey(nextDateToFetch, viewType);
            const nextCachedData = cacheService.get<HalfHourlyReading[]>(nextCacheKey);
            if (nextCachedData) {
              setNextPeriodData(nextCachedData);
            } else {
              // キャッシュがなければ非同期でフェッチ
              fetchPeriodData(nextDateToFetch, viewType).then((data) => {
                if (data) setNextPeriodData(data);
              });
            }

            // 前のデータのキャッシュをチェック
            const prevCacheKey = generateCacheKey(prevDateToFetch, viewType);
            const prevCachedData = cacheService.get<HalfHourlyReading[]>(prevCacheKey);
            if (prevCachedData) {
              setPrevPeriodData(prevCachedData);
            } else {
              // キャッシュがなければ非同期でフェッチ
              fetchPeriodData(prevDateToFetch, viewType).then((data) => {
                if (data) setPrevPeriodData(data);
              });
            }
          } else {
            // キャッシュがなければ通常のデータロードを行う
            setIsDataLoading(true);
            const mainData = await fetchPeriodData(currentDate, viewType);
            if (mainData) {
              setUsageData(mainData);
              setDisplayedDate(new Date(currentDate.getTime()));
              setDisplayedViewType(viewType);
            }
            setIsDataLoading(false);

            // 次と前のデータも非同期でロード
            const nextDateToFetch = calculateNextDate(currentDate, viewType);
            const prevDateToFetch = calculatePrevDate(currentDate, viewType);

            fetchPeriodData(nextDateToFetch, viewType).then((data) => {
              if (data) setNextPeriodData(data);
            });

            fetchPeriodData(prevDateToFetch, viewType).then((data) => {
              if (data) setPrevPeriodData(data);
            });
          }
        } finally {
          // 初回ロード完了を示すフラグをセット
          initialLoadCompleteRef.current = true;
        }
      };

      checkCacheForCurrentView();
    }
  }, [isLoggedIn, accountNumber, currentDate, viewType, fetchPeriodData, generateCacheKey]);

  // メインのデータロード処理（初回ロード以外）
  useEffect(() => {
    // 初回ロードの処理が完了していない場合は何もしない
    if (!initialLoadCompleteRef.current || !isLoggedIn || !accountNumber) return;

    let isMounted = true;

    const loadData = async () => {
      // 表示中のデータが現在の日付・ビュータイプと一致しない場合はデータをロード
      if (currentDate.getTime() !== displayedDate?.getTime() || viewType !== displayedViewType) {
        setIsDataLoading(true);
        const mainData = await fetchPeriodData(currentDate, viewType);
        if (isMounted) {
          if (mainData) {
            setUsageData(mainData);
            setDisplayedDate(new Date(currentDate.getTime()));
            setDisplayedViewType(viewType);
          }
          setIsDataLoading(false);
        }
      }

      // メインデータの表示が確定したら次/前のデータをバックグラウンドでロード
      if (isMounted && displayedDate && currentDate.getTime() === displayedDate.getTime() && viewType === displayedViewType) {
        setIsNextLoading(true);
        const nextDateToFetch = calculateNextDate(currentDate, viewType);
        fetchPeriodData(nextDateToFetch, viewType)
          .then((data) => {
            if (isMounted) setNextPeriodData(data);
          })
          .finally(() => {
            if (isMounted) setIsNextLoading(false);
          });

        setIsPrevLoading(true);
        const prevDateToFetch = calculatePrevDate(currentDate, viewType);
        fetchPeriodData(prevDateToFetch, viewType)
          .then((data) => {
            if (isMounted) setPrevPeriodData(data);
          })
          .finally(() => {
            if (isMounted) setIsPrevLoading(false);
          });
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [isLoggedIn, accountNumber, currentDate, viewType, displayedDate, displayedViewType, fetchPeriodData]);

  const handleViewTypeChange = (newViewType: ViewType) => {
    setViewType(newViewType);
    setNextPeriodData(null);
    setPrevPeriodData(null);

    // ビュータイプが変更された時にキャッシュクリーンアップを実行
    cleanupExpiredCache();
  };

  const handleNavigateDate = (direction: "prev" | "next") => {
    const targetDate = direction === "prev" ? calculatePrevDate(currentDate, viewType) : calculateNextDate(currentDate, viewType);

    if (direction === "next" && nextPeriodData && !isNextLoading) {
      setUsageData(nextPeriodData);
      setDisplayedDate(new Date(targetDate.getTime()));
      setDisplayedViewType(viewType);
      setCurrentDate(targetDate);
      setNextPeriodData(null);
    } else if (direction === "prev" && prevPeriodData && !isPrevLoading) {
      setUsageData(prevPeriodData);
      setDisplayedDate(new Date(targetDate.getTime()));
      setDisplayedViewType(viewType);
      setCurrentDate(targetDate);
      setPrevPeriodData(null);
    } else {
      setCurrentDate(targetDate);
    }

    // 日付が変更された時にもキャッシュクリーンアップを実行
    cleanupExpiredCache();
  };

  if (!isLoggedIn) {
    // isLoggedIn が false の場合は何も表示しないか、ローディングとは別のメッセージを出す
    // App.tsx側でLoginStatusDisplayが表示されるので、ここではnullを返せば良い
    return null;
  }

  return (
    <>
      {/* App.tsxのformContainer関連のUIはここに移動する想定だったが、
          現状のApp.tsxには具体的なフォームUIがないため、一旦チャートのみ表示する。
          もし日付範囲選択などのUIを復活させる場合は、ここに実装する。
          <div css={styles.formContainer}> ... </div>
      */}
      <ElectricityUsageChart
        key={`chart-${viewType}-${currentDate.getTime()}-${usageData.length}`}
        data={usageData}
        isLoading={isDataLoading}
        viewType={viewType}
        currentDate={currentDate}
        onViewTypeChange={handleViewTypeChange}
        onNavigateDate={handleNavigateDate}
        hasNextData={!!nextPeriodData && nextPeriodData.length > 0}
        hasPrevData={!!prevPeriodData && prevPeriodData.length > 0}
        isLoadingNext={isNextLoading}
        isLoadingPrev={isPrevLoading}
      />
    </>
  );
};

export default ElectricityUsageDashboard;
