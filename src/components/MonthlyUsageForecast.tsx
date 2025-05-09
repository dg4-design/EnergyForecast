import { css } from "@emotion/react";
import { useState, useEffect } from "react";
import { HalfHourlyReading } from "../services/api";
import { format, getDaysInMonth, getDate, startOfMonth, endOfMonth, isAfter, isBefore, isEqual } from "date-fns";
import { ja } from "date-fns/locale";
import { toJST } from "../utils/dateUtils";

// 電力量料金（円/kWh）
const ELECTRICITY_RATE = 37.2;

interface MonthlyUsageForecastProps {
  data: HalfHourlyReading[];
  currentDate: Date;
  isLoading: boolean;
}

const styles = {
  forecastContainer: css`
    margin-top: var(--space-6);
    width: 100%;
    max-width: 800px;
    margin-left: auto;
    margin-right: auto;
    padding: var(--space-6);
    background-color: var(--background-card);
    border-radius: var(--radius-md);
    box-shadow: var(--shadow);
    border: 1px solid var(--border-light);
  `,
  sectionTitle: css`
    font-size: var(--text-lg);
    font-weight: 600;
    margin-bottom: var(--space-4);
    color: var(--text-primary);
    display: flex;
    align-items: center;
    gap: var(--space-2);
  `,
  titleIcon: css`
    width: 18px;
    height: 18px;
    flex-shrink: 0;
  `,
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

    &:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-sm);
    }
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
  forecastDescription: css`
    margin-top: var(--space-4);
    font-size: var(--text-sm);
    color: var(--text-secondary);
    line-height: 1.6;
    background-color: var(--gray-50);
    padding: var(--space-4);
    border-radius: var(--radius);
    border: 1px solid var(--border-light);
  `,
  loading: css`
    color: var(--text-secondary);
    text-align: center;
    padding: var(--space-6);
  `,
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
  monthLabel: css`
    display: inline-flex;
    align-items: center;
    background-color: var(--teal-100);
    color: var(--teal-700);
    padding: var(--space-1) var(--space-3);
    border-radius: var(--radius-full);
    font-size: var(--text-xs);
    font-weight: 500;
    margin-left: var(--space-2);
  `,
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

    // 1日あたりの平均使用量を計算（今日までのデータで）
    const dailyAverage = currentDay > 0 ? currentTotal / currentDay : 0;

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

  if (isLoading) {
    return (
      <div css={styles.forecastContainer}>
        <h3 css={styles.sectionTitle}>
          <svg css={styles.titleIcon} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
            <polygon fill="var(--accent)" points="84.4 57 39.8 101.6 39.8 121.5 104.3 57 84.4 57" />
          </svg>
          月間使用量予測
        </h3>
        <div css={styles.loading}>読み込み中...</div>
      </div>
    );
  }

  if (!forecastData) {
    return (
      <div css={styles.forecastContainer}>
        <h3 css={styles.sectionTitle}>
          <svg css={styles.titleIcon} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
            <polygon fill="var(--accent)" points="84.4 57 39.8 101.6 39.8 121.5 104.3 57 84.4 57" />
          </svg>
          月間使用量予測
        </h3>
        <div css={styles.forecastDescription}>データが不足しているため、予測を計算できません。</div>
      </div>
    );
  }

  const monthName = format(currentDate, "M月", { locale: ja });

  return (
    <div css={styles.forecastContainer}>
      <h3 css={styles.sectionTitle}>
        <svg css={styles.titleIcon} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">
          <polygon fill="var(--accent)" points="84.4 57 39.8 101.6 39.8 121.5 104.3 57 84.4 57" />
        </svg>
        月間使用量予測
        <span css={styles.monthLabel}>{monthName}</span>
      </h3>

      <div css={styles.forecastContent}>
        <div css={styles.forecastItem}>
          <span css={styles.forecastLabel}>日平均使用量</span>
          <span css={styles.forecastValue}>{forecastData.dailyAverage.toFixed(2)} kWh/日</span>
        </div>

        <div css={styles.forecastItem}>
          <span css={styles.forecastLabel}>月間予測使用量</span>
          <span css={styles.forecastValue}>{forecastData.monthlyForecast.toFixed(2)} kWh</span>
        </div>

        <div css={styles.forecastItem}>
          <span css={styles.forecastLabel}>月間予測電力量料金</span>
          <span css={styles.forecastValue}>{forecastData.forecastCost.toLocaleString()} 円</span>
        </div>
      </div>

      <div css={styles.progressContainer}>
        <div css={styles.progressBar} style={{ width: `${Math.min(forecastData.progressPercentage, 100)}%` }} />
      </div>

      <div css={styles.progressLabel}>
        <span>1日</span>
        <span>{forecastData.daysInMonth}日</span>
      </div>

      <div css={styles.forecastDescription}>
        {monthName}の最初から今日までの平均使用量を元に、月末までの合計使用量を予測しています。
        <br />
        電力量料金は{ELECTRICITY_RATE}円/kWhで計算しています。
        <br />
        実際の使用量や料金は生活パターンや天候などの影響により変動する可能性があります。
      </div>
    </div>
  );
};

export default MonthlyUsageForecast;
