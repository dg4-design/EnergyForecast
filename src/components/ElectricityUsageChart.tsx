import { css } from "@emotion/react";
import { useEffect, useRef, useState } from "react"; // useState を import に追加
import * as d3 from "d3";
import { HalfHourlyReading } from "../services/api";
import { toJST } from "../utils/dateUtils";
import { format, parse, addMinutes, startOfWeek, endOfWeek, subDays } from "date-fns"; // 必要な関数を追加
import { ja } from "date-fns/locale";

interface ElectricityUsageChartProps {
  data: HalfHourlyReading[];
  isLoading: boolean;
  viewType: ViewType;
  currentDate: Date;
  onViewTypeChange: (viewType: ViewType) => void;
  onNavigateDate: (direction: "prev" | "next") => void;
  hasNextData: boolean;
  hasPrevData: boolean;
  isLoadingNext: boolean;
  isLoadingPrev: boolean;
}

// type ViewType = "day" | "week" | "month" | "year"; // App.tsx で定義済みのものを使用
export type ViewType = "day" | "week" | "month" | "year"; // App.tsx から参照できるように export

interface DataPoint {
  label: string;
  shortLabel?: string; // オプショナルな短いラベル（簡略表示用）
  value: number;
  date: Date;
}

// 曜日の配列を定義（週表示で使用）
const WEEKDAYS = ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"];
const SHORT_WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

const styles = {
  container: css`
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
    padding: 24px;
    background-color: white;
    border-radius: 8px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  `,
  header: css`
    margin-bottom: 20px;
    font-size: 20px;
    font-weight: bold;
    color: #333;
  `,
  noData: css`
    text-align: center;
    color: #555;
    padding: 32px 16px;
    background-color: #f0f3f5;
    border-radius: 6px;
    margin: 0;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 16px;
  `,
  loading: css`
    text-align: center;
    color: #555;
    padding: 32px 16px;
    background-color: #f0f3f5;
    border-radius: 6px;
    margin: 0;
    height: 100%;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 16px;
  `,
  tabs: css`
    display: flex;
    margin-bottom: 24px;
    border-bottom: 1px solid #dee2e6;
  `,
  tab: css`
    padding: 10px 16px;
    cursor: pointer;
    margin-right: 8px;
    border: 1px solid transparent;
    border-bottom: none;
    border-radius: 6px 6px 0 0;
    color: #495057;
    transition: color 0.2s ease-in-out, background-color 0.2s ease-in-out;

    &:hover {
      background-color: #f8f9fa;
      color: #007bff;
    }
  `,
  activeTab: css`
    color: #007bff;
    font-weight: bold;
    border-color: #dee2e6 #dee2e6 transparent;
    border-top-width: 2px;
    border-top-color: #3498db;
    background-color: white;
    position: relative;
    bottom: -1px;
  `,
  chartContainer: css`
    width: 100%;
    height: 400px; // 高さを固定
    position: relative;
  `,
  navigationContainer: css`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
  `,
  navButton: css`
    padding: 8px 16px;
    background-color: #e9ecef;
    color: #495057;
    border: 1px solid #dee2e6;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    &:hover {
      background-color: #ced4da;
    }
  `,
  currentDateDisplay: css`
    font-size: 16px;
    font-weight: bold;
    color: #333;
  `,
};

const ElectricityUsageChart = ({ data, isLoading, viewType, currentDate, onViewTypeChange, onNavigateDate, hasNextData, hasPrevData, isLoadingNext, isLoadingPrev }: ElectricityUsageChartProps) => {
  // const [viewType, setViewType] = useState<ViewType>("day"); // App.tsx に移動
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [totalUsage, setTotalUsage] = useState<number>(0); // 合計値を保持するstate

  // 日毎にデータをグループ化する関数
  const groupByDay = (readings: HalfHourlyReading[]) => {
    const grouped: Record<string, number> = {};

    readings.forEach((reading) => {
      // UTCからJSTに変換
      const jstDate = toJST(new Date(reading.startAt));
      // 日本時間の年月日を文字列として保持（UTCに戻さない）
      const dateKey = format(jstDate, "M月d日", { locale: ja });

      // 数値に変換して確実に加算
      const value = Number(reading.value) || 0;

      if (!grouped[dateKey]) {
        grouped[dateKey] = 0;
      }

      grouped[dateKey] += value;
    });

    return grouped;
  };

  // 月毎にデータをグループ化する関数
  const groupByMonth = (readings: HalfHourlyReading[]) => {
    const grouped: Record<string, number> = {};

    readings.forEach((reading) => {
      // UTCからJSTに変換
      const jstDate = toJST(new Date(reading.startAt));
      const monthKey = `${jstDate.getFullYear()}年${jstDate.getMonth() + 1}月`;

      // 数値に変換して確実に加算
      const value = Number(reading.value) || 0;

      if (!grouped[monthKey]) {
        grouped[monthKey] = 0;
      }

      grouped[monthKey] += value;
    });

    return grouped;
  };

  // 年データを月毎にまとめて計算する関数（新しく追加）
  const calculateYearlyData = (readings: HalfHourlyReading[]) => {
    const monthlyData = groupByMonth(readings);

    // 現在の年を取得（ほとんどのケースでreadings内のデータから判断可能）
    let currentYear = new Date().getFullYear();
    if (readings.length > 0) {
      const firstDate = toJST(new Date(readings[0].startAt));
      currentYear = firstDate.getFullYear();
    }

    // 1月から12月までの全ての月を確実に表示するためのオブジェクト
    const allMonths: Record<string, number> = {};
    for (let i = 1; i <= 12; i++) {
      const monthKey = `${currentYear}年${i}月`;
      allMonths[monthKey] = monthlyData[monthKey] || 0;
    }

    return allMonths;
  };

  // データの整形処理
  const formatData = () => {
    if (!data || data.length === 0) return [];

    switch (viewType) {
      case "day":
        // 30分毎のデータ
        return data.map((item) => {
          // UTCからJSTに変換して表示
          const jstDate = toJST(new Date(item.startAt));
          // 30分後の終了時間を計算
          const endDate = addMinutes(jstDate, 30);
          // 数値に変換して確実に計算
          const value = Number(item.value) || 0;

          // 時間だけを取得（HH:mm形式）- 簡略表示用
          const hour = jstDate.getHours();
          const minute = jstDate.getMinutes();
          const timeKey = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;

          // 開始時間と終了時間を表示（線概念）
          return {
            label: `${format(jstDate, "HH:mm")}-${format(endDate, "HH:mm")}`,
            shortLabel: timeKey, // 簡略表示用のラベル
            value: value,
            date: jstDate,
          };
        });

      case "week":
        // 曜日ごとのデータを集計するオブジェクトを初期化
        const weekdayTotals: Record<string, { value: number; date: Date | null }> = {};

        // 曜日ごとに集計を0で初期化
        WEEKDAYS.forEach((day) => {
          weekdayTotals[day] = { value: 0, date: null };
        });

        // 日毎にデータをグループ化
        const weekData = groupByDay(data);

        // データを曜日ごとに集計
        Object.entries(weekData).forEach(([dateStr, value]) => {
          // 日付文字列から日付オブジェクトを作成
          const currentYear = new Date().getFullYear();
          const dateWithYear = `${currentYear}年${dateStr}`;
          const date = parse(dateWithYear, "yyyy年M月d日", new Date());

          // 曜日を取得
          const dayOfWeek = date.getDay();
          const weekdayLabel = WEEKDAYS[dayOfWeek];

          // 該当する曜日の値を加算
          weekdayTotals[weekdayLabel].value += Number(value) || 0;

          // 日付情報を保存（ソート用）
          if (!weekdayTotals[weekdayLabel].date) {
            weekdayTotals[weekdayLabel].date = date;
          }
        });

        // 曜日ごとのデータをDataPoint配列に変換（日曜日から土曜日の順）
        return WEEKDAYS.map((day, index) => {
          return {
            label: day,
            shortLabel: SHORT_WEEKDAYS[index], // 短い曜日ラベルを追加
            value: weekdayTotals[day].value,
            date: weekdayTotals[day].date || new Date(), // 日付がなければ現在の日付を使用
          };
        });

      case "month":
        // 月表示も日毎にグループ化
        const monthData = groupByDay(data);
        // キーと値のペアを配列に変換し、日付でソート
        return Object.entries(monthData)
          .map(([dateStr, value]) => {
            // 現在の年を付与して正確に日付をパース
            const currentYear = new Date().getFullYear();
            const dateWithYear = `${currentYear}年${dateStr}`;
            const date = parse(dateWithYear, "yyyy年M月d日", new Date());

            // 日付部分のみを抽出（「N日」形式を保持）
            const day = date.getDate();
            const dayLabel = `${day}日`; // 「N日」形式を保持

            // 数値型を明示的に使用
            return {
              label: dayLabel,
              value: Number(value) || 0,
              date,
            };
          })
          .sort((a, b) => a.date.getTime() - b.date.getTime());

      case "year":
        // 月毎にデータを計算して一年分を表示
        const yearData = calculateYearlyData(data);
        // キーと値のペアを配列に変換し、年月でソート
        return Object.entries(yearData)
          .map(([monthStr, value]) => {
            // YYYY年M月 形式から日付オブジェクトを作成
            const date = parse(monthStr, "yyyy年M月", new Date());

            // 数値型を明示的に使用
            return {
              label: monthStr,
              value: Number(value) || 0,
              date,
            };
          })
          .sort((a, b) => a.date.getTime() - b.date.getTime());

      default:
        return [];
    }
  };

  const getCurrentDateDisplay = () => {
    switch (viewType) {
      case "day":
        // 「日」表示の場合は、前日の日付を表示する（データは昨日の0時〜今日の0時なので）
        const prevDay = subDays(currentDate, 1);
        return format(prevDay, "yyyy年M月d日", { locale: ja });
      case "week": {
        const start = startOfWeek(currentDate, { weekStartsOn: 0 });
        const end = endOfWeek(currentDate, { weekStartsOn: 0 });
        return `${format(start, "yyyy年M月d日")} - ${format(end, "yyyy年M月d日")}`;
      }
      case "month": {
        // 月の初日
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        // 月の末日
        const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        return `${format(startOfMonth, "yyyy年M月d日")} - ${format(endOfMonth, "yyyy年M月d日")}`;
      }
      case "year":
        return `${format(new Date(currentDate.getFullYear(), 0, 1), "yyyy年M月d日")} - ${format(new Date(currentDate.getFullYear(), 11, 31), "yyyy年M月d日")}`;
      default:
        return "";
    }
  };

  // グラフを描画
  useEffect(() => {
    if (!data || data.length === 0 || !svgRef.current) return;

    const formattedData = formatData();

    // 表示期間の合計値を計算してstateを更新
    const newTotalValue = formattedData.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
    setTotalUsage(newTotalValue);

    // SVGをクリア
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current);

    // SVG要素のサイズを取得
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    // マージンの設定
    const margin = { top: 20, right: 30, bottom: 60, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // グラフ用のグループ要素を作成
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // X軸のスケール作成 - データに基づいて作成
    let xLabels: string[];

    if (viewType === "day") {
      // 日表示の場合は0:00から23:30までの全ての30分間隔を表示
      xLabels = Array.from({ length: 48 }, (_, i) => {
        const hour = Math.floor(i / 2);
        const minute = (i % 2) * 30;
        const startTime = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;

        // 30分後の終了時間を計算
        let endHour = minute === 30 ? hour + 1 : hour;
        const endMinute = minute === 30 ? 0 : 30;

        // 24時は00時に修正
        if (endHour === 24) {
          endHour = 0;
        }

        const endTime = `${endHour.toString().padStart(2, "0")}:${endMinute.toString().padStart(2, "0")}`;
        return `${startTime}-${endTime}`;
      });
    } else if (viewType === "month") {
      // 月表示の場合は特別処理：月初から月末まで全ての日を表示
      const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
      xLabels = Array.from({ length: daysInMonth }, (_, i) => {
        const day = i + 1;
        return `${day}日`;
      });
    } else {
      // その他の表示の場合はデータから取得
      xLabels = formattedData.map((d) => d.label);
    }

    const x = d3.scaleBand().domain(xLabels).range([0, innerWidth]).padding(0.2);

    // Y軸のスケール作成 - 値が正しく数値型であることを確認
    const maxValue = d3.max(formattedData, (d) => Number(d.value) || 0) || 0;
    const y = d3
      .scaleLinear()
      .domain([0, maxValue * 1.1])
      .nice()
      .range([innerHeight, 0]);

    // X軸を描画 - ティックのみカスタマイズ
    const xAxis = d3.axisBottom(x);

    // 表示するラベルのカスタマイズ
    if (viewType === "day") {
      // 日表示の場合は2時間おきにフィルタリング
      xAxis.tickFormat((d: string) => {
        // "HH:mm-HH:mm" 形式から時間のみを取得
        const startTime = d.split("-")[0];
        const hour = parseInt(startTime.split(":")[0]);
        const minute = parseInt(startTime.split(":")[1]);

        // 偶数時かつ分が0の場合のみ表示
        if (hour % 2 === 0 && minute === 0) {
          return `${hour.toString().padStart(2, "0")}:00`;
        }
        return ""; // その他は空文字を表示
      });
    } else if (viewType === "week") {
      // 週表示の場合は短い曜日名に変換
      xAxis.tickFormat((d: string) => {
        const index = WEEKDAYS.indexOf(d);
        if (index !== -1) {
          return SHORT_WEEKDAYS[index];
        }
        return d;
      });
    } else if (viewType === "month") {
      // 月表示の場合は「日」を削除し、偶数日はスキップ
      xAxis.tickFormat((d: string) => {
        // "N日" 形式から日付だけを取得
        const dayMatch = d.match(/(\d+)日/);
        if (dayMatch && dayMatch[1]) {
          const day = parseInt(dayMatch[1]);
          // 奇数日か29日か31日の場合のみ表示
          if (day % 2 === 1 || day === 29 || day === 31) {
            return day.toString();
          }
          return ""; // その他は空文字
        }
        return d;
      });
    } else if (viewType === "year") {
      // 年表示の場合は「年」を削除し、月のみ表示する
      xAxis.tickFormat((d: string) => {
        // "YYYY年M月" 形式から月だけを取得
        const monthMatch = d.match(/\d+年(\d+)月/);
        if (monthMatch && monthMatch[1]) {
          const month = parseInt(monthMatch[1]);
          return `${month}月`;
        }
        return d;
      });
    }

    // X軸を描画
    const xAxisGroup = g.append("g").attr("transform", `translate(0,${innerHeight})`).call(xAxis);

    xAxisGroup.selectAll("path").style("stroke", "#ccd1d9");
    xAxisGroup.selectAll("line").style("stroke", "#ccd1d9");
    xAxisGroup.selectAll("text").style("fill", "#555").style("font-size", "11px");

    // Y軸の描画
    const yAxisGroup = g.append("g").call(
      d3.axisLeft(y).tickFormat((d) => {
        // viewTypeに応じたフォーマットを適用
        let formattedValue;
        switch (viewType) {
          case "day":
            // 日表示では小数点以下2桁
            formattedValue = d3.format(".2f")(d);
            break;
          case "week":
            // 週表示では小数点以下1桁
            formattedValue = d3.format(".1f")(d);
            break;
          case "month":
            // 月表示では整数
            formattedValue = d3.format(".1f")(d);
            break;
          case "year":
            // 年表示では大きな数値になるため整数
            formattedValue = d3.format(",.0f")(d);
            break;
          default:
            formattedValue = d;
        }
        return `${formattedValue} kWh`;
      })
    );

    yAxisGroup.selectAll("path").style("stroke", "#ccd1d9");
    yAxisGroup.selectAll("line").style("stroke", "#ccd1d9");
    yAxisGroup.selectAll("text").style("fill", "#555").style("font-size", "11px");

    // Y軸のグリッド線を追加
    g.append("g")
      .attr("class", "grid")
      .call(
        d3
          .axisLeft(y)
          .tickSize(-innerWidth)
          .tickFormat(() => "")
      )
      .selectAll("line")
      .style("stroke", "#e9ecef")
      .style("stroke-dasharray", "2,2");
    g.selectAll("path.domain").remove();

    // タイトルの描画
    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", margin.top)
      .attr("text-anchor", "middle")
      .style("font-size", "18px")
      .style("font-weight", "bold")
      .style("fill", "#333");

    // ツールチップグループを最後に作成（最前面に表示されるようにするため）
    const tooltip = svg.append("g").attr("class", "tooltip").style("display", "none").attr("pointer-events", "none");

    // ツールチップ背景
    tooltip
      .append("rect")
      .attr("width", 180)
      .attr("height", 65)
      .attr("fill", "#ffffff")
      .attr("stroke", "#dee2e6")
      .attr("stroke-width", 1)
      .attr("rx", 6)
      .attr("ry", 6)
      .attr("y", -70)
      .attr("x", -90)
      .style("box-shadow", "0 1px 3px rgba(0,0,0,0.1)");

    // ラベルテキスト
    const tooltipLabel = tooltip.append("text").attr("x", -80).attr("y", -48).style("font-size", "13px").style("font-weight", "bold").style("fill", "#333");

    // 値テキスト
    const tooltipValue = tooltip.append("text").attr("x", -80).attr("y", -28).style("font-size", "13px").style("fill", "#555");

    // ツールチップの表示関数
    const showTooltip = (event: any, d: DataPoint) => {
      // 値を確実に数値型にして表示
      const value = Number(d.value);
      const formattedValue = isNaN(value) ? "N/A" : value.toFixed(2);

      // ツールチップのテキストを設定
      tooltipLabel.text(`${formattedValue} kWh`);

      let tooltipInfo = "";
      if (viewType === "day") {
        tooltipInfo = d.label; // 例: 0:00-0:30
      } else if (viewType === "week" || viewType === "month") {
        // 日付を表示（例: 5月4日）
        const date = d.date;
        tooltipInfo = format(date, "M月d日", { locale: ja });
      } else if (viewType === "year") {
        // 月を表示（例: 5月）
        const date = d.date;
        tooltipInfo = format(date, "M月", { locale: ja });
      }

      tooltipValue.text(tooltipInfo);

      // ツールチップの位置を設定 - SVG座標系で直接指定
      const xPos = margin.left + (x(d.label) || 0) + x.bandwidth() / 2;
      const yPos = margin.top + y(value); // 棒の上端に配置

      // ツールチップを表示して位置を設定
      tooltip
        .raise() // 必ず最前面に表示
        .attr("transform", `translate(${xPos}, ${yPos})`)
        .style("display", "block");

      // バーの色を変更してハイライト
      d3.select(event.target).transition().duration(100).attr("fill", "#2980b9");
    };

    // ツールチップを隠す関数
    const hideTooltip = (event: any) => {
      tooltip.style("display", "none");
      d3.select(event.target).transition().duration(100).attr("fill", "#3498db");
    };

    // 棒グラフの描画
    if (viewType === "day" || viewType === "month") {
      // 日表示・月表示の場合、全ての時間枠/日付枠を描画し、データがある場所だけ棒を表示
      // キーを保持するマップを作成
      const dataMap = new Map();

      formattedData.forEach((d) => {
        dataMap.set(d.label, d);
      });

      g.selectAll<SVGRectElement, string>(".bar")
        .data(xLabels)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", (label) => x(label) as number)
        .attr("width", x.bandwidth())
        .attr("y", (label) => {
          const dataPoint = dataMap.get(label);
          if (!dataPoint) return innerHeight; // データがない場合は高さ0
          const value = Number(dataPoint.value) || 0;
          return y(value);
        })
        .attr("height", (label) => {
          const dataPoint = dataMap.get(label);
          if (!dataPoint) return 0; // データがない場合は高さ0
          const value = Number(dataPoint.value) || 0;
          return innerHeight - y(value);
        })
        .attr("fill", "#3498db")
        .attr("rx", 3)
        .attr("ry", 3)
        .style("cursor", "pointer")
        .on("mouseover", (event, label) => {
          const dataPoint = dataMap.get(label);
          if (dataPoint) showTooltip(event, dataPoint);
        })
        .on("mouseout", hideTooltip);
    } else {
      // その他の表示の場合（週表示・年表示）
      g.selectAll<SVGRectElement, DataPoint>(".bar")
        .data(formattedData)
        .enter()
        .append("rect")
        .attr("class", "bar")
        .attr("x", (d) => x(d.label) as number)
        .attr("width", x.bandwidth())
        .attr("y", (d) => {
          const value = Number(d.value) || 0;
          return y(value);
        })
        .attr("height", (d) => {
          const value = Number(d.value) || 0;
          return innerHeight - y(value);
        })
        .attr("fill", "#3498db")
        .attr("rx", 3)
        .attr("ry", 3)
        .style("cursor", "pointer")
        .on("mouseover", showTooltip)
        .on("mouseout", hideTooltip);
    }
  }, [data, viewType]);

  if (isLoading) {
    return (
      <div css={styles.container}>
        <div css={styles.header}>電気使用量グラフ</div>

        <div css={styles.tabs}>
          <div css={[styles.tab, viewType === "day" && styles.activeTab]} onClick={() => onViewTypeChange("day")}>
            日
          </div>
          <div css={[styles.tab, viewType === "week" && styles.activeTab]} onClick={() => onViewTypeChange("week")}>
            週
          </div>
          <div css={[styles.tab, viewType === "month" && styles.activeTab]} onClick={() => onViewTypeChange("month")}>
            月
          </div>
          <div css={[styles.tab, viewType === "year" && styles.activeTab]} onClick={() => onViewTypeChange("year")}>
            年
          </div>
        </div>

        <div css={styles.navigationContainer}>
          <button css={styles.navButton} onClick={() => onNavigateDate("prev")} disabled={isLoadingPrev || !hasPrevData}>
            前へ
          </button>
          <div css={styles.currentDateDisplay}>{getCurrentDateDisplay()}</div>
          <button css={styles.navButton} onClick={() => onNavigateDate("next")} disabled={isLoadingNext || !hasNextData}>
            次へ
          </button>
        </div>

        <div css={styles.chartContainer}>
          <div css={styles.loading}>データを読み込んでいます...</div>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div css={styles.container}>
        <div css={styles.header}>電気使用量グラフ</div>

        <div css={styles.tabs}>
          <div css={[styles.tab, viewType === "day" && styles.activeTab]} onClick={() => onViewTypeChange("day")}>
            日
          </div>
          <div css={[styles.tab, viewType === "week" && styles.activeTab]} onClick={() => onViewTypeChange("week")}>
            週
          </div>
          <div css={[styles.tab, viewType === "month" && styles.activeTab]} onClick={() => onViewTypeChange("month")}>
            月
          </div>
          <div css={[styles.tab, viewType === "year" && styles.activeTab]} onClick={() => onViewTypeChange("year")}>
            年
          </div>
        </div>

        <div css={styles.navigationContainer}>
          <button css={styles.navButton} onClick={() => onNavigateDate("prev")} disabled={isLoadingPrev || !hasPrevData}>
            前へ
          </button>
          <div css={styles.currentDateDisplay}>{getCurrentDateDisplay()}</div>
          <button css={styles.navButton} onClick={() => onNavigateDate("next")} disabled={isLoadingNext || !hasNextData}>
            次へ
          </button>
        </div>

        <div
          css={css`
            text-align: center;
            margin-bottom: 10px;
            font-size: 14px;
            color: #333;
          `}
        >
          合計: {totalUsage.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWh
        </div>

        <div css={styles.chartContainer}>
          <div css={styles.noData}>データがありません</div>
        </div>
      </div>
    );
  }

  return (
    <div css={styles.container}>
      <div css={styles.header}>電気使用量グラフ</div>

      <div css={styles.tabs}>
        <div css={[styles.tab, viewType === "day" && styles.activeTab]} onClick={() => onViewTypeChange("day")}>
          日
        </div>
        <div css={[styles.tab, viewType === "week" && styles.activeTab]} onClick={() => onViewTypeChange("week")}>
          週
        </div>
        <div css={[styles.tab, viewType === "month" && styles.activeTab]} onClick={() => onViewTypeChange("month")}>
          月
        </div>
        <div css={[styles.tab, viewType === "year" && styles.activeTab]} onClick={() => onViewTypeChange("year")}>
          年
        </div>
      </div>

      <div css={styles.navigationContainer}>
        <button css={styles.navButton} onClick={() => onNavigateDate("prev")} disabled={isLoadingPrev || !hasPrevData}>
          前へ
        </button>
        <div css={styles.currentDateDisplay}>{getCurrentDateDisplay()}</div>
        <button css={styles.navButton} onClick={() => onNavigateDate("next")} disabled={isLoadingNext || !hasNextData}>
          次へ
        </button>
      </div>

      <div
        css={css`
          text-align: center;
          margin-bottom: 10px;
          font-size: 14px;
          color: #333;
        `}
      >
        {totalUsage.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kWh
      </div>

      <div css={styles.chartContainer} ref={containerRef}>
        <svg ref={svgRef} width="100%" height="100%"></svg>
      </div>
    </div>
  );
};

export default ElectricityUsageChart;
