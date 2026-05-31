// MemoImportModal - AIメモ一括読み取り機能
// テキストメモをAIが解析して予定として一括登録する
// 全日程情報をAIに渡し、各予定を適切なDayに振り分ける

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { CATS, TabiDay, TabiEvent, uid } from "@/lib/store";

interface ParsedEvent {
  dayIndex: number; // -1 = 不明
  time: string;
  category: string;
  title: string;
  location: string;
  memo: string;
  url: string;
}

interface MemoImportModalProps {
  onClose: () => void;
  /** dayIdをキーにして各Dayに予定を登録する */
  onImportMultiDay: (eventsByDayId: Record<string, Omit<TabiEvent, "id">[]>) => void;
  dayDate: string;
  destination: string;
  /** 全日程情報（全Dayに反映するため） */
  tripDays: TabiDay[];
  /** 現在選択中のDayのインデックス（0始まり） */
  currentDayIndex: number;
}

export default function MemoImportModal({
  onClose,
  onImportMultiDay,
  dayDate,
  destination,
  tripDays,
  currentDayIndex,
}: MemoImportModalProps) {
  const [memo, setMemo] = useState("");
  const [parsed, setParsed] = useState<ParsedEvent[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [step, setStep] = useState<"input" | "preview">("input");
  const [error, setError] = useState<string | null>(null);

  const parseMemo = trpc.ai.parseMemo.useMutation();

  // 全日程情報をAIに渡す形式に変換
  const tripDaysInfo = tripDays.map((d, i) => ({ dayIndex: i, date: d.date || `Day${i + 1}` }));

  const handleParse = async () => {
    if (!memo.trim()) return;
    setError(null);
    try {
      const result = await parseMemo.mutateAsync({
        memo: memo.trim(),
        dayDate,
        destination,
        tripDays: tripDaysInfo,
      });
      if (result.ok && result.events.length > 0) {
        setParsed(result.events as ParsedEvent[]);
        setSelected(new Set(result.events.map((_: unknown, i: number) => i)));
        setStep("preview");
      } else if (!result.ok) {
        setError((result as { ok: false; error: string }).error || "解析に失敗しました");
      } else {
        setError("予定が見つかりませんでした。メモをより具体的に書いてみてください。");
      }
    } catch {
      setError("解析中にエラーが発生しました");
    }
  };

  const handleImport = () => {
    // dayIndexごとに予定をグループ化
    const byDayIndex: Record<number, Omit<TabiEvent, "id">[]> = {};

    parsed
      .filter((_, i) => selected.has(i))
      .forEach((e) => {
        const evt: Omit<TabiEvent, "id"> = {
          time: e.time || "",
          category: e.category in CATS ? e.category : "その他",
          title: e.title,
          location: e.location,
          memo: e.memo,
          url: e.url || "",
          photo: "",
          lat: "",
          lng: "",
          reservationNo: "",
          attachments: [],
        };
        // dayIndexが有効な範囲内かチェック
        const idx = (e.dayIndex >= 0 && e.dayIndex < tripDays.length) ? e.dayIndex : currentDayIndex;
        if (!byDayIndex[idx]) byDayIndex[idx] = [];
        byDayIndex[idx].push(evt);
      });

    // dayIndexをdayIdに変換
    const eventsByDayId: Record<string, Omit<TabiEvent, "id">[]> = {};
    Object.entries(byDayIndex).forEach(([idxStr, evts]) => {
      const idx = parseInt(idxStr);
      const day = tripDays[idx];
      if (day) {
        eventsByDayId[day.id] = evts;
      }
    });

    onImportMultiDay(eventsByDayId);
    onClose();
  };

  const toggleSelect = (i: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const catInfo = (cat: string) => CATS[cat] || { i: "📌", c: "#6b7280" };

  // dayIndexからDay名を取得
  const getDayLabel = (dayIndex: number) => {
    if (dayIndex < 0 || dayIndex >= tripDays.length) return "Day?";
    const d = tripDays[dayIndex];
    const dateStr = d.date ? `(${d.date.slice(5).replace("-", "/")})` : "";
    return `Day${dayIndex + 1}${dateStr}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-800">
              📋 メモから予定を一括登録
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              複数日の旅程メモも自動的に各Dayに振り分けます
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-y-auto p-5">
          {step === "input" ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">
                  旅程メモを貼り付けてください
                </label>
                <textarea
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder={`例：\n【1日目】\n9:00 羽田空港 出発 NH123\n11:30 大阪伊丹空港 到着\n13:00 梅田でランチ\n\n【2日目】\n9:00 大阪城 観光\n12:00 道頓堀 昼食\n15:00 USJ 入場`}
                  className="w-full h-48 text-sm border border-gray-200 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono"
                  autoFocus
                />
              </div>
              {/* 日程情報の表示 */}
              {tripDays.length > 1 && (
                <div className="bg-blue-50 rounded-lg px-3 py-2 text-xs text-blue-700">
                  <span className="font-semibold">📅 {tripDays.length}日間の旅行</span>
                  <span className="text-blue-500 ml-1">— 各予定を自動的に正しいDayに振り分けます</span>
                </div>
              )}
              {error && (
                <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
              <p className="text-xs text-gray-400">
                💡 「1日目」「Day1」「3/15」などの日付表記があると精度が上がります
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-600">
                  <span className="font-semibold text-blue-600">{parsed.length}件</span>
                  の予定が見つかりました。登録する予定を選択してください。
                </p>
                <button
                  onClick={() => {
                    if (selected.size === parsed.length) {
                      setSelected(new Set());
                    } else {
                      setSelected(new Set(parsed.map((_, i) => i)));
                    }
                  }}
                  className="text-xs text-blue-500 hover:text-blue-700"
                >
                  {selected.size === parsed.length ? "全て解除" : "全て選択"}
                </button>
              </div>
              {parsed.map((evt, i) => {
                const cat = catInfo(evt.category);
                const isSelected = selected.has(i);
                return (
                  <button
                    key={i}
                    onClick={() => toggleSelect(i)}
                    className={`w-full text-left rounded-xl border-2 p-3 transition-all ${
                      isSelected
                        ? "border-blue-400 bg-blue-50"
                        : "border-gray-200 bg-gray-50 opacity-60"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center ${
                          isSelected
                            ? "border-blue-500 bg-blue-500"
                            : "border-gray-300"
                        }`}
                      >
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 12 12">
                            <path d="M10 3L5 8.5 2 5.5" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Day表示バッジ */}
                          <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
                            {getDayLabel(evt.dayIndex)}
                          </span>
                          {evt.time && (
                            <span className="text-xs font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                              {evt.time}
                            </span>
                          )}
                          <span
                            className="text-xs px-1.5 py-0.5 rounded text-white"
                            style={{ backgroundColor: cat.c }}
                          >
                            {cat.i} {evt.category}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-gray-800 mt-1 truncate">
                          {evt.title}
                        </p>
                        {evt.location && (
                          <p className="text-xs text-gray-500 truncate">
                            📍 {evt.location}
                          </p>
                        )}
                        {evt.memo && (
                          <p className="text-xs text-gray-400 truncate mt-0.5">
                            {evt.memo}
                          </p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
              {error && (
                <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="px-5 py-4 border-t border-gray-100 flex gap-3">
          {step === "input" ? (
            <>
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleParse}
                disabled={!memo.trim() || parseMemo.isPending}
                className="flex-1 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {parseMemo.isPending ? (
                  <>
                    <span className="animate-spin inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                    AI解析中...
                  </>
                ) : (
                  "🤖 AIで解析する"
                )}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setStep("input");
                  setError(null);
                }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
              >
                ← 戻る
              </button>
              <button
                onClick={handleImport}
                disabled={selected.size === 0}
                className="flex-1 py-2.5 rounded-xl bg-green-500 text-white text-sm font-semibold hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                ✅ {selected.size}件を登録する
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
