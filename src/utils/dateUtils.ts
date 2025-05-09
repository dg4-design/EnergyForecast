import { format, parseISO } from "date-fns";
import { toZonedTime } from "date-fns-tz";

const TIME_ZONE = "Asia/Tokyo";

/**
 * UTC時間を日本時間(JST)に変換
 */
export const toJST = (date: Date | string): Date => {
  const parsedDate = typeof date === "string" ? parseISO(date) : date;
  return toZonedTime(parsedDate, TIME_ZONE);
};

/**
 * 日本時間(JST)をUTCに変換
 */
export const toUTC = (date: Date): Date => {
  // JSTの日付をUTCに変換（日本は+9時間なので9時間引く）
  return new Date(date.getTime() - 9 * 60 * 60 * 1000);
};

/**
 * 現在の日本時間を取得
 */
export const getNowJST = (): Date => {
  return toJST(new Date());
};

/**
 * 日本時間を指定フォーマットで文字列化
 */
export const formatJST = (date: Date | string, formatStr: string): string => {
  const jstDate = toJST(typeof date === "string" ? parseISO(date) : date);
  return format(jstDate, formatStr);
};

/**
 * ISO文字列を日本時間に変換してフォーマット
 */
export const formatISOtoJST = (isoString: string, formatStr: string): string => {
  return formatJST(isoString, formatStr);
};

/**
 * 日本時間をHTML datetime-local用の文字列に変換
 */
export const formatToDateTimeLocal = (date: Date): string => {
  const jstDate = toJST(date);
  return format(jstDate, "yyyy-MM-dd'T'HH:mm");
};
