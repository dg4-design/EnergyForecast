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
    background-color: var(--background);
  `,
  header: css`
    background-color: var(--background-card);
    padding: var(--space-4) var(--space-8);
    box-shadow: var(--shadow);
    border-bottom: 1px solid var(--border-light);
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;

    @media (max-width: 768px) {
      padding: var(--space-3) var(--space-4);
    }
  `,
  headerContent: css`
    max-width: 1200px;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  `,
  logoContainer: css`
    display: flex;
    align-items: center;
    gap: var(--space-3);
  `,
  logo: css`
    width: 32px;
    height: 32px;
    flex-shrink: 0;

    @media (max-width: 768px) {
      width: 28px;
      height: 28px;
    }
  `,
  title: css`
    font-size: var(--text-2xl);
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
    letter-spacing: -0.025em;
    background: linear-gradient(135deg, var(--teal-400) 0%, var(--teal-700) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    position: relative;

    @media (max-width: 768px) {
      font-size: var(--text-xl);
    }
  `,
  mainContent: css`
    flex-grow: 1;
    max-width: 1200px;
    width: 100%;
    margin: var(--space-8) auto;
    padding: 0 var(--space-4);

    @media (max-width: 768px) {
      margin: var(--space-4) auto;
      padding: 0 var(--space-3);
    }
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
        <div css={styles.headerContent}>
          <div css={styles.logoContainer}>
            <svg css={styles.logo} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
              <polygon fill="var(--accent)" points="88.2 6.5 23.7 71 43.6 71 88.2 26.4 88.2 6.5" />
              <polygon fill="var(--accent)" points="84.4 57 39.8 101.6 39.8 121.5 104.3 57 84.4 57" />
            </svg>
            <h1 css={styles.title}>EnergyForecast</h1>
          </div>
        </div>
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
