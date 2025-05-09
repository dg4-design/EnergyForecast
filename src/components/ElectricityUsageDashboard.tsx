import { css } from "@emotion/react";
import { useState, useEffect, useCallback } from "react";
import ElectricityUsageChart, { ViewType } from "./ElectricityUsageChart"; // 同じディレクトリなのでパスを調整
import { apiService, HalfHourlyReading } from "../services/api"; // api.ts の場所に合わせて調整
import { getNowJST } from "../utils/dateUtils";
import { startOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, addDays, subMonths, addMonths, subYears, addYears, addWeeks, subWeeks } from "date-fns";

const styles = {
  // App.tsxから移動するスタイル (formContainer, dateRangeSelector, dateInputContainer, dateLabel, dateInput, buttonなど)
  // 必要に応じてApp.tsxのものをベースに調整・追加する
  formContainer: css`
    background-color: #ffffff;
    padding: 24px;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    margin-bottom: 32px;
  `,
  // ... (App.tsxのstylesオブジェクトから関連するスタイルをここに移動・調整)
  statusMessage: css`
    // これはデータロード中のメッセージ用
    text-align: center;
    margin: 20px 0;
    padding: 16px;
    border-radius: 6px;
    font-size: 16px;
    color: #555;
    background-color: #e9edf0;
  `,
};

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

interface ElectricityUsageDashboardProps {
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

  useEffect(() => {
    if (!isLoggedIn || !accountNumber) return;

    let isMounted = true;

    const loadData = async () => {
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
      } else {
        // メインデータは最新
      }

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
