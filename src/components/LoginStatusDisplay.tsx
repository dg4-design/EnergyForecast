import { css } from "@emotion/react";

const styles = {
  statusMessage: css`
    text-align: center;
    margin: 20px 0;
    padding: 16px;
    border-radius: 6px;
    font-size: 16px;
    color: #555;
    background-color: #e9edf0;
  `,
  loginMessage: css`
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

interface LoginStatusDisplayProps {
  isLoginLoading: boolean;
  isLoggedIn: boolean;
}

const LoginStatusDisplay = ({ isLoginLoading, isLoggedIn }: LoginStatusDisplayProps) => {
  if (isLoginLoading) {
    return <div css={styles.statusMessage}>ログイン中...</div>;
  }
  if (!isLoggedIn) {
    return (
      <div css={styles.loginMessage}>
        ログインするには環境変数に
        <code>VITE_EMAIL</code>、<code>VITE_PASSWORD</code>、<code>VITE_ACCOUNT_NUMBER</code>
        を設定してください。
        <br />
        設定後、アプリケーションを再読み込みしてください。
      </div>
    );
  }
  return null;
};

export default LoginStatusDisplay;
