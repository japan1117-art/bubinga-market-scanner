import { BubingaDataError } from "./bubinga-assets.ts";

export interface ScanFailure {
  title: string;
  message: string;
  retryable: boolean;
}

export function toScanFailure(error: unknown): ScanFailure {
  if (error instanceof BubingaDataError) {
    if (error.code === "HTTP") {
      return { title: "データを取得できませんでした", message: "Bubinga側からエラーが返されました。時間をおいて再試行してください。", retryable: true };
    }
    if (error.code === "INVALID_RESPONSE") {
      return { title: "データ形式を確認できません", message: "取得データの形式が想定と異なります。安全のため分析を中止しました。", retryable: false };
    }
    return { title: "通信がタイムアウトしました", message: "接続状態を確認して、もう一度分析してください。", retryable: true };
  }
  if (error instanceof DOMException && error.name === "AbortError") {
    return { title: "分析を中止しました", message: "もう一度、分析ボタンを押してください。", retryable: true };
  }
  return { title: "分析を完了できませんでした", message: "一時的な問題が発生しました。再試行しても直らない場合は時間をおいてください。", retryable: true };
}
