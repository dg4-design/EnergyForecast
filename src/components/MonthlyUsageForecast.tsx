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
    margin-top: 24px;
    width: 100%;
    max-width: 800px;
    margin-left: auto;
    margin-right: auto;
    padding: 20px;
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  `,
  sectionTitle: css`
    font-size: 18px;
    font-weight: bold;
    margin-bottom: 16px;
    color: #333;
    display: flex;
    align-items: center;
    gap: 8px;
  `,
  forecastContent: css`
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  `,
  forecastItem: css`
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 200px;
    padding: 12px 16px;
    background-color: #f8f9fa;
    border-radius: 6px;
    align-items: center;
    text-align: center;
  `,
  forecastLabel: css`
    font-weight: 500;
    color: #495057;
    margin-bottom: 8px;
  `,
  forecastValue: css`
    font-weight: bold;
    color: #0062cc;
  `,
  forecastDescription: css`
    margin-top: 12px;
    font-size: 14px;
    color: #6c757d;
    line-height: 1.5;
  `,
  loading: css`
    color: #6c757d;
    text-align: center;
    padding: 20px;
  `,
  progressContainer: css`
    margin-top: 16px;
    background-color: #e9ecef;
    height: 12px;
    border-radius: 6px;
    position: relative;
    overflow: hidden;
  `,
  progressBar: css`
    height: 100%;
    background-color: #0062cc;
    border-radius: 6px;
    transition: width 0.3s ease;
  `,
  progressLabel: css`
    margin-top: 8px;
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    color: #6c757d;
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
        <h3 css={styles.sectionTitle}>月間使用量予測</h3>
        <div css={styles.loading}>読み込み中...</div>
      </div>
    );
  }

  if (!forecastData) {
    return (
      <div css={styles.forecastContainer}>
        <h3 css={styles.sectionTitle}>月間使用量予測</h3>
        <div css={styles.forecastDescription}>データが不足しているため、予測を計算できません。</div>
      </div>
    );
  }

  const monthName = format(currentDate, "M月", { locale: ja });

  return (
    <div css={styles.forecastContainer}>
      <h3 css={styles.sectionTitle}>
        <span>月間使用量予測</span>
        <span>({monthName})</span>
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
