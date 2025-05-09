import { css } from "@emotion/react";

// 共通のカードコンテナスタイル
export const cardContainer = css`
  width: 100%;
  max-width: 800px;
  margin: 0 auto;
  margin-top: var(--space-6);
  padding: var(--space-6);
  background-color: var(--background-card);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow);
  border: 1px solid var(--border-light);
`;

// 共通のセクションタイトルスタイル
export const sectionTitle = css`
  font-size: var(--text-lg);
  font-weight: 600;
  margin-bottom: var(--space-4);
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: var(--space-2);
`;

// 共通のアイコンスタイル
export const titleIcon = css`
  width: 18px;
  height: 18px;
  flex-shrink: 0;
`;

// ローディングメッセージスタイル
export const loadingMessage = css`
  text-align: center;
  color: var(--text-secondary);
  padding: var(--space-6);
`;

// エラー/データなしメッセージスタイル
export const noDataMessage = css`
  text-align: center;
  color: var(--text-secondary);
  padding: var(--space-8) var(--space-4);
  background-color: var(--gray-50);
  border-radius: var(--radius);
  margin: 0;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: var(--text-base);
  border: 1px dashed var(--gray-200);
`;

// 月ラベルスタイル
export const monthLabel = css`
  display: inline-flex;
  align-items: center;
  background-color: var(--teal-100);
  color: var(--teal-700);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
  font-size: var(--text-xs);
  font-weight: 500;
  margin-left: var(--space-2);
`;

// 説明テキストスタイル
export const descriptionText = css`
  margin-top: var(--space-4);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  line-height: 1.6;
`;
