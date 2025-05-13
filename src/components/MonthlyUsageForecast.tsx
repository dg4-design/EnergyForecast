import { css } from "@emotion/react";
import { useState, useEffect } from "react";
import { HalfHourlyReading } from "../services/api";
import { format, getDaysInMonth, getDate, startOfMonth, endOfMonth, isAfter, isBefore, isEqual } from "date-fns";
import { ja } from "date-fns/locale";
import { toJST } from "../utils/dateUtils";
import * as commonStyles from "../styles/commonStyles";

// 電力量料金（円/kWh）
const ELECTRICITY_RATE = 37.2;

interface MonthlyUsageForecastProps {
  data: HalfHourlyReading[];
  currentDate: Date;
  isLoading: boolean;
}

const styles = {
  forecastContainer: commonStyles.cardContainer,
  sectionTitle: commonStyles.sectionTitle,
  titleIcon: commonStyles.titleIcon,
  forecastContent: css`
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    gap: var(--space-4);
    flex-wrap: wrap;
    margin-bottom: var(--space-6);
  `,
  forecastItem: css`
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 200px;
    padding: var(--space-4) var(--space-5);
    background-color: var(--gray-50);
    border-radius: var(--radius);
    align-items: center;
    text-align: center;
    border: 1px solid var(--border-light);
    transition: transform var(--transition-fast);
  `,
  forecastLabel: css`
    font-weight: 500;
    color: var(--text-secondary);
    margin-bottom: var(--space-2);
    font-size: var(--text-sm);
  `,
  forecastValue: css`
    font-weight: 600;
    color: var(--accent);
    font-size: var(--text-xl);
  `,
  forecastDescription: commonStyles.descriptionText,
  loading: commonStyles.loadingMessage,
  progressContainer: css`
    margin-top: var(--space-4);
    background-color: var(--gray-100);
    height: 10px;
    border-radius: var(--radius-full);
    position: relative;
    overflow: hidden;
  `,
  progressBar: css`
    height: 100%;
    background-color: var(--accent);
    border-radius: var(--radius-full);
    transition: width 0.4s ease;
  `,
  progressLabel: css`
    margin-top: var(--space-2);
    display: flex;
    justify-content: space-between;
    font-size: var(--text-xs);
    color: var(--text-tertiary);
  `,
  monthLabel: commonStyles.monthLabel,
};

const MonthlyUsageForecast = ({ data, currentDate, isLoading }: MonthlyUsageForecastProps) => {
  const [forecastData, setForecastData] = useState<{
    currentTotal: number;
    dailyAverage: number;
    monthlyForecast: number;
    daysInMonth: number;
    currentDay: number;
    progressPercentage: number;
    currentCost: number;
    forecastCost: number;
  } | null>(null);

  useEffect(() => {
    if (data.length === 0 || isLoading) {
      setForecastData(null);
      return;
    }

    // 現在の月の最初と最後の日を取得
    const today = toJST(new Date());
    const firstDayOfMonth = startOfMonth(currentDate);
    const lastDayOfMonth = endOfMonth(currentDate);
    const daysInMonth = getDaysInMonth(currentDate);
    const currentDay = getDate(today);

    // 今月のデータのみをフィルタリング
    const currentMonthData = data.filter((reading) => {
      const readingDate = toJST(reading.startAt instanceof Date ? reading.startAt : new Date(reading.startAt));
      return (isAfter(readingDate, firstDayOfMonth) || isEqual(readingDate, firstDayOfMonth)) && (isBefore(readingDate, lastDayOfMonth) || isEqual(readingDate, lastDayOfMonth));
    });

    // 今月の合計使用量を計算
    const currentTotal = currentMonthData.reduce((sum, reading) => sum + (Number(reading.value) || 0), 0);

    // 日別使用量を計算
    const dailyUsage: { [key: string]: number } = {};
    currentMonthData.forEach((reading) => {
      const readingDate = toJST(reading.startAt instanceof Date ? reading.startAt : new Date(reading.startAt));
      const dateKey = format(readingDate, "yyyy-MM-dd");
      if (!dailyUsage[dateKey]) {
        dailyUsage[dateKey] = 0;
      }
      dailyUsage[dateKey] += Number(reading.value) || 0;
    });

    // 日別使用量の配列を作成
    const dailyUsageArray = Object.values(dailyUsage);

    let dailyAverage: number;

    // データが6日間以上ある場合は中央値5つの平均を使用
    if (dailyUsageArray.length >= 6) {
      // 使用量の多い順にソート
      const sortedDailyUsage = [...dailyUsageArray].sort((a, b) => b - a);

      // 中央の5つの値を取得（インデックス計算）
      const startIndex = Math.floor((sortedDailyUsage.length - 5) / 2);
      const middleFiveValues = sortedDailyUsage.slice(startIndex, startIndex + 5);

      // 中央値5つの平均を計算
      dailyAverage = middleFiveValues.reduce((sum, value) => sum + value, 0) / 5;
    } else {
      // 5日間以下の場合は単純平均
      dailyAverage = currentDay > 0 ? currentTotal / currentDay : 0;
    }

    // 月全体の予測使用量を計算
    const monthlyForecast = dailyAverage * daysInMonth;

    // 進捗率の計算
    const progressPercentage = (currentDay / daysInMonth) * 100;

    // 電力量料金の計算
    const currentCost = currentTotal * ELECTRICITY_RATE;
    const forecastCost = monthlyForecast * ELECTRICITY_RATE;

    setForecastData({
      currentTotal,
      dailyAverage,
      monthlyForecast,
      daysInMonth,
      currentDay,
      progressPercentage,
      currentCost,
      forecastCost,
    });
  }, [data, currentDate, isLoading]);

  // 月名を取得
  const monthName = format(currentDate, "M月", { locale: ja });

  // コンテンツ部分のみ条件に応じて変更
  let contentElement;
  if (isLoading) {
    contentElement = <div css={styles.loading}>読み込み中...</div>;
  } else if (!forecastData) {
    contentElement = <div css={styles.forecastDescription}>データが不足しているため、予測を計算できません。</div>;
  } else {
    contentElement = (
      <>
        <div css={styles.forecastContent}>
          <div css={styles.forecastItem}>
            <span css={styles.forecastLabel}>日平均使用量</span>
            <span css={styles.forecastValue}>{forecastData.dailyAverage.toFixed(2)} kWh</span>
          </div>

          <div css={styles.forecastItem}>
            <span css={styles.forecastLabel}>月間予測使用量</span>
            <span css={styles.forecastValue}>{forecastData.monthlyForecast.toFixed(2)} kWh</span>
          </div>

          <div css={styles.forecastItem}>
            <span css={styles.forecastLabel}>月間予測使用料金</span>
            <span css={styles.forecastValue}>{forecastData.forecastCost.toLocaleString()} 円</span>
          </div>
        </div>

        <div css={styles.forecastDescription}>
          今月の使用量データから、月末までの合計使用量を予測しています。
          <br />
          予測使用料金は{ELECTRICITY_RATE}円/kWhで計算しています。
          <br />
          実際の使用量や料金は生活パターンや天候などの影響により変動する可能性があります。
        </div>
      </>
    );
  }

  return (
    <div css={styles.forecastContainer}>
      <h3 css={styles.sectionTitle}>
        月間使用量予測
        <span css={styles.monthLabel}>{monthName}</span>
      </h3>
      {contentElement}
    </div>
  );
};

export default MonthlyUsageForecast;
