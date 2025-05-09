import { css } from "@emotion/react";
import { useState, useEffect, useCallback } from "react";
import ElectricityUsageChart, { ViewType } from "./components/ElectricityUsageChart";
import { apiService, HalfHourlyReading } from "./services/api"; // 実際のAPIのみを使用
import { getNowJST } from "./utils/dateUtils"; // formatToDateTimeLocal は不要になるかもしれません
import { getCredentialsFromEnv, hasEnvCredentials } from "./utils/envUtils";
import { startOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, addDays, subMonths, addMonths, subYears, addYears, addWeeks, subWeeks } from "date-fns";

const styles = {
  container: css`
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background-color: #f4f7f9; // 全体の背景色を少し変更
  `,
  header: css`
    background-color: #ffffff; // ヘッダー背景色
    padding: 20px 32px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    text-align: center;
  `,
  title: css`
    font-size: 28px; // 少し大きく
    font-weight: bold;
    color: #333; // タイトルの色を変更
    margin: 0;
  `,
  mainContent: css`
    flex-grow: 1;
    max-width: 1200px;
    width: 100%;
    margin: 32px auto;
    padding: 0 16px; // 左右のパディングを調整
  `,
  formContainer: css`
    background-color: #ffffff;
    padding: 24px;
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    margin-bottom: 32px;
  `,
  dateRangeSelector: css`
    display: flex;
    flex-direction: column; // 縦並びに変更
    gap: 20px; // 要素間のスペースを調整
    align-items: stretch; // 要素を親の幅に広げる
    // 日付選択UIがなくなるため、一旦コメントアウトまたは調整
    /* @media (min-width: 768px) {
      // ある程度の画面幅からは横並び
      flex-direction: row;
      justify-content: center;
      align-items: center;
    } */
  `,
  dateInputContainer: css`
    // 日付入力とラベルのコンテナ
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex-grow: 1;
  `,
  dateLabel: css`
    font-size: 14px;
    color: #555;
    margin-bottom: 4px; // ラベルと入力欄の間のスペース
  `,
  dateInput: css`
    padding: 10px 14px; // パディングを少し大きく
    border: 1px solid #ccd1d9; // ボーダーの色を調整
    border-radius: 6px; // 角丸を少し調整
    font-size: 16px;
    color: #333;
    background-color: #fff; // 背景色を明示
    &:focus {
      border-color: #3498db;
      outline: none;
      box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.2);
    }
  `,
  button: css`
    padding: 12px 20px; // パディングを調整
    background-color: #3498db;
    color: white;
    border: none;
    border-radius: 6px; // 角丸を調整
    font-size: 16px;
    font-weight: bold;
    cursor: pointer;
    transition: background-color 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
    text-align: center; // ボタン内のテキストを中央揃え

    &:hover {
      background-color: #2980b9;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    &:disabled {
      background-color: #bdc3c7; // disabled時の色を調整
      cursor: not-allowed;
      box-shadow: none;
    }
  `,
  // accountスタイルは現状ログインフォームがないため一旦コメントアウト
  // account: css`
  //   text-align: center;
  //   margin-bottom: 16px;
  //   font-size: 14px;
  //   color: #7f8c8d;
  // `,
  // accountInput: css`
  //   padding: 8px 12px;
  //   border: 1px solid #ddd;
  //   border-radius: 4px;
  //   font-size: 16px;
  //   margin-left: 8px;
  //   width: 200px;
  // `,
  statusMessage: css`
    text-align: center;
    margin: 20px 0; // 上下のマージンを追加
    padding: 16px;
    border-radius: 6px;
    font-size: 16px;
    color: #555;
    background-color: #e9edf0; // 背景色を少しつける
  `,
  loginMessage: css`
    // ログインメッセージ専用のスタイル
    text-align: center;
    margin: 40px auto;
    padding: 24px;
    border-radius: 8px;
    max-width: 500px;
    background-color: #ffffff;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    color: #333;
    font-size: 16px;
    line-height: 1.6;
  `,
};

// ヘルパー関数: 指定された日付とビュータイプに基づいて次の日付を計算
const calculateNextDate = (date: Date, viewType: ViewType): Date => {
  switch (viewType) {
    case "day":
      return addDays(date, 1);
    case "week":
      return addWeeks(date, 1); // date-fnsのaddWeeksを使用
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
      return subWeeks(date, 1); // date-fnsのsubWeeksを使用
    case "month":
      return subMonths(date, 1);
    case "year":
      return subYears(date, 1);
    default:
      return date;
  }
};

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [isDataLoading, setIsDataLoading] = useState(false);
  const [usageData, setUsageData] = useState<HalfHourlyReading[]>([]);

  // viewType と currentDate の state を管理
  const [viewType, setViewType] = useState<ViewType>("day");
  const [currentDate, setCurrentDate] = useState(getNowJST()); // 表示の基準となる日付

  // 実際に usageData に表示されているデータの期間を示すための state
  const [displayedDate, setDisplayedDate] = useState<Date | null>(null);
  const [displayedViewType, setDisplayedViewType] = useState<ViewType | null>(null);

  // 先行読み込み用のstate
  const [nextPeriodData, setNextPeriodData] = useState<HalfHourlyReading[] | null>(null);
  const [prevPeriodData, setPrevPeriodData] = useState<HalfHourlyReading[] | null>(null);
  const [isNextLoading, setIsNextLoading] = useState(false); // 次の期間のデータロード中
  const [isPrevLoading, setIsPrevLoading] = useState(false); // 前の期間のデータロード中

  // アカウント番号の初期設定
  const [accountNumber, setAccountNumber] = useState("");

  // 環境変数から認証情報を取得して自動ログイン
  useEffect(() => {
    const autoLogin = async () => {
      if (hasEnvCredentials()) {
        const credentials = getCredentialsFromEnv();
        if (credentials) {
          setIsLoginLoading(true);

          try {
            // アカウント番号を設定
            setAccountNumber(credentials.accountNumber);

            // 自動ログイン
            await apiService.login({
              email: credentials.email,
              password: credentials.password,
            });

            setIsLoggedIn(true);
          } catch (error) {
            console.error("自動ログインエラー:", error);
          } finally {
            setIsLoginLoading(false);
          }
        }
      }
    };

    autoLogin();
  }, []);

  // 特定の期間のデータを取得する関数 (表示データの設定は行わない)
  const fetchPeriodData = useCallback(
    async (dateForPeriod: Date, type: ViewType) => {
      if (!isLoggedIn || !accountNumber) return null;
      // setIsDataLoading(true); // ここでは制御しない

      let fromDate: Date;
      let toDate: Date;

      // ユーザー指定のデフォルト範囲ロジックを適用
      switch (type) {
        case "day":
          fromDate = startOfDay(subDays(dateForPeriod, 1)); // 昨日の0時
          toDate = startOfDay(dateForPeriod); // 今日の0時
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
          // 年表示では一年分のデータを可能な限り取得するように調整
          // ただし現在の日付以降のデータはないので、実際に取得するのは過去〜現在までのデータ
          const now = new Date();
          if (toDate > now) {
            toDate = now;
          }
          break;
        default:
          console.error("Unknown viewType for fetch:", type);
          // if (!isPrefetch) setIsDataLoading(false);
          return null;
      }

      try {
        const data = await apiService.getElectricityUsage({
          accountNumber,
          fromDatetime: fromDate.toISOString(),
          toDatetime: toDate.toISOString(),
        });
        // if (!isPrefetch) setUsageData(data); // ここでは設定しない
        return data; // 取得したデータを返す
      } catch (error) {
        console.error("データ取得エラー (fetchPeriodData):", error);
        // トークンリフレッシュ試行はapiService内で行われる想定
        // ここではエラーをキャッチしてnullを返すか、再度試行するかなど検討
        if (
          typeof error === "object" &&
          error !== null &&
          "response" in error &&
          typeof (error as any).response === "object" && // (error as any) は苦肉の策ですが、簡潔さのため
          (error as any).response !== null &&
          "status" in (error as any).response &&
          (error as any).response.status === 401
        ) {
          try {
            await apiService.refreshAuthToken();
            // 再度データを取得
            const data = await apiService.getElectricityUsage({
              accountNumber,
              fromDatetime: fromDate.toISOString(),
              toDatetime: toDate.toISOString(),
            });
            // if (!isPrefetch) setUsageData(data);
            return data;
          } catch (refreshError) {
            console.error("トークンリフレッシュエラー後、データ再取得失敗:", refreshError);
            setIsLoggedIn(false); // ログイン状態を解除
          }
        }
      } finally {
        // if (!isPrefetch) setIsDataLoading(false); // ここでは制御しない
      }
      return null;
    },
    [isLoggedIn, accountNumber]
  );

  // メインデータと先行読み込みデータを管理するuseEffect
  useEffect(() => {
    if (!isLoggedIn || !accountNumber) return;

    let isMounted = true; // クリーンアップ関数用

    const loadData = async () => {
      // 1. メインデータの取得が必要か判断
      if (
        currentDate.getTime() !== displayedDate?.getTime() || // Dateオブジェクト比較はgetTime()で
        viewType !== displayedViewType
      ) {
        setIsDataLoading(true);
        const mainData = await fetchPeriodData(currentDate, viewType);
        if (isMounted) {
          if (mainData) {
            setUsageData(mainData);
            setDisplayedDate(new Date(currentDate.getTime())); // 新しいDateオブジェクトとして設定
            setDisplayedViewType(viewType);
          }
          setIsDataLoading(false);
        }
      } else {
        // displayedDate と currentDate が一致している場合、メインデータは最新
        // この場合でも先行読み込みは走らせる必要があるか確認
        // 通常は↑のifブロックでdisplayedDateが更新された後に先行読み込みが走る設計
      }

      // 2. 先行読み込み (メインデータ取得が終わったか、不要だった後に行う)
      //    現在の表示データ (displayedDate) がユーザーの目標 (currentDate) と一致している場合に実行
      if (
        isMounted &&
        displayedDate && // displayedDateがnullでないことを確認
        currentDate.getTime() === displayedDate.getTime() &&
        viewType === displayedViewType
      ) {
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
    // displayedDate/ViewType は useEffect 内で適切に更新されるため、ここではリセット不要
    // 先行読み込みデータはクリア
    setNextPeriodData(null);
    setPrevPeriodData(null);
  };

  const handleNavigateDate = (direction: "prev" | "next") => {
    const targetDate = direction === "prev" ? calculatePrevDate(currentDate, viewType) : calculateNextDate(currentDate, viewType); // ナビゲーション先の目標日付

    if (direction === "next" && nextPeriodData && !isNextLoading) {
      setUsageData(nextPeriodData);
      setDisplayedDate(new Date(targetDate.getTime())); // 表示データを更新
      setDisplayedViewType(viewType);
      setCurrentDate(targetDate); // 目標日付を更新 -> useEffectで先行読み込みがトリガーされる
      setNextPeriodData(null); // 消費したのでクリア
      // 前の期間のデータは、現在のメインデータ (元nextPeriodData) を使うのではなく、
      // useEffectに任せて再フェッチさせるか、適切に管理する必要がある。
      // ここではシンプルに、次のuseEffect実行時に再計算・再フェッチされるようにする。
      // setPrevPeriodData(usageData); // これは正しくない場合がある
    } else if (direction === "prev" && prevPeriodData && !isPrevLoading) {
      setUsageData(prevPeriodData);
      setDisplayedDate(new Date(targetDate.getTime())); // 表示データを更新
      setDisplayedViewType(viewType);
      setCurrentDate(targetDate); // 目標日付を更新
      setPrevPeriodData(null);
      // setNextPeriodData(usageData); // これも正しくない場合がある
    } else {
      // 先行読み込みデータがない、またはロード中の場合
      // currentDate を更新して useEffect による通常のデータ取得に任せる
      // この際 displayedDate と currentDate が異なるため、メインデータ取得が走る
      setCurrentDate(targetDate);
    }
  };

  return (
    <div css={styles.container}>
      <header css={styles.header}>
        <h1 css={styles.title}>電力使用量モニター</h1>
      </header>
      <main css={styles.mainContent}>
        {isLoginLoading ? (
          <div css={styles.statusMessage}>ログイン中...</div>
        ) : !isLoggedIn ? (
          <div css={styles.loginMessage}>
            ログインするには環境変数に
            <code>VITE_EMAIL</code>、<code>VITE_PASSWORD</code>、<code>VITE_ACCOUNT_NUMBER</code>
            を設定してください。
            <br />
            設定後、アプリケーションを再読み込みしてください。
          </div>
        ) : (
          <>
            <ElectricityUsageChart
              data={usageData} // 常に最新の表示対象データを渡す
              isLoading={isDataLoading} // メインのデータがロード中かどうかのフラグ
              viewType={viewType}
              currentDate={currentDate}
              onViewTypeChange={handleViewTypeChange}
              onNavigateDate={handleNavigateDate}
              // ボタンの有効/無効状態を渡す
              hasNextData={!!nextPeriodData && nextPeriodData.length > 0}
              hasPrevData={!!prevPeriodData && prevPeriodData.length > 0}
              isLoadingNext={isNextLoading}
              isLoadingPrev={isPrevLoading}
            />
          </>
        )}
      </main>
    </div>
  );
};

export default App;
