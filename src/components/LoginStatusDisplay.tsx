import { css } from "@emotion/react";

const styles = {
  statusMessage: css`
    text-align: center;
    margin: var(--space-5) 0;
    padding: var(--space-4);
    border-radius: var(--radius);
    font-size: var(--text-sm);
    color: var(--text-primary);
    background-color: var(--blue-50);
    border: 1px solid var(--blue-200);
    box-shadow: var(--shadow-sm);
  `,
  loginMessage: css`
    text-align: center;
    margin: var(--space-10) auto;
    padding: var(--space-6);
    border-radius: var(--radius-md);
    max-width: 500px;
    background-color: var(--background-card);
    box-shadow: var(--shadow);
    color: var(--text-primary);
    font-size: var(--text-base);
    line-height: 1.6;
    border: 1px solid var(--border-light);
  `,
  code: css`
    display: inline-block;
    background-color: var(--gray-100);
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius-sm);
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    font-size: var(--text-sm);
    color: var(--primary);
    margin: 0 var(--space-1);
    border: 1px solid var(--border);
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
        <code css={styles.code}>VITE_EMAIL</code>、<code css={styles.code}>VITE_PASSWORD</code>、<code css={styles.code}>VITE_ACCOUNT_NUMBER</code>
        を設定してください。
        <br />
        設定後、アプリケーションを再読み込みしてください。
      </div>
    );
  }
  return null;
};

export default LoginStatusDisplay;
