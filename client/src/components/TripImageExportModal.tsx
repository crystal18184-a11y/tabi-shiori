// 旅のしおり - SNS用旅程画像書き出しモーダル
// Canvas APIで1080×1080px or 1080×1920pxの画像を生成してダウンロード
import { useState, useRef, useEffect } from "react";
import type { Trip } from "@/lib/store";
import { CATS, dsub, WJA } from "@/lib/store";

interface Props {
  trip: Trip;
  onClose: () => void;
}

type Format = "square" | "story";

const FORMAT_CONFIG = {
  square: { label: "正方形（投稿用）", w: 1080, h: 1080, desc: "1080×1080" },
  story:  { label: "縦長（ストーリーズ用）", w: 1080, h: 1920, desc: "1080×1920" },
};

// パステルグラデーション テーマ
const THEMES = [
  { label: "ブルー",  from: "#3b82f6", to: "#6366f1" },
  { label: "サンセット", from: "#f97316", to: "#ec4899" },
  { label: "グリーン", from: "#10b981", to: "#3b82f6" },
  { label: "パープル", from: "#8b5cf6", to: "#ec4899" },
  { label: "モノクロ", from: "#1e293b", to: "#475569" },
];

const DAY_COLORS = ["#3b82f6","#f97316","#10b981","#8b5cf6","#ec4899","#ef4444","#06b6d4","#84cc16"];

// WJAを使用（未使用警告回避）
void WJA;

export default function TripImageExportModal({ trip, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [format, setFormat] = useState<Format>("square");
  const [themeIdx, setThemeIdx] = useState(0);
  const [generated, setGenerated] = useState(false);
  const [generating, setGenerating] = useState(false);

  const theme = THEMES[themeIdx];
  const { w, h } = FORMAT_CONFIG[format];

  // 日付範囲を文字列で返す
  function getDateRange() {
    const dates = trip.days.map(d => d.date).filter(Boolean).sort();
    if (!dates.length) return "";
    if (dates.length === 1) return dsub(dates[0]);
    return `${dsub(dates[0])} 〜 ${dsub(dates[dates.length - 1])}`;
  }

  // テキスト折り返し helper
  function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
    if (ctx.measureText(text).width <= maxWidth) {
      ctx.fillText(text, x, y);
      return;
    }
    let line = "";
    let currentY = y;
    for (const char of text) {
      if (ctx.measureText(line + char).width > maxWidth) {
        ctx.fillText(line, x, currentY);
        line = char;
        currentY += lineHeight;
      } else {
        line += char;
      }
    }
    if (line) ctx.fillText(line, x, currentY);
  }

  function drawCanvas() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = w;
    canvas.height = h;

    // ── 背景グラデーション ──
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, theme.from);
    grad.addColorStop(1, theme.to);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // ── 半透明オーバーレイ（読みやすさ向上）──
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(0, 0, w, h);

    // ── ブランド名 ──
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = `${Math.round(w * 0.032)}px sans-serif`;
    ctx.textAlign = "center";
    ctx.fillText("✈️ 旅のしおり", w / 2, h * 0.07);

    // ── 旅行名 ──
    ctx.fillStyle = "#ffffff";
    ctx.font = `bold ${Math.round(w * 0.068)}px sans-serif`;
    ctx.textAlign = "center";
    const tripName = trip.name || "旅行プラン";
    wrapText(ctx, tripName, w / 2, h * 0.13, w * 0.85, Math.round(w * 0.075));

    // ── 日程 ──
    const dateRange = getDateRange();
    if (dateRange) {
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.font = `${Math.round(w * 0.036)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillText(dateRange, w / 2, h * 0.19);
    }

    // ── 仕切り線 ──
    ctx.strokeStyle = "rgba(255,255,255,0.3)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w * 0.08, h * 0.22);
    ctx.lineTo(w * 0.92, h * 0.22);
    ctx.stroke();

    // ── Day ごとの予定 ──
    const padding = w * 0.08;
    let y = h * 0.25;
    const lineH = h * 0.048;
    const dayLabelSize = Math.round(w * 0.036);
    const evtSize = Math.round(w * 0.03);
    const maxY = h * (format === "square" ? 0.87 : 0.91);

    for (let di = 0; di < trip.days.length; di++) {
      const day = trip.days[di];
      if (!day.events.length && !day.date) continue;
      if (y > maxY) break;

      const color = DAY_COLORS[di % DAY_COLORS.length];

      // Day ヘッダー
      ctx.fillStyle = color;
      ctx.font = `bold ${dayLabelSize}px sans-serif`;
      ctx.textAlign = "left";
      const dayLabel = `Day ${di + 1}${day.date ? "  " + dsub(day.date) : ""}`;
      ctx.fillText(dayLabel, padding, y);
      y += lineH * 0.9;

      // 予定リスト（最大5件/day、スペースが足りなければ省略）
      const evts = day.events.slice(0, 5);
      for (const evt of evts) {
        if (y > maxY) {
          ctx.fillStyle = "rgba(255,255,255,0.5)";
          ctx.font = `${evtSize}px sans-serif`;
          ctx.fillText("...", padding + 16, y);
          break;
        }
        const cat = CATS[evt.category] || CATS["その他"];
        ctx.fillStyle = "rgba(255,255,255,0.9)";
        ctx.font = `${evtSize}px sans-serif`;
        ctx.textAlign = "left";
        const line = `${cat.i} ${evt.time ? evt.time + "  " : ""}${evt.title}`;
        const maxW = w * 0.84;
        let displayLine = line;
        ctx.font = `${evtSize}px sans-serif`;
        while (ctx.measureText(displayLine).width > maxW && displayLine.length > 8) {
          displayLine = displayLine.slice(0, -2) + "…";
        }
        ctx.fillText(displayLine, padding + 16, y);
        y += lineH * 0.82;
      }

      if (day.events.length > 5) {
        ctx.fillStyle = "rgba(255,255,255,0.5)";
        ctx.font = `${evtSize}px sans-serif`;
        ctx.fillText(`  ... 他${day.events.length - 5}件`, padding + 16, y);
        y += lineH * 0.7;
      }

      y += lineH * 0.3;
    }

    // ── ハッシュタグ ──
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = `${Math.round(w * 0.026)}px sans-serif`;
    ctx.textAlign = "center";
    const dest = trip.destination ? `#${trip.destination}旅行 ` : "";
    ctx.fillText(`${dest}#旅のしおり #旅行計画`, w / 2, h * 0.96);
  }

  useEffect(() => {
    setGenerated(false);
  }, [format, themeIdx]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      await new Promise(r => setTimeout(r, 50));
      drawCanvas();
      setGenerated(true);
    } catch (e) {
      console.error("画像生成エラー:", e);
    } finally {
      setGenerating(false);
    }
  }

  function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${trip.name || "旅程"}_${format}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[300] p-3"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl w-full max-w-sm max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
        {/* ヘッダー */}
        <div className="flex justify-between items-center px-4 py-3 border-b border-slate-100 flex-shrink-0">
          <h2 className="font-bold text-sm text-slate-900">📸 SNS用画像を作成</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg font-bold bg-transparent border-none cursor-pointer">×</button>
        </div>

        <div className="p-4 flex flex-col gap-4">
          {/* フォーマット選択 */}
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">サイズ</p>
            <div className="flex gap-2">
              {(Object.entries(FORMAT_CONFIG) as [Format, typeof FORMAT_CONFIG[Format]][]).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => setFormat(key)}
                  className={`flex-1 py-2 px-3 rounded-lg border text-xs font-semibold transition-colors cursor-pointer ${format === key ? "bg-blue-500 text-white border-blue-500" : "bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300"}`}
                >
                  <div>{cfg.label}</div>
                  <div className="text-[10px] opacity-70 mt-0.5">{cfg.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* テーマカラー */}
          <div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">カラーテーマ</p>
            <div className="flex gap-2 flex-wrap">
              {THEMES.map((t, i) => (
                <button
                  key={i}
                  onClick={() => setThemeIdx(i)}
                  title={t.label}
                  style={{ background: `linear-gradient(135deg, ${t.from}, ${t.to})` }}
                  className={`w-8 h-8 rounded-full cursor-pointer transition-all hover:scale-110 ${themeIdx === i ? "ring-2 ring-offset-2 ring-slate-400" : ""}`}
                />
              ))}
            </div>
          </div>

          {/* canvas（常にDOMに存在させてrefを安定させる） */}
          <div>
            {generated && (
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">プレビュー</p>
            )}
            <canvas
              ref={canvasRef}
              className={`w-full rounded-xl border border-slate-200 shadow-sm ${generated ? "block" : "hidden"}`}
              style={{ aspectRatio: format === "square" ? "1/1" : "9/16" }}
            />
          </div>

          {/* ボタン */}
          <div className="flex gap-2">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex-1 bg-gradient-to-r from-pink-500 to-rose-500 text-white border-none rounded-xl py-3 text-sm font-bold cursor-pointer hover:from-pink-600 hover:to-rose-600 transition-all disabled:opacity-50"
            >
              {generating ? "⏳ 生成中..." : "✨ 画像を生成"}
            </button>
            {generated && (
              <button
                onClick={handleDownload}
                className="flex-1 bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-none rounded-xl py-3 text-sm font-bold cursor-pointer hover:from-blue-600 hover:to-indigo-600 transition-all"
              >
                💾 保存する
              </button>
            )}
          </div>

          <p className="text-[10px] text-slate-400 text-center leading-relaxed">
            生成した画像をインスタ・TikTok・Xに投稿できます。<br />
            画像にはアプリ名が入り、自然に宣伝になります✨
          </p>
        </div>
      </div>
    </div>
  );
}
