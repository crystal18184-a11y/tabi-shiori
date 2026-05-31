// 旅のしおり - メインページ（Tailwind CSS化・useCallback最適化済み）
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { DC, CATS, PCATS, dsub, useTabi, showToast } from "@/contexts/TabiContext";
import { geocodeByName } from "@/lib/geocode";
import { hasCoord } from "@/lib/store";
import type { TabiEvent, PoolSpot, TabiDay } from "@/lib/store";
import LeafletMap from "@/components/LeafletMap";
import EvtModal from "@/components/EvtModal";
import PoolModal from "@/components/PoolModal";
import MemoImportModal from "@/components/MemoImportModal";
import WeatherBadge from "@/components/WeatherBadge";
import WarikanView from "@/components/WarikanView";
import CountdownView from "@/components/CountdownView";
import MapSidebar from "@/components/MapSidebar";
import { useSharedTrip } from "@/hooks/useSharedTrip";
import { exportTripPdf } from "@/lib/exportPdf";
import TripImageExportModal from "@/components/TripImageExportModal";
import MemoriesView from "@/components/MemoriesView";
import RecommendedSpotsView from "@/components/RecommendedSpotsView";
import TripPeriodModal from "@/components/TripPeriodModal";
import TripWizardModal from "@/components/TripWizardModal";
import RecommendedSpotModal from "@/components/RecommendedSpotModal";
import {
  DndContext, closestCenter, PointerSensor, TouchSensor,
  KeyboardSensor, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent, DragOverlay,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import {
  SortableContext, verticalListSortingStrategy,
  horizontalListSortingStrategy, useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { trpc } from "@/lib/trpc";

type TabType = "timeline" | "pool" | "map" | "warikan" | "countdown" | "memories" | "recommended";

const TAB_LABELS: Record<TabType, string> = {
  timeline: "📋 タイムライン",
  pool: "🎯 スポット",
  map: "🗺️ 地図",
  warikan: "💴 割り勘",
  countdown: "⏳ カウントダウン",
  memories: "📸 思い出",
  recommended: "⭐ おすすめ",
};

export default function TabiApp() {
  const ctx = useTabi();
  const {
    state, trip, day, canUndo, doUndo, selTrip, delTrip, addTripWithPeriod,
    selDay, delDay, addDay, reorderDay, sortDaysByDate, updateDayName,
    changeDayDateById, updateTripField,
    delEvt, reorderEvt, delPool, addMember, delMember, addExpense, delExpense, updateExpense,
    toast, applyRemoteTrip,
    addMemory, delMemory, toggleTripCompleted, clientId,
  } = ctx;

  const [tab, setTab] = useState<TabType>("timeline");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardIsFirst, setWizardIsFirst] = useState(false);
  const [mapMode, setMapMode] = useState<"all" | "day">("all");
  const [mapSidebarOpen, setMapSidebarOpen] = useState(true);
  const [evtModalOpen, setEvtModalOpen] = useState(false);
  const [poolModalOpen, setPoolModalOpen] = useState(false);
  const [editEvtId, setEditEvtId] = useState<string | null>(null);
  const [editEvtFromDay, setEditEvtFromDay] = useState<string | null>(null);
  const [editPoolId, setEditPoolId] = useState<string | null>(null);
  const [focusEventId, setFocusEventId] = useState<string | null>(null);
  const [dayEditModalOpen, setDayEditModalOpen] = useState(false);
  const [dayEditId, setDayEditId] = useState<string | null>(null);
  const [dayEditName, setDayEditName] = useState("");
  const [dayEditDate, setDayEditDate] = useState("");
  const [evtInitialSpot, setEvtInitialSpot] = useState<PoolSpot | null>(null);
  const [memoImportOpen, setMemoImportOpen] = useState(false);
  const [tripPeriodModalOpen, setTripPeriodModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [imageExportOpen, setImageExportOpen] = useState(false);

  // おすすめ追加モーダル
  const [recommendedModalData, setRecommendedModalData] = useState<{
    name: string; address: string; category: string; lat?: string; lng?: string; url?: string;
  } | null>(null);
  const createRecommended = trpc.recommendedSpots.create.useMutation();

  // タイムラインイベント -> おすすめ追加
  function handleAddEventToRecommended(evt: TabiEvent) {
    setRecommendedModalData({
      name: evt.title,
      address: evt.location || "",
      category: evt.category || "その他",
      lat: evt.lat,
      lng: evt.lng,
      url: evt.url,
    });
  }

  // スポットプール -> おすすめ追加
  function handleAddSpotToRecommended(spot: PoolSpot) {
    setRecommendedModalData({
      name: spot.name,
      address: spot.location || "",
      category: "観光",
      lat: spot.lat,
      lng: spot.lng,
      url: spot.url,
    });
  }

  const [joinCode, setJoinCode] = useState("");
  const [shareStatus, setShareStatus] = useState("");
  const [shareStatusOk, setShareStatusOk] = useState(true);
  const [wkMemberName, setWkMemberName] = useState("");
  const [wkExpTitle, setWkExpTitle] = useState("");
  const [wkExpAmount, setWkExpAmount] = useState("");
  const [wkExpPayer, setWkExpPayer] = useState("");
  const [wkExpCovered, setWkExpCovered] = useState<string[]>([]);

  const t = trip();
  const d = day();

  const { shareCode, syncing, syncError, startSharing, joinSharing, pushUpdate, stopSharing } = useSharedTrip(
    t,
    useCallback((remoteTrip) => { applyRemoteTrip(remoteTrip); }, [applyRemoteTrip])
  );

  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!shareCode || !t) return;
    if (pushTimer.current) clearTimeout(pushTimer.current);
    pushTimer.current = setTimeout(() => { pushUpdate(t, shareCode); }, 1500);
    return () => { if (pushTimer.current) clearTimeout(pushTimer.current); };
  }, [t, shareCode, pushUpdate]);

  // 初回起動ウィザード
  useEffect(() => {
    const tr = trip();
    if (tr && state.trips.length === 1 && tr.name === "旅行プラン" && tr.days.length === 1 && tr.days[0].events.length === 0) {
      setWizardIsFirst(true);
      setWizardOpen(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ctrl+Z undo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault(); doUndo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [doUndo]);

  useEffect(() => {
    setWkExpCovered(t?.members?.map(m => m.id) || []);
  }, [t?.members?.length]);

  const currentDayIdx = useMemo(() => t ? t.days.findIndex(d => d.id === state.did) : 0, [t, state.did]);

  // ⑤ useCallback で全ハンドラを安定化
  const openEvtForm = useCallback((eid: string | null, fromDay?: string, initialSpot?: PoolSpot) => {
    setEditEvtId(eid);
    setEditEvtFromDay(fromDay || state.did);
    setEvtInitialSpot(initialSpot || null);
    setEvtModalOpen(true);
  }, [state.did]);

  const openPoolForm = useCallback((pid: string | null) => {
    setEditPoolId(pid); setPoolModalOpen(true);
  }, []);

  const openDayEditModal = useCallback((dayId: string) => {
    const dd = t?.days.find(d => d.id === dayId);
    if (!dd) return;
    setDayEditId(dayId); setDayEditName(dd.name || ""); setDayEditDate(dd.date || ""); setDayEditModalOpen(true);
  }, [t]);

  const handleDayEditSave = useCallback(() => {
    if (!dayEditId) return;
    changeDayDateById(dayEditId, dayEditDate);
    updateDayName(dayEditId, dayEditName);
    setDayEditModalOpen(false);
    toast("✅ Day情報を更新しました", "#10b981");
  }, [dayEditId, dayEditDate, dayEditName, changeDayDateById, updateDayName, toast]);

  const handleMapFocus = useCallback((eid: string) => {
    setTab("map"); setTimeout(() => setFocusEventId(eid), 100);
  }, []);

  const handleStartSharing = useCallback(async () => {
    if (!t) return;
    setShareStatus("共有コードを作成中..."); setShareStatusOk(true);
    try {
      const code = await startSharing(t);
      setShareStatus(`✅ 共有コード「${code}」を発行しました`); setShareStatusOk(true);
    } catch {
      setShareStatus("❌ 共有の開始に失敗しました"); setShareStatusOk(false);
    }
  }, [t, startSharing]);

  const handleCopyShareUrl = useCallback(() => {
    if (!shareCode) return;
    navigator.clipboard.writeText(`${location.origin}${location.pathname}?share=${shareCode}`)
      .then(() => { setShareStatus("✅ 共有URLをコピーしました！"); setShareStatusOk(true); })
      .catch(() => { setShareStatus("❌ コピーに失敗しました"); setShareStatusOk(false); });
  }, [shareCode]);

  const handleJoinSharing = useCallback(async () => {
    const code = joinCode.trim().toUpperCase();
    if (!code) { setShareStatus("コードを入力してください"); setShareStatusOk(false); return; }
    setShareStatus("参加中..."); setShareStatusOk(true);
    const ok = await joinSharing(code, (remoteTrip) => {
      applyRemoteTrip(remoteTrip); setShareModalOpen(false); toast("🔗 共有プランに参加しました！", "#10b981");
    });
    if (!ok) { setShareStatus("❌ コードが見つかりません"); setShareStatusOk(false); }
  }, [joinCode, joinSharing, applyRemoteTrip, toast]);

  const handleAddMember = useCallback(() => {
    if (!wkMemberName.trim()) return;
    const err = addMember(wkMemberName.trim());
    if (err) { toast(err, "#ef4444"); return; }
    setWkMemberName(""); setWkExpCovered(t?.members?.map(m => m.id) || []);
  }, [wkMemberName, addMember, toast, t]);

  const handleAddExpense = useCallback(() => {
    const title = wkExpTitle.trim(); const amount = parseFloat(wkExpAmount);
    if (!title || isNaN(amount) || amount <= 0) { toast("内容と金額を入力してください", "#ef4444"); return; }
    if (!wkExpPayer) { toast("支払者を選択してください", "#ef4444"); return; }
    if (!wkExpCovered.length) { toast("誰の分か選んでください", "#ef4444"); return; }
    addExpense(title, amount, wkExpPayer, wkExpCovered);
    setWkExpTitle(""); setWkExpAmount(""); setWkExpPayer("");
    setWkExpCovered(t?.members?.map(m => m.id) || []);
  }, [wkExpTitle, wkExpAmount, wkExpPayer, wkExpCovered, addExpense, toast, t]);

  const handleMemoImport = useCallback((eventsByDayId: Record<string, Omit<TabiEvent, "id">[]>) => {
    let total = 0;
    Object.entries(eventsByDayId).forEach(([dayId, evts]) => {
      evts.forEach(evt => ctx.saveEvt(evt, dayId));
      total += evts.length;
    });
    toast(`✅ ${total}件の予定を登録しました`, "#10b981");
  }, [ctx, toast]);

  return (
    <div className="w-screen h-screen bg-slate-200 flex items-center justify-center font-sans">
      <div className="w-[96vw] h-[94vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">

        {/* ⑥ アクセシビリティ: role・aria属性付きトップバー */}
        <header role="banner" className="flex items-center gap-2 px-3 py-2 bg-white border-b border-slate-200 flex-shrink-0 flex-wrap">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="メニューを開く"
            aria-expanded={sidebarOpen}
            className="px-3 py-1.5 text-xs font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors"
          >☰</button>
          <input
            value={t?.name || ""}
            placeholder="旅行名"
            aria-label="旅行名"
            onChange={e => updateTripField("name", e.target.value)}
            className="bg-transparent border-0 border-b-2 border-slate-200 text-slate-900 text-sm font-bold px-1 py-0.5 outline-none flex-1 min-w-14 font-serif focus:border-blue-400 transition-colors"
          />
          <input
            value={t?.destination || ""}
            placeholder="📍 目的地"
            aria-label="目的地"
            onChange={e => updateTripField("destination", e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-lg text-slate-500 text-xs px-2 py-1 outline-none w-24 focus:border-blue-300 transition-colors"
          />
          <button
            onClick={doUndo}
            disabled={!canUndo}
            aria-label="操作を元に戻す"
            className={`px-2 py-1.5 text-xs font-bold rounded-lg border transition-colors ${canUndo ? "bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100" : "bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed"}`}
          >↩ 戻す</button>
          <button
            onClick={() => { if (t) exportTripPdf(t); }}
            aria-label="PDFとして保存"
            className="px-2 py-1.5 text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors"
          >📄 PDF</button>
          <button
            onClick={() => setImageExportOpen(true)}
            aria-label="SNS用画像を作成"
            className="px-2 py-1.5 text-xs font-bold bg-pink-50 text-pink-700 border border-pink-200 rounded-lg hover:bg-pink-100 transition-colors"
          >📸 SNS</button>
          <button
            onClick={() => { setShareStatus(""); setShareModalOpen(true); }}
            aria-label={shareCode ? "共有中 - 共有設定を開く" : "共有設定を開く"}
            className={`px-2 py-1.5 text-xs font-bold rounded-lg border transition-colors ${shareCode ? "bg-green-50 text-green-800 border-green-200 hover:bg-green-100" : "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100"}`}
          >{shareCode ? "🔗 共有中" : "🔗 共有"}</button>
        </header>

        {/* ボディ */}
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          <DayTabBar
            days={t?.days || []}
            activeDayId={state.did || ""}
            onSelectDay={selDay}
            onDelDay={delDay}
            onAddDay={addDay}
            onEditDay={openDayEditModal}
            onReorderDay={reorderDay}
            onSortByDate={sortDaysByDate}
            destination={t?.destination || undefined}
          />

          {/* 機能タブ行 */}
          <nav role="tablist" aria-label="機能タブ" className="flex items-center gap-1 px-3 py-1.5 bg-white border-b border-slate-200 flex-shrink-0 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            <div className="flex gap-1 flex-nowrap items-center min-w-max">
              {(Object.keys(TAB_LABELS) as TabType[]).map(tabKey => (
                <button
                  key={tabKey}
                  role="tab"
                  aria-selected={tab === tabKey}
                  onClick={() => setTab(tabKey)}
                  className={`px-3 py-1 text-[10px] font-semibold rounded-full border whitespace-nowrap flex-shrink-0 transition-colors ${
                    tab === tabKey
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-transparent text-slate-400 border-slate-200 hover:border-slate-300 hover:text-slate-600"
                  }`}
                >{TAB_LABELS[tabKey]}</button>
              ))}
            </div>
            {tab === "timeline" && (
              <div className="flex gap-1.5 ml-auto flex-shrink-0">
                <button
                  onClick={() => setMemoImportOpen(true)}
                  aria-label="メモから予定を一括登録"
                  className="bg-green-50 border border-green-300 rounded-lg text-green-700 px-2.5 py-1.5 text-[10px] font-bold cursor-pointer whitespace-nowrap hover:bg-green-100 transition-colors"
                >📋 メモ読み取り</button>
              </div>
            )}
            {tab === "pool" && (
              <div className="flex gap-1.5 ml-auto flex-shrink-0">
                <button
                  onClick={() => openPoolForm(null)}
                  aria-label="スポットを追加"
                  className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg px-3 py-1.5 text-xs font-bold cursor-pointer whitespace-nowrap hover:from-blue-600 hover:to-indigo-600 transition-all"
                >＋ スポット追加</button>
              </div>
            )}
          </nav>

          {/* コンテンツエリア */}
          <main role="main" className="flex-1 overflow-hidden flex min-h-0">
            {tab === "timeline" && (
              <TimelineView
                events={d?.events || []}
                dayId={state.did || ""}
                onEdit={(eid) => openEvtForm(eid, state.did ?? undefined)}
                onDel={delEvt}
                onReorder={reorderEvt}
                onAddToRecommended={handleAddEventToRecommended}
                onAddEvent={() => openEvtForm(null, state.did || "")}
              />
            )}
            {tab === "map" && (
              <div className="flex-1 flex flex-col overflow-hidden min-h-0">
                <div className="flex gap-1.5 px-2.5 py-1.5 bg-slate-50 border-b border-slate-200 items-center flex-shrink-0 flex-wrap">
                  <button
                    onClick={() => setMapMode("all")}
                    aria-pressed={mapMode === "all"}
                    className={`px-2 py-1 text-xs font-semibold rounded-lg border transition-colors ${mapMode === "all" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-400 border-slate-200 hover:border-slate-300"}`}
                  >🌐 全日程</button>
                  <button
                    onClick={() => setMapMode("day")}
                    aria-pressed={mapMode === "day"}
                    className={`px-2 py-1 text-xs font-semibold rounded-lg border transition-colors ${mapMode === "day" ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-400 border-slate-200 hover:border-slate-300"}`}
                  >📅 この日</button>
                  {(() => {
                    const poolWithCoords = (mapMode === "all"
                      ? t?.days.flatMap(d => d.pool || [])
                      : t?.days.filter(d => d.id === state.did).flatMap(d => d.pool || [])
                    )?.filter(p => hasCoord(p)) || [];
                    return poolWithCoords.length > 0 ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-amber-800 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5 font-bold">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" />
                        ★ 行きたいスポット {poolWithCoords.length}件
                      </span>
                    ) : null;
                  })()}
                  <MapGmapsLink trip={t} mapMode={mapMode} currentDid={state.did || ""} />
                </div>
                <div className="flex-1 flex overflow-hidden min-h-0 relative">
                  <LeafletMap trip={t} mapMode={mapMode} currentDid={state.did || ""} focusEventId={focusEventId} onFocusDone={() => setFocusEventId(null)} />
                  <button
                    onClick={() => setMapSidebarOpen(v => !v)}
                    aria-label={mapSidebarOpen ? "スポットリストを閉じる" : "スポットリストを開く"}
                    aria-expanded={mapSidebarOpen}
                    className="absolute top-1/2 -translate-y-1/2 z-[500] bg-white border border-slate-200 rounded-l-md w-5 h-12 cursor-pointer flex items-center justify-center shadow-md text-slate-500 text-xs transition-[right]"
                    style={{ right: mapSidebarOpen ? 190 : 0, transitionDuration: "250ms" }}
                  >{mapSidebarOpen ? "›" : "‹"}</button>
                  <MapSidebar trip={t ?? null} mapMode={mapMode} currentDid={state.did || ""} onFocusEvent={handleMapFocus} isOpen={mapSidebarOpen} />
                </div>
              </div>
            )}
            {tab === "pool" && (
              <PoolView
                pool={d?.pool || []}
                onEdit={openPoolForm}
                onDel={(pid) => delPool(pid)}
                onAddToTimeline={(spot) => { openEvtForm(null, state.did || "", spot); }}
                onAddToRecommended={handleAddSpotToRecommended}
                onAddSpot={() => openPoolForm(null)}
              />
            )}
            {tab === "warikan" && (
              <WarikanView
                trip={t ?? null}
                wkMemberName={wkMemberName} setWkMemberName={setWkMemberName}
                wkExpTitle={wkExpTitle} setWkExpTitle={setWkExpTitle}
                wkExpAmount={wkExpAmount} setWkExpAmount={setWkExpAmount}
                wkExpPayer={wkExpPayer} setWkExpPayer={setWkExpPayer}
                wkExpCovered={wkExpCovered} setWkExpCovered={setWkExpCovered}
                onAddMember={handleAddMember}
                onDelMember={delMember}
                onAddExpense={handleAddExpense}
                onDelExpense={delExpense}
                onUpdateExpense={updateExpense}
              />
            )}
            {tab === "countdown" && <CountdownView trip={t ?? null} />}
            {tab === "memories" && t && (
              <div className="flex-1 overflow-y-auto">
                <MemoriesView trip={t} onAddMemory={addMemory} onDeleteMemory={delMemory} onToggleCompleted={toggleTripCompleted} />
              </div>
            )}
            {tab === "recommended" && (
              <div className="flex-1 overflow-y-auto flex flex-col">
                <RecommendedSpotsView
                  onAddToPool={(data) => { ctx.savePool(data); showToast("✓ スポットプールに追加しました", "#22c55e"); }}
                  userId={clientId}
                  userName={t?.name || "旅人"}
                />
              </div>
            )}
          </main>
        </div>
      </div>

      {/* ⑥ アクセシビリティ対応サイドバー */}
      {sidebarOpen && (
        <div role="dialog" aria-modal="true" aria-label="旅行一覧" className="fixed inset-0 z-[199]">
          <div onClick={() => setSidebarOpen(false)} className="absolute inset-0 bg-black/35" aria-hidden="true" />
          <div className="absolute top-0 left-0 w-60 h-full bg-white flex flex-col shadow-xl z-[200]">
            <div className="flex items-center justify-between px-3 pt-4 pb-2.5 border-b border-slate-100">
              <span className="font-serif text-base font-bold text-slate-900">✈️ 🌸 旅のしおり</span>
              <button onClick={() => setSidebarOpen(false)} aria-label="メニューを閉じる" className="bg-transparent border-none text-xl text-slate-400 cursor-pointer hover:text-slate-600">×</button>
            </div>
            <button
              onClick={() => { setWizardIsFirst(false); setWizardOpen(true); setSidebarOpen(false); }}
              className="mx-2.5 my-2 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white font-bold text-sm rounded-xl cursor-pointer hover:from-blue-600 hover:to-indigo-600 transition-all"
            >＋ 旅行を追加</button>
            <nav aria-label="旅行一覧" className="flex-1 overflow-y-auto px-1.5">
              {state.trips.map(tr => (
                <div
                  key={tr.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => { selTrip(tr.id); setSidebarOpen(false); }}
                  onKeyDown={e => e.key === "Enter" && (selTrip(tr.id), setSidebarOpen(false))}
                  aria-current={tr.id === state.tid ? "true" : undefined}
                  className={`flex items-center gap-1.5 px-2 py-2 rounded-lg cursor-pointer transition-colors ${tr.id === state.tid ? "bg-blue-50" : "hover:bg-slate-50"}`}
                >
                  <span>🌏</span>
                  <span className="flex-1 text-sm font-semibold overflow-hidden text-ellipsis whitespace-nowrap">{tr.name}</span>
                  {state.trips.length > 1 && (
                    <button
                      onClick={e => { e.stopPropagation(); delTrip(tr.id); }}
                      aria-label={`${tr.name}を削除`}
                      className="bg-transparent border-none text-slate-300 cursor-pointer text-sm hover:text-red-400 transition-colors"
                    >×</button>
                  )}
                </div>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* 旅行期間設定モーダル */}
      {tripPeriodModalOpen && (
        <TripPeriodModal
          onClose={() => setTripPeriodModalOpen(false)}
          onConfirm={(startDate, endDate) => {
            addTripWithPeriod("新しい旅行", "", startDate, endDate);
            setTripPeriodModalOpen(false);
            toast(`✅ ${Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) + 1}日間の旅行を作成しました`, "#10b981");
          }}
        />
      )}

      {/* ⑥ 共有モーダル（aria対応） */}
      {shareModalOpen && (
        <div
          role="dialog" aria-modal="true" aria-labelledby="share-modal-title"
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[300] p-4"
          onClick={e => e.target === e.currentTarget && setShareModalOpen(false)}
        >
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center px-4 py-3.5 border-b border-slate-100">
              <h2 id="share-modal-title" className="font-extrabold text-sm text-slate-900">🔗 リアルタイム共有</h2>
              <button onClick={() => setShareModalOpen(false)} aria-label="閉じる" className="bg-transparent border-none text-xl text-slate-400 cursor-pointer leading-none hover:text-slate-600">×</button>
            </div>
            <div className="p-4 flex flex-col gap-4">
              <div>
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">このプランを共有する</div>
                {!shareCode ? (
                  <button
                    onClick={handleStartSharing}
                    disabled={syncing}
                    className={`w-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl py-3 text-sm font-bold transition-all ${syncing ? "opacity-70 cursor-not-allowed" : "hover:from-blue-600 hover:to-indigo-600"}`}
                  >{syncing ? "⏳ 作成中..." : "🔗 共有コードを発行する"}</button>
                ) : (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3">
                    <div className="text-[10px] font-bold text-green-800 mb-1.5">共有コード</div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-mono text-2xl font-black text-green-800 tracking-widest flex-1">{shareCode}</span>
                      <button onClick={() => { navigator.clipboard.writeText(shareCode); toast("コードをコピーしました！", "#10b981"); }} className="bg-white border border-green-200 rounded-lg text-green-800 px-2.5 py-1 text-xs cursor-pointer hover:bg-green-50">コピー</button>
                    </div>
                    <button onClick={handleCopyShareUrl} className="w-full bg-white border border-green-200 rounded-lg text-green-800 py-1.5 text-xs font-semibold cursor-pointer hover:bg-green-50">🔗 共有URLをコピー</button>
                    <div className="text-[10px] text-green-700 mt-1.5 leading-relaxed">変更は約5秒ごとに自動同期されます。</div>
                    <button onClick={() => { stopSharing(); setShareStatus(""); }} className="mt-2 bg-transparent border-none text-slate-400 text-xs cursor-pointer p-0 hover:text-slate-600">共有を停止する</button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-px bg-slate-200" />
                <span className="text-xs text-slate-400">または</span>
                <div className="flex-1 h-px bg-slate-200" />
              </div>
              <div>
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">友達のコードで参加する</div>
                <div className="flex gap-1.5">
                  <input
                    value={joinCode}
                    onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                    onKeyDown={e => e.key === "Enter" && handleJoinSharing()}
                    placeholder="例: AB12CD34"
                    maxLength={8}
                    aria-label="共有コードを入力"
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 text-base px-3 py-2 outline-none font-mono tracking-widest uppercase focus:border-blue-300"
                  />
                  <button
                    onClick={handleJoinSharing}
                    disabled={syncing || !joinCode.trim()}
                    className={`rounded-lg px-4 py-2 text-sm font-bold whitespace-nowrap transition-colors ${joinCode.trim() ? "bg-slate-900 text-white hover:bg-slate-700" : "bg-slate-100 text-slate-400 cursor-not-allowed"}`}
                  >参加</button>
                </div>
              </div>
              {(shareStatus || syncError) && (
                <div role="alert" className={`text-xs px-3 py-2 rounded-lg font-semibold ${shareStatusOk ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
                  {shareStatus || syncError}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {evtModalOpen && (
        <EvtModal
          trip={t} editEvtId={editEvtId} editFromDay={editEvtFromDay || state.did || ""}
          initialSpot={evtInitialSpot} clientId={clientId}
          onClose={() => { setEvtModalOpen(false); setEvtInitialSpot(null); }}
          onSave={(data: Omit<TabiEvent, "id">, toDid: string) => { ctx.saveEvt(data, toDid, editEvtId ?? undefined); setEvtModalOpen(false); setEvtInitialSpot(null); }}
        />
      )}
      {poolModalOpen && (
        <PoolModal
          day={d} editPoolId={editPoolId} destination={t?.destination}
          onClose={() => setPoolModalOpen(false)}
          onSave={(data: Omit<PoolSpot, "id">) => { ctx.savePool(data, editPoolId ?? undefined); setPoolModalOpen(false); }}
        />
      )}
      {memoImportOpen && d && (
        <MemoImportModal
          onClose={() => setMemoImportOpen(false)}
          onImportMultiDay={handleMemoImport}
          dayDate={d.date || ""} destination={t?.destination || ""}
          tripDays={t?.days || []} currentDayIndex={currentDayIdx}
        />
      )}

      {/* Day編集モーダル */}
      {dayEditModalOpen && dayEditId && (
        <div
          role="dialog" aria-modal="true" aria-labelledby="day-edit-title"
          className="fixed inset-0 bg-black/45 z-[1000] flex items-center justify-center"
          onClick={e => e.target === e.currentTarget && setDayEditModalOpen(false)}
        >
          <div className="bg-white rounded-2xl p-5 w-72 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 id="day-edit-title" className="font-extrabold text-sm text-slate-900">📅 Dayを編集</h3>
              <button onClick={() => setDayEditModalOpen(false)} aria-label="閉じる" className="bg-transparent border-none text-lg cursor-pointer text-slate-400 hover:text-slate-600">×</button>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label htmlFor="day-edit-name" className="text-[11px] font-bold text-slate-500 block mb-1">Day名称（任意）</label>
                <input
                  id="day-edit-name"
                  value={dayEditName}
                  onChange={e => setDayEditName(e.target.value)}
                  placeholder="例：東京観光日"
                  className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm outline-none box-border focus:border-blue-300"
                />
              </div>
              <div>
                <label htmlFor="day-edit-date" className="text-[11px] font-bold text-slate-500 block mb-1">日付</label>
                <input
                  id="day-edit-date"
                  type="date"
                  value={dayEditDate}
                  onChange={e => setDayEditDate(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-sm outline-none box-border cursor-pointer focus:border-blue-300"
                />
              </div>
              <div className="flex gap-2 mt-1">
                <button onClick={() => setDayEditModalOpen(false)} className="flex-1 bg-slate-100 border-none rounded-lg py-2 text-sm font-bold cursor-pointer text-slate-500 hover:bg-slate-200 transition-colors">キャンセル</button>
                <button onClick={handleDayEditSave} className="flex-[2] bg-gradient-to-r from-blue-500 to-indigo-500 border-none rounded-lg py-2 text-sm font-bold cursor-pointer text-white hover:from-blue-600 hover:to-indigo-600 transition-all">保存</button>
              </div>
              {t && t.days.some(d => d.date) && (
                <button
                  onClick={() => { sortDaysByDate(); setDayEditModalOpen(false); toast("🗓️ 日付順に並び替えました", "#10b981"); }}
                  className="bg-green-50 border border-green-200 rounded-lg py-1.5 text-xs font-bold cursor-pointer text-green-700 w-full hover:bg-green-100 transition-colors"
                >🗓️ 日付順に自動並び替え</button>
              )}
            </div>
          </div>
        </div>
      )}

      {imageExportOpen && t && (
        <TripImageExportModal
          trip={t}
          onClose={() => setImageExportOpen(false)}
        />
      )}

      {wizardOpen && (
        <TripWizardModal
          isFirstTrip={wizardIsFirst}
          onClose={() => setWizardOpen(false)}
          onCreate={(name, destination, startDate, endDate) => {
            if (wizardIsFirst && state.trips.length === 1) {
              const oldId = state.trips[0].id;
              addTripWithPeriod(name, destination, startDate, endDate);
              setTimeout(() => delTrip(oldId), 50);
            } else {
              addTripWithPeriod(name, destination, startDate, endDate);
            }
          }}
        />
      )}

      {recommendedModalData && (
        <RecommendedSpotModal
          userId={clientId}
          userName={t?.name || "旅人"}
          initialData={recommendedModalData}
          onClose={() => setRecommendedModalData(null)}
          onSaved={() => {
            setRecommendedModalData(null);
            showToast("✓ おすすめスポットを追加しました", "#22c55e");
          }}
        />
      )}
    </div>
  );
}

// ===== DayTabBar =====
function SortableDayTab({ day, index, isActive, onSelect, onDel, onEdit, destination }: {
  day: { id: string; date: string; name?: string }; index: number; isActive: boolean;
  onSelect: (id: string) => void; onDel: (id: string) => void; onEdit: (id: string) => void; destination?: string;
}) {
  const color = DC[index % DC.length];
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: day.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1, zIndex: isDragging ? 999 : undefined, touchAction: "none" }}
      className="relative inline-flex"
    >
      <div
        role="tab"
        aria-selected={isActive}
        tabIndex={0}
        onClick={() => !isDragging && onSelect(day.id)}
        onKeyDown={e => e.key === "Enter" && !isDragging && onSelect(day.id)}
        style={{ borderTopColor: color, borderTopWidth: 3, background: isActive ? color + "18" : "#f8fafc", borderColor: isActive ? color : "#e2e8f0" }}
        className="border border-b-0 rounded-t-lg text-slate-400 px-2.5 pt-1.5 pb-1 cursor-pointer text-[11px] min-w-[60px] flex flex-col items-center gap-px select-none transition-all"
      >
        <div {...attributes} {...listeners} className="cursor-grab text-slate-300 text-[10px] leading-none mb-px touch-none" title="ドラッグして並び替え">⠇</div>
        <span style={{ color: isActive ? color : undefined }} className="font-extrabold text-xs">Day {index + 1}{day.name ? ` ・ ${day.name}` : ""}</span>
        <span className={`text-[9px] ${day.date ? "text-slate-500" : "text-slate-300"}`}>{day.date ? dsub(day.date) : "未設定"}</span>
        {day.date && <WeatherBadge date={day.date} destination={destination} compact />}
      </div>
      <button onClick={e => { e.stopPropagation(); onEdit(day.id); }} aria-label="Dayを編集" className="absolute -top-1 right-3 bg-slate-200 border-none rounded-full w-3.5 h-3.5 text-slate-500 cursor-pointer text-[8px] flex items-center justify-center leading-none hover:bg-slate-300">✎</button>
      <button onClick={e => { e.stopPropagation(); onDel(day.id); }} aria-label="Dayを削除" className="absolute -top-1 -right-1 bg-slate-200 border-none rounded-full w-3.5 h-3.5 text-slate-500 cursor-pointer text-[9px] flex items-center justify-center leading-none hover:bg-red-200">×</button>
    </div>
  );
}

function DayTabBar({ days, activeDayId, onSelectDay, onDelDay, onAddDay, onEditDay, onReorderDay, onSortByDate, destination }: {
  days: Array<{ id: string; date: string; name?: string }>; activeDayId: string;
  onSelectDay: (id: string) => void; onDelDay: (id: string) => void; onAddDay: () => void;
  onEditDay: (id: string) => void; onReorderDay: (fromIdx: number, toIdx: number) => void;
  onSortByDate: () => void; destination?: string;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIdx = days.findIndex(d => d.id === active.id);
    const toIdx = days.findIndex(d => d.id === over.id);
    if (fromIdx !== -1 && toIdx !== -1) onReorderDay(fromIdx, toIdx);
  }, [days, onReorderDay]);

  return (
    <div className="bg-white border-b border-slate-200 px-2.5 flex-shrink-0 overflow-x-auto" style={{ WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
      <div className="flex gap-0.5 items-end pt-1.5 min-w-max">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={days.map(d => d.id)} strategy={horizontalListSortingStrategy}>
            {days.map((dd, i) => (
              <SortableDayTab key={dd.id} day={dd} index={i} isActive={dd.id === activeDayId} onSelect={onSelectDay} onDel={days.length > 1 ? onDelDay : () => {}} onEdit={onEditDay} destination={destination} />
            ))}
          </SortableContext>
        </DndContext>
        <button onClick={onAddDay} aria-label="日程を追加" className="bg-transparent border border-dashed border-slate-300 rounded-t-lg text-slate-400 px-2.5 py-1.5 cursor-pointer text-xs self-end whitespace-nowrap hover:border-blue-300 hover:text-blue-400 transition-colors">＋ 日追加</button>
        {days.some(d => d.date) && (
          <button onClick={onSortByDate} title="日付順に並び替え" className="bg-transparent border border-slate-200 rounded-t-lg text-slate-500 px-2 py-1.5 cursor-pointer text-[10px] self-end whitespace-nowrap hover:bg-slate-50 transition-colors">🗓️ 日付順</button>
        )}
      </div>
    </div>
  );
}

// ===== 移動時間計算ウィジェット =====
// 注意: transit/bicyclingモードはGoogle Mapsプロキシで未対応のため、drivingにフォールバックされる
const WIDGET_MODES = [
  { key: "driving" as const, icon: "🚗", label: "車" },
  { key: "walking" as const, icon: "🚶", label: "徒歩" },
] as const;
function TravelTimeWidget({ from, to }: { from: TabiEvent; to: TabiEvent }) {
  const [result, setResult] = useState<{ distance: string; duration: string; mode: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"driving" | "walking">("driving");
  const [expanded, setExpanded] = useState(false);
  const calcMutation = trpc.travel.calcTime.useMutation();
  const getLocation = (e: TabiEvent) => (e.lat && e.lng) ? `${e.lat},${e.lng}` : e.location || e.title;

  const handleCalc = useCallback(async (m: typeof mode) => {
    setLoading(true); setError(null); setMode(m);
    try {
      const res = await calcMutation.mutateAsync({ origin: getLocation(from), destination: getLocation(to), mode: m });
      if (res.ok) setResult({ distance: res.distance, duration: res.duration, mode: m });
      else { setError(res.error || "計算失敗"); setResult(null); }
    } catch { setError("通信エラー"); setResult(null); }
    finally { setLoading(false); }
  }, [from, to, calcMutation]);

  if (!expanded) return (
    <div className="flex justify-center my-1 ml-11">
      <button onClick={() => { setExpanded(true); handleCalc(mode); }} className="bg-sky-50 border border-dashed border-blue-300 rounded-xl text-blue-500 px-2.5 py-0.5 text-[10px] font-semibold cursor-pointer flex items-center gap-1 hover:bg-sky-100 transition-colors">🚗 移動時間を計算</button>
    </div>
  );
  return (
    <div className="ml-11 mb-1.5 bg-sky-50 border border-blue-200 rounded-xl px-2.5 py-1.5">
      <div className="flex gap-1 mb-1 flex-wrap items-center">
        {WIDGET_MODES.map(tm => (
          <button key={tm.key} onClick={() => handleCalc(tm.key)} aria-pressed={mode === tm.key} className={`rounded-lg px-2 py-0.5 text-[10px] font-semibold cursor-pointer flex items-center gap-0.5 border transition-colors ${mode === tm.key ? "bg-blue-500 text-white border-blue-500" : "bg-white text-slate-500 border-slate-200 hover:border-slate-300"}`}>{tm.icon} {tm.label}</button>
        ))}
        <button onClick={() => setExpanded(false)} aria-label="閉じる" className="ml-auto bg-transparent border-none cursor-pointer text-[10px] text-slate-400 hover:text-slate-600">✕</button>
      </div>
      {loading && <p className="text-[10px] text-slate-500">計算中...</p>}
      {error && <p role="alert" className="text-[10px] text-red-500">{error}</p>}
      {result && <div className="flex gap-2 items-center text-xs"><span className="font-bold text-blue-800">⏱ {result.duration}</span><span className="text-slate-400">·</span><span className="text-slate-500">{result.distance}</span></div>}
    </div>
  );
}

// ===== 画像ライトボックス =====
function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div role="dialog" aria-modal="true" aria-label="画像を拡大表示" className="fixed inset-0 bg-black/88 flex items-center justify-center z-[9000] p-4" onClick={onClose}>
      <button onClick={onClose} aria-label="閉じる" className="absolute top-3 right-4 bg-white/15 border-none text-white text-xl rounded-full w-9 h-9 cursor-pointer flex items-center justify-center hover:bg-white/25">×</button>
      <img src={src} alt="拡大画像" className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
    </div>
  );
}

// ===== ドラッグ可能な予定カード =====
function SortableEventCard({ event, index, total, dayId, onEdit, onDel, onAddToRecommended }: {
  event: TabiEvent; index: number; total: number; dayId: string;
  onEdit: (id: string) => void; onDel: (dayId: string, eid: string) => void;
  onAddToRecommended?: (evt: TabiEvent) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: event.id });
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const c = CATS[event.category] || CATS["その他"];
  return (
    <div ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1, zIndex: isDragging ? 999 : undefined }} className="flex gap-2">
      <div className="flex flex-col items-center w-11 flex-shrink-0">
        <div style={{ background: c.c }} className="w-2 h-2 rounded-full flex-shrink-0 mt-1" />
        <span className="text-[10px] font-bold text-slate-500 mt-0.5 whitespace-nowrap">{event.time}</span>
        {index < total - 1 && <div className="flex-1 w-0.5 bg-slate-200 min-h-4 rounded mx-auto my-0.5" />}
      </div>
      <article className={`flex-1 bg-white rounded-xl px-3 py-2.5 mb-2 border border-slate-200 ${isDragging ? "shadow-xl" : "shadow-sm"}`}>
        <div className="flex justify-between items-center mb-1.5">
          <span style={{ background: c.c + "18", color: c.c, borderColor: c.c + "40" }} className="inline-flex gap-1 text-[10px] font-bold rounded-full px-2 py-0.5 border">{c.i} {event.category}</span>
          <div className="flex gap-0.5 items-center">
            <div {...attributes} {...listeners} className={`${isDragging ? "cursor-grabbing" : "cursor-grab"} px-1 py-0.5 text-slate-300 text-sm touch-none leading-none`} title="ドラッグして並び替え">⠿</div>
            {onAddToRecommended && (
              <button
                onClick={() => onAddToRecommended(event)}
                aria-label={`${event.title}をおすすめに追加`}
                className="bg-amber-50 border border-amber-200 rounded-md text-amber-600 cursor-pointer text-[10px] font-bold px-2 py-0.5 whitespace-nowrap hover:bg-amber-100 transition-colors"
              >
                ⭐ おすすめ
              </button>
            )}
            <button onClick={() => onEdit(event.id)} aria-label={`${event.title}を編集`} className="bg-transparent border-none cursor-pointer text-sm p-0.5 opacity-50 hover:opacity-100">✏️</button>
            <button onClick={() => onDel(dayId, event.id)} aria-label={`${event.title}を削除`} className="bg-transparent border-none cursor-pointer text-sm p-0.5 opacity-50 hover:opacity-100">🗑️</button>
          </div>
        </div>
        <h4 className="text-sm font-bold text-slate-900 mb-0.5">{event.title}</h4>
        {event.location && (
          <div className="text-[11px] text-slate-400 mb-0.5 flex items-center gap-1 flex-wrap">
            <span>📍 {event.location}</span>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(hasCoord(event) ? `${event.lat},${event.lng}` : event.location)}&travelmode=driving`}
              target="_blank" rel="noreferrer"
              aria-label={`${event.location}へナビを開始`}
              className="inline-flex items-center gap-0.5 text-[10px] font-bold text-white bg-emerald-500 rounded-full px-1.5 no-underline whitespace-nowrap leading-relaxed hover:bg-emerald-600 transition-colors"
            >🚨 ナビ</a>
          </div>
        )}
        {event.reservationNo && (
          <div className="text-[11px] text-indigo-600 mb-1 flex items-center gap-1 bg-indigo-50 rounded-md px-2 py-0.5 border border-indigo-200">
            <span className="font-bold">🎫</span>
            <span className="font-mono font-semibold tracking-wide">{event.reservationNo}</span>
            <button onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(event.reservationNo || ""); }} aria-label="予約番号をコピー" className="bg-transparent border-none cursor-pointer text-[10px] p-0.5 opacity-60 hover:opacity-100">📋</button>
          </div>
        )}
        {event.memo && <p className="text-xs text-slate-500 leading-relaxed whitespace-pre-wrap mb-1">{event.memo}</p>}
        {event.url && <a href={event.url} target="_blank" rel="noreferrer" className="inline-block text-[11px] text-blue-500 no-underline font-semibold mb-0.5 hover:underline">🔗 リンクを開く</a>}
        {event.attachments && event.attachments.length > 0 && (
          <div className="flex gap-1 flex-wrap mt-1 mb-1">
            {event.attachments.map((att, i) => (
              <button key={i} onClick={() => setLightboxSrc(att)} aria-label={`添付画像${i + 1}を拡大`} className="w-14 h-14 rounded-md overflow-hidden border border-slate-200 p-0 cursor-pointer bg-transparent hover:opacity-80 transition-opacity">
                <img src={att} alt={`添付${i + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}
        {event.photo && (
          <button onClick={() => setLightboxSrc(event.photo!)} aria-label="写真を拡大" className="block w-full p-0 border-none bg-transparent cursor-pointer rounded-lg overflow-hidden mt-1 hover:opacity-90 transition-opacity">
            <img src={event.photo} alt="" className="w-full max-h-40 object-cover rounded-lg block" />
          </button>
        )}
        {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}
      </article>
    </div>
  );
}

// ===== タイムラインビュー =====
function TimelineView({ events, dayId, onEdit, onDel, onReorder, onAddToRecommended, onAddEvent }: {
  events: TabiEvent[]; dayId: string;
  onEdit: (id: string) => void; onDel: (dayId: string, eid: string) => void;
  onReorder: (dayId: string, fromIdx: number, toIdx: number) => void;
  onAddToRecommended?: (evt: TabiEvent) => void;
  onAddEvent?: () => void;
}) {

  const [activeId, setActiveId] = useState<string | null>(null);
  const activeEvent = activeId ? events.find(e => e.id === activeId) : null;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const handleDragStart = useCallback((event: DragStartEvent) => setActiveId(String(event.active.id)), []);
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIdx = events.findIndex(e => e.id === active.id);
    const toIdx = events.findIndex(e => e.id === over.id);
    if (fromIdx !== -1 && toIdx !== -1) onReorder(dayId, fromIdx, toIdx);
  }, [events, dayId, onReorder]);



  const headerArea = (
    <div className="p-3 pb-0 flex flex-col gap-2 flex-shrink-0">
      <button
        onClick={onAddEvent}
        aria-label="予定を追加"
        className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl py-2.5 text-sm font-bold cursor-pointer hover:from-blue-600 hover:to-indigo-600 transition-all flex items-center justify-center gap-1.5"
      >
        ＋ 予定を追加
      </button>
    </div>
  );

  if (!events.length) return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {headerArea}
      <div role="status" className="flex-1 flex flex-col items-center justify-center gap-2.5 p-6 text-slate-400">
        <div className="text-5xl">📅</div>
        <p>予定がまだありません</p>
      </div>
    </div>
  );
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {headerArea}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col" style={{ WebkitOverflowScrolling: "touch" }}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <SortableContext items={events.map(e => e.id)} strategy={verticalListSortingStrategy}>
          {events.map((e, i) => (
            <div key={e.id}>
              <SortableEventCard event={e} index={i} total={events.length} dayId={dayId} onEdit={onEdit} onDel={onDel} onAddToRecommended={onAddToRecommended} />
              {i < events.length - 1 && (hasCoord(e) || e.location) && (hasCoord(events[i + 1]) || events[i + 1].location) && <TravelTimeWidget from={e} to={events[i + 1]} />}
            </div>
          ))}
        </SortableContext>
        <DragOverlay dropAnimation={{ duration: 150, easing: "cubic-bezier(0.18, 0.67, 0.6, 1.22)" }}>
          {activeEvent ? (
            <div className="bg-white rounded-xl px-3 py-2.5 border-2 border-blue-500 shadow-blue-200 shadow-xl opacity-95 rotate-[1.5deg] scale-[1.02] cursor-grabbing">
              <span style={{ background: (CATS[activeEvent.category] || CATS["その他"]).c + "18", color: (CATS[activeEvent.category] || CATS["その他"]).c }} className="inline-flex gap-1 text-[10px] font-bold rounded-full px-2 py-0.5">{(CATS[activeEvent.category] || CATS["その他"]).i} {activeEvent.category}</span>
              <p className="text-sm font-bold text-slate-900 mt-1">{activeEvent.title}</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      </div>
    </div>
  );
}

// ===== スポットプールビュー =====
function PoolView({ pool, onEdit, onDel, onAddToTimeline, onAddToRecommended, onAddSpot }: {
  pool: PoolSpot[]; onEdit: (id: string) => void; onDel: (id: string) => void; onAddToTimeline: (spot: PoolSpot) => void; onAddToRecommended?: (spot: PoolSpot) => void; onAddSpot?: () => void;
}) {
  const [geoLoading, setGeoLoading] = React.useState<string | null>(null);
  const { savePool } = useTabi();

  const handleGetCoord = async (spot: PoolSpot) => {
    if (spot.lat && spot.lng) return; // 既に座標がある場合はスキップ
    setGeoLoading(spot.id);
    try {
      const q = spot.location?.trim() || spot.name?.trim();
      if (!q) {
        showToast("場所名または住所を入力してください", "#ef4444");
        setGeoLoading(null);
        return;
      }
      const result = await geocodeByName(q);
      if (result) {
        savePool({
          ...spot,
          lat: result.lat,
          lng: result.lng,
        }, spot.id);
        showToast(`✓ ${spot.name}の座標を取得しました`, "#22c55e");
      } else {
        showToast(`✗ ${spot.name}の座標が見つかりませんでした`, "#ef4444");
      }
    } catch (err) {
      console.error("座標取得エラー:", err);
      showToast("座標取得に失敗しました", "#ef4444");
    } finally {
      setGeoLoading(null);
    }
  };

  const headerArea = (
    <div className="p-3 pb-0 flex flex-col gap-2 flex-shrink-0">
      <button
        onClick={onAddSpot}
        aria-label="スポットを追加"
        className="w-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl py-2.5 text-sm font-bold cursor-pointer hover:from-blue-600 hover:to-indigo-600 transition-all flex items-center justify-center gap-1.5"
      >
        ＋ スポット追加
      </button>
    </div>
  );

  return (
    <section aria-label="スポットプール" className="flex-1 overflow-hidden flex flex-col min-h-0">
      {headerArea}
      <div className="flex-1 overflow-y-auto p-3" style={{ WebkitOverflowScrolling: "touch" }}>
        <div className="flex gap-2 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 mb-3">
          <span className="text-lg">🎯</span>
          <div>
            <p className="font-bold text-sm mb-0.5">ふんわりスポットプール</p>
            <p className="text-[11px] text-slate-500">時間未定でOK。行きたいスポットをストックしておこう。「→タイムライン」ボタンで予定に追加できます</p>
          </div>
        </div>
        {!pool.length && (
          <div className="flex flex-col items-center gap-2.5 py-5 text-slate-400">
            <div className="text-4xl">🗺️</div>
            <p className="text-sm">スポットを追加してみよう</p>
          </div>
        )}
      {Object.entries(PCATS).map(([k, cfg]) => {
        const items = pool.filter(p => p.priority === k);
        if (!items.length) return null;
        return (
          <div key={k} className="mb-3.5">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span>{cfg.i}</span>
              <span style={{ color: cfg.c }} className="font-bold text-xs">{k}</span>
              <span className="text-[10px] text-slate-400 bg-slate-100 rounded-full px-1.5">{items.length}件</span>
            </div>
            {items.map(p => (
              <article key={p.id} className="bg-white rounded-xl px-3 py-2.5 mb-2 border border-slate-200 shadow-sm">
                <div className="flex justify-between items-center mb-1.5">
                  <span style={{ background: cfg.c + "18", color: cfg.c, borderColor: cfg.c + "40" }} className="inline-flex gap-1 text-[10px] font-bold rounded-full px-2 py-0.5 border">{cfg.i} {k}</span>
                  <div className="flex gap-0.5 items-center flex-wrap">
                    {!p.lat && !p.lng && (
                      <button
                        onClick={() => handleGetCoord(p)}
                        disabled={geoLoading === p.id}
                        aria-label={p.name + 'の座標を取得'}
                        className="bg-amber-50 border border-amber-200 rounded-md text-amber-600 cursor-pointer text-[10px] font-bold px-2 py-0.5 whitespace-nowrap hover:bg-amber-100 transition-colors disabled:opacity-50"
                      >
                        {geoLoading === p.id ? "⏳" : "📍"} 座標取得
                      </button>
                    )}
                    {onAddToRecommended && (
                      <button
                        onClick={() => onAddToRecommended(p)}
                        aria-label={p.name + 'をおすすめに追加'}
                        className="bg-amber-50 border border-amber-200 rounded-md text-amber-600 cursor-pointer text-[10px] font-bold px-2 py-0.5 whitespace-nowrap hover:bg-amber-100 transition-colors"
                      >
                        ⭐ おすすめ
                      </button>
                    )}
                    <button onClick={() => onAddToTimeline(p)} aria-label={p.name + 'をタイムラインに追加'} className="bg-blue-50 border border-blue-200 rounded-md text-blue-500 cursor-pointer text-[10px] font-bold px-2 py-0.5 whitespace-nowrap hover:bg-blue-100 transition-colors">→ タイムライン</button>
                    <button onClick={() => onEdit(p.id)} aria-label={p.name + 'を編集'} className="bg-transparent border-none cursor-pointer text-sm p-0.5 opacity-50 hover:opacity-100">✏️</button>
                    <button onClick={() => onDel(p.id)} aria-label={p.name + 'を削除'} className="bg-transparent border-none cursor-pointer text-sm p-0.5 opacity-50 hover:opacity-100">🗑️</button>
                  </div>
                </div>
                <h4 className="text-sm font-bold text-slate-900 mb-0.5">{p.name}</h4>
                {p.location && <p className="text-[11px] text-slate-400 mb-0.5">📍 {p.location}</p>}
                {p.memo && <p className="text-xs text-slate-500 leading-relaxed whitespace-pre-wrap mb-1">{p.memo}</p>}
                {p.url && <a href={p.url} target="_blank" rel="noreferrer" className="inline-block text-[11px] text-blue-500 no-underline font-semibold hover:underline">🔗 リンクを開く</a>}
              </article>
            ))}
          </div>
        );
      })}
      </div>
    </section>
  );
}

// ===== 地図: Googleマップリンク =====
function MapGmapsLink({ trip, mapMode, currentDid }: { trip: ReturnType<ReturnType<typeof useTabi>["trip"]>; mapMode: "all" | "day"; currentDid: string }) {
  if (!trip) return null;
  const daysToShow = mapMode === "all" ? trip.days : trip.days.filter(d => d.id === currentDid);
  const pts = daysToShow.flatMap(d => (d.events || []).filter(e => hasCoord(e)).map(e => ({ lat: parseFloat(e.lat!), lng: parseFloat(e.lng!) })));
  if (!pts.length) return null;
  const coords = pts.map(p => p.lat + "," + p.lng).join("/");
  const href = pts.length === 1 ? "https://www.google.com/maps?q=" + pts[0].lat + "," + pts[0].lng : "https://www.google.com/maps/dir/" + coords;
  return (
    <a href={href} target="_blank" rel="noreferrer" className="ml-auto text-[11px] text-blue-500 no-underline font-semibold whitespace-nowrap hover:underline">
      🗺️ Googleマップで開く
    </a>
  );
}
