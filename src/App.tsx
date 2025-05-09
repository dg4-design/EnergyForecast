import { css } from "@emotion/react";
import { useState, useEffect } from "react";
// import ElectricityUsageChart, { ViewType } from "./components/ElectricityUsageChart"; // 不要になる
import { apiService } from "./services/api";
// import { getNowJST } from "./utils/dateUtils"; // 不要になる
import { getCredentialsFromEnv, hasEnvCredentials } from "./utils/envUtils";
// import { startOfDay, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, addDays, subMonths, addMonths, subYears, addYears, addWeeks, subWeeks } from "date-fns"; // 不要になる
import LoginStatusDisplay from "./components/LoginStatusDisplay";
import ElectricityUsageDashboard from "./components/ElectricityUsageDashboard";

const styles = {
  container: css`
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background-color: #f4f7f9;
  `,
  header: css`
    background-color: #ffffff;
    padding: 20px 32px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    text-align: center;
  `,
  title: css`
    font-size: 28px;
    font-weight: bold;
    color: #333;
    margin: 0;
  `,
  mainContent: css`
    flex-grow: 1;
    max-width: 1200px;
    width: 100%;
    margin: 32px auto;
    padding: 0 16px;
  `,
  // formContainer, dateRangeSelector, dateInputContainer, dateLabel, dateInput, button, statusMessage, loginMessage は移動したので削除
};

// calculateNextDate, calculatePrevDate は ElectricityUsageDashboard.tsx に移動したので削除

const App = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoginLoading, setIsLoginLoading] = useState(false);
  const [accountNumber, setAccountNumber] = useState(""); // accountNumber は App で管理

  // isDataLoading, usageData, viewType, currentDate, displayedDate, displayedViewType, nextPeriodData, prevPeriodData, isNextLoading, isPrevLoading は ElectricityUsageDashboard に移動したので削除

  useEffect(() => {
    // 認証エラーハンドラを設定
    apiService.setAuthErrorHandler(() => {
      setIsLoggedIn(false);
      setAccountNumber("");
      // 必要であれば、ユーザーに再ログインを促すメッセージなどを表示する処理を追加
      console.error("認証トークンのリフレッシュに失敗しました。再度ログインが必要です。");
    });

    const autoLogin = async () => {
      if (hasEnvCredentials()) {
        const credentials = getCredentialsFromEnv();
        if (credentials) {
          setIsLoginLoading(true);
          try {
            setAccountNumber(credentials.accountNumber); // ここで accountNumber を設定
            await apiService.login({
              email: credentials.email,
              password: credentials.password,
            });
            setIsLoggedIn(true);
          } catch (error) {
            console.error("自動ログインエラー:", error);
            // ログイン失敗した場合、isLoggedIn は false のまま
          } finally {
            setIsLoginLoading(false);
          }
        }
      } else {
        // 環境変数がない場合は、ログイン試行中フラグをfalseにする
        setIsLoginLoading(false);
      }
    };
    autoLogin();
  }, []);

  // fetchPeriodData, useEffect (データロード関連), handleViewTypeChange, handleNavigateDate は ElectricityUsageDashboard に移動したので削除

  // トークンリフレッシュ失敗などで再度ログインが必要になった場合の処理を検討
  // 例えば、ElectricityUsageDashboard からエラーイベントを受け取って isLoggedIn を false にするなど

  return (
    <div css={styles.container}>
      <header css={styles.header}>
        <h1 css={styles.title}>EnergyForecast</h1>
      </header>
      <main css={styles.mainContent}>
        <LoginStatusDisplay isLoginLoading={isLoginLoading} isLoggedIn={isLoggedIn} />
        {isLoggedIn &&
          accountNumber && ( // ログイン済みでaccountNumberがあればダッシュボード表示
            <ElectricityUsageDashboard
              accountNumber={accountNumber}
              isLoggedIn={isLoggedIn} // isLoggedIn を渡す
            />
          )}
      </main>
    </div>
  );
};

export default App;
