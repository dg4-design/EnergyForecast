import { css } from "@emotion/react";
import { useEffect, useRef, useState, useLayoutEffect } from "react"; // useLayoutEffectを追加
import * as d3 from "d3";
import { HalfHourlyReading } from "../services/api";
import { toJST } from "../utils/dateUtils";
import { format, parse, addMinutes, startOfWeek, endOfWeek, subDays } from "date-fns"; // 必要な関数を追加
import { ja } from "date-fns/locale";
import * as commonStyles from "../styles/commonStyles";

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
  container: commonStyles.cardContainer,
  header: commonStyles.sectionTitle,
  headerIcon: commonStyles.titleIcon,
  noData: commonStyles.noDataMessage,
  loading: commonStyles.loadingMessage,
  tabAndNavContainer: css`
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--space-3);
  `,
  tabs: css`
    display: flex;
    border-bottom: 1px solid var(--border);
  `,
  tab: css`
    padding: var(--space-2) var(--space-4);
    cursor: pointer;
    margin-right: var(--space-2);
    border: 1px solid transparent;
    border-bottom: none;
    border-radius: var(--radius) var(--radius) 0 0;
    color: var(--text-secondary);
    transition: all var(--transition-fast);
    font-size: var(--text-sm);

    &:hover {
      background-color: var(--gray-50);
      color: var(--accent);
    }
  `,
  activeTab: css`
    color: var(--accent);
    font-weight: 600;
    border-color: var(--border) var(--border) transparent;
    border-top-width: 2px;
    border-top-color: var(--accent);
    background-color: var(--background-card);
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
    margin-bottom: var(--space-4);
  `,
  navButtonsWrapper: css`
    gap: var(--space-3);
  `,
  navButton: css`
    padding: var(--space-2) var(--space-4);
    background-color: var(--background);
    color: var(--text-primary);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    cursor: pointer;
    font-size: var(--text-sm);
    transition: all var(--transition-fast);
    height: 2.5rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;

    &:hover:not(:disabled) {
      background-color: var(--gray-100);
      border-color: var(--gray-300);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `,
  currentDateDisplay: css`
    font-size: var(--text-base);
    font-weight: 500;
    color: var(--text-primary);
  `,
  totalUsage: css`
    margin-bottom: var(--space-3);
    display: inline-block;
    font-weight: 700;
  `,
  totalUsageNumber: css`
    font-size: var(--text-2xl);
  `,
  totalUsageWrapper: css`
    margin-bottom: var(--space-4);
  `,
};

const ElectricityUsageChart = ({ data, isLoading, viewType, currentDate, onViewTypeChange, onNavigateDate, hasNextData, hasPrevData, isLoadingNext, isLoadingPrev }: ElectricityUsageChartProps) => {
  // const [viewType, setViewType] = useState<ViewType>("day"); // App.tsx に移動
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [totalUsage, setTotalUsage] = useState<number>(0); // 合計値を保持するstate
  const [isMounted, setIsMounted] = useState(false); // SVG要素のマウント状態を追跡
  const [windowResized, setWindowResized] = useState(0); // ウィンドウリサイズを追跡するカウンター

  // 初回レンダリング後にマウント状態を更新
  useLayoutEffect(() => {
    if (svgRef.current && containerRef.current) {
      setIsMounted(true);
    }
  }, []);

  // リサイズイベントリスナーの設定
  useEffect(() => {
    const handleResize = () => {
      setWindowResized((prev) => prev + 1);
    };

    window.addEventListener("resize", handleResize);

    // 初回レンダリング時にも遅延実行で描画を試みる
    const timer = setTimeout(() => {
      setWindowResized((prev) => prev + 1);
    }, 200);

    return () => {
      window.removeEventListener("resize", handleResize);
      clearTimeout(timer);
    };
  }, []);

  // 日毎にデータをグループ化する関数
  const groupByDay = (readings: HalfHourlyReading[]) => {
    const grouped: Record<string, number> = {};

    readings.forEach((reading) => {
      // startAtがDateオブジェクトかstring型かをチェック
      const startDate = reading.startAt instanceof Date ? reading.startAt : new Date(reading.startAt);
      // UTCからJSTに変換
      const jstDate = toJST(startDate);
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
      // startAtがDateオブジェクトかstring型かをチェック
      const startDate = reading.startAt instanceof Date ? reading.startAt : new Date(reading.startAt);
      // UTCからJSTに変換
      const jstDate = toJST(startDate);
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
      // startAtがDateオブジェクトかstring型かをチェック
      const startAtValue = readings[0].startAt;
      const firstDate = toJST(startAtValue instanceof Date ? startAtValue : new Date(startAtValue));
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
          // startAtがDateオブジェクトかstring型かをチェック
          const startAtValue = item.startAt;
          const startDate = startAtValue instanceof Date ? startAtValue : new Date(startAtValue);
          // UTCからJSTに変換して表示
          const jstDate = toJST(startDate);
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
    if (!data || data.length === 0 || !svgRef.current || !containerRef.current) {
      return;
    }

    // SVG要素のサイズが0の場合は描画しない
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;
    if (width === 0 || height === 0) {
      // 再試行タイマーをセット
      const timer = setTimeout(() => {
        setWindowResized((prev) => prev + 1);
      }, 100);

      return () => clearTimeout(timer);
    }

    const formattedData = formatData();

    // 表示期間の合計値を計算してstateを更新
    const newTotalValue = formattedData.reduce((sum, item) => sum + (Number(item.value) || 0), 0);
    setTotalUsage(newTotalValue);

    try {
      // SVGをクリア
      d3.select(svgRef.current).selectAll("*").remove();

      const svg = d3.select(svgRef.current);

      // SVG要素のサイズを取得
      const containerWidth = containerRef.current.clientWidth || 700; // デフォルト値を設定
      const chartHeight = 400; // 固定の高さ

      // SVGの viewBox と preserveAspectRatio を設定してレスポンシブに
      svg
        .attr("viewBox", `0 0 ${containerWidth} ${chartHeight}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("width", "100%") // コンテナの幅に合わせる
        .style("height", "auto"); // 高さはアスペクト比に応じて自動調整

      // マージンの設定
      const margin = { top: 20, right: 30, bottom: 60, left: 80 };
      const innerWidth = containerWidth - margin.left - margin.right;
      const innerHeight = chartHeight - margin.top - margin.bottom;

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
        .domain([0, maxValue * 1.1]) // Y軸の最大値を少し余裕を持たせる
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

      xAxisGroup.selectAll("path").style("stroke", "var(--gray-300)");
      xAxisGroup.selectAll("line").style("stroke", "var(--gray-300)");
      xAxisGroup.selectAll("text").style("fill", "var(--text-secondary)").style("font-size", "var(--text-xs)");

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
              // 月表示では小数点以下1桁
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

      yAxisGroup.selectAll("path").style("stroke", "var(--gray-300)");
      yAxisGroup.selectAll("line").style("stroke", "var(--gray-300)");
      yAxisGroup.selectAll("text").style("fill", "var(--text-secondary)").style("font-size", "var(--text-xs)");

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
        .style("stroke", "var(--gray-100)")
        .style("stroke-dasharray", "2,2");
      g.selectAll("path.domain").remove();

      // ツールチップグループを最後に作成（最前面に表示されるようにするため）
      const tooltip = svg.append("g").attr("class", "tooltip").style("display", "none").attr("pointer-events", "none");

      // ツールチップ背景
      tooltip
        .append("rect")
        .attr("width", 180)
        .attr("height", 65)
        .attr("fill", "var(--background-card)")
        .attr("stroke", "var(--border)")
        .attr("stroke-width", 1)
        .attr("rx", 6)
        .attr("ry", 6)
        .attr("y", -70)
        .attr("x", -90)
        .style("box-shadow", "var(--shadow)");

      // ラベルテキスト
      const tooltipLabel = tooltip.append("text").attr("x", -80).attr("y", -48).style("font-size", "var(--text-sm)").style("font-weight", "500").style("fill", "var(--text-primary)");

      // 値テキスト
      const tooltipValue = tooltip.append("text").attr("x", -80).attr("y", -28).style("font-size", "var(--text-sm)").style("fill", "var(--text-secondary)");

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
        d3.select(event.target).transition().duration(100).attr("fill", "var(--accent-dark)");
      };

      // ツールチップを隠す関数
      const hideTooltip = (event: any) => {
        tooltip.style("display", "none");
        d3.select(event.target).transition().duration(100).attr("fill", "var(--accent)");
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
          .attr("fill", "var(--accent)")
          .attr("rx", 4)
          .attr("ry", 4)
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
          .attr("fill", "var(--accent)")
          .attr("rx", 4)
          .attr("ry", 4)
          .style("cursor", "pointer")
          .on("mouseover", showTooltip)
          .on("mouseout", hideTooltip);
      }
    } catch (error) {}
  }, [data, viewType, currentDate, isMounted, windowResized]); // isMountedとwindowResizedを依存配列に追加

  // チャートコンテンツ部分のみ条件に応じて変更
  let chartContent;
  if (isLoading) {
    chartContent = <div css={styles.loading}>データを読み込んでいます...</div>;
  } else if (!data || data.length === 0) {
    chartContent = <div css={styles.noData}>データがありません</div>;
  } else {
    chartContent = <svg ref={svgRef} width="100%" height="100%" style={{ minHeight: "350px" }}></svg>;
  }

  return (
    <div css={styles.container}>
      <div css={styles.header}>電気使用量グラフ</div>

      <div css={styles.tabAndNavContainer}>
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
        <div css={styles.navButtonsWrapper}>
          <button css={styles.navButton} onClick={() => onNavigateDate("prev")} disabled={isLoadingPrev || !hasPrevData}>
            {"<"}
          </button>
          <button css={styles.navButton} onClick={() => onNavigateDate("next")} disabled={isLoadingNext || !hasNextData}>
            {">"}
          </button>
        </div>
      </div>

      <div css={styles.navigationContainer}>
        <div css={styles.currentDateDisplay}>{getCurrentDateDisplay()}</div>
      </div>

      {data && data.length > 0 && (
        <div css={styles.totalUsageWrapper}>
          <span css={styles.totalUsage}>
            <span css={styles.totalUsageNumber}>{totalUsage.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span> kWh
          </span>
        </div>
      )}

      <div css={styles.chartContainer} ref={!isLoading && data && data.length > 0 ? containerRef : undefined}>
        {chartContent}
      </div>
    </div>
  );
};

export default ElectricityUsageChart;
