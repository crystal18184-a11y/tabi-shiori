// TripPeriodModal - 旅行期間設定モーダル
// 開始日・終了日を選択すると Day1, Day2, ... を自動作成する

import { useState } from "react";

interface Props {
  onClose: () => void;
  onConfirm: (startDate: string, endDate: string) => void;
}

export default function TripPeriodModal({ onClose, onConfirm }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [error, setError] = useState<string | null>(null);

  // 日数を計算
  const calcDays = () => {
    if (!startDate || !endDate) return 0;
    const s = new Date(startDate);
    const e = new Date(endDate);
    const diff = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
    return diff > 0 ? diff : 0;
  };

  const days = calcDays();

  function handleConfirm() {
    if (!startDate || !endDate) {
      setError("開始日と終了日を入力してください");
      return;
    }
    if (new Date(endDate) < new Date(startDate)) {
      setError("終了日は開始日以降にしてください");
      return;
    }
    if (days > 60) {
      setError("旅行期間は60日以内にしてください");
      return;
    }
    onConfirm(startDate, endDate);
  }

  const WJA = ["日", "月", "火", "水", "木", "金", "土"];
  const fmt = (s: string) => {
    if (!s) return "";
    const [y, m, d] = s.split("-").map(Number);
    return `${m}月${d}日(${WJA[new Date(y, m - 1, d).getDay()]})`;
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 400, padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 380, boxShadow: "0 20px 60px rgba(0,0,0,.2)", overflow: "hidden" }}
        onClick={e => e.stopPropagation()}>

        {/* ヘッダー */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px 10px", borderBottom: "1px solid #f1f5f9" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>✈️ 旅行期間を設定</div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>日程が自動的に作成されます</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, color: "#94a3b8", cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        {/* フォーム */}
        <div style={{ padding: "18px 18px 14px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: ".06em" }}>出発日</label>
            <input
              type="date"
              value={startDate}
              onChange={e => { setStartDate(e.target.value); setError(null); }}
              style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 9, color: "#1e293b", fontSize: 14, padding: "9px 11px", outline: "none", width: "100%", fontFamily: "inherit" }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: ".06em" }}>帰着日</label>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={e => { setEndDate(e.target.value); setError(null); }}
              style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 9, color: "#1e293b", fontSize: 14, padding: "9px 11px", outline: "none", width: "100%", fontFamily: "inherit" }}
            />
          </div>

          {/* プレビュー */}
          {days > 0 && (
            <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "10px 14px" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#1d4ed8", marginBottom: 6 }}>
                📅 {days}日間の旅行
              </div>
              <div style={{ fontSize: 11, color: "#3b82f6", lineHeight: 1.8 }}>
                {fmt(startDate)} 〜 {fmt(endDate)}<br />
                <span style={{ color: "#64748b" }}>Day 1 〜 Day {days} が自動作成されます</span>
              </div>
            </div>
          )}

          {error && (
            <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#991b1b" }}>
              {error}
            </div>
          )}
        </div>

        {/* ボタン */}
        <div style={{ display: "flex", gap: 8, padding: "0 18px 18px" }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: "10px", background: "#f1f5f9", border: "none", borderRadius: 9, color: "#64748b", fontSize: 13, cursor: "pointer" }}
          >
            キャンセル
          </button>
          <button
            onClick={handleConfirm}
            disabled={days === 0 || days > 60}
            style={{ flex: 2, padding: "10px", background: days > 0 && days <= 60 ? "linear-gradient(135deg,#3b82f6,#6366f1)" : "#e2e8f0", border: "none", borderRadius: 9, color: days > 0 && days <= 60 ? "#fff" : "#94a3b8", fontSize: 13, fontWeight: 700, cursor: days > 0 && days <= 60 ? "pointer" : "not-allowed" }}
          >
            ✅ {days > 0 ? `Day 1〜${days} を作成` : "日程を選択してください"}
          </button>
        </div>
      </div>
    </div>
  );
}
