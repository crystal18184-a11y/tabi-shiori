// 旅のしおり - アプリ全体のステート管理コンテキスト
import React, { createContext, useCallback, useContext, useState } from "react";
import {
  AppState, DC, Memory, PoolSpot, TabiDay, TabiEvent, Trip,
  defTrip, dsub, loadState, saveState, uid
} from "@/lib/store";
import { useDataPersistence } from "@/hooks/useDataPersistence";
import { useUndoHistory } from "@/hooks/useUndoHistory";

/** トースト通知（DOMに直接追加するシンプル実装） */
export function showToast(msg: string, color?: string) {
  const el = document.createElement("div");
  el.style.cssText = `position:fixed;bottom:16px;left:50%;transform:translateX(-50%);color:#fff;padding:8px 16px;border-radius:9px;font-size:12px;font-weight:700;z-index:9999;box-shadow:0 4px 14px rgba(0,0,0,.25);white-space:nowrap;pointer-events:none;transition:opacity .3s;background:${color || "#1e293b"};font-family:'Noto Sans JP',sans-serif`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 300);
  }, 2400);
}

interface TabiContextType {
  state: AppState;
  trip: () => Trip | undefined;
  day: () => TabiDay | undefined;
  snap: () => void;
  doUndo: () => void;
  canUndo: boolean;
  updateTripField: (k: keyof Trip, v: string) => void;
  addTrip: () => void;
  addTripWithPeriod: (name: string, destination: string, startDate: string, endDate: string) => void;
  selTrip: (id: string) => void;
  delTrip: (id: string) => void;
  addDay: () => void;
  selDay: (id: string) => void;
  delDay: (id: string) => void;
  changeDayDate: (v: string) => void;
  reorderDay: (fromIdx: number, toIdx: number) => void;
  sortDaysByDate: () => void;
  updateDayName: (dayId: string, name: string) => void;
  changeDayDateById: (dayId: string, date: string) => void;
  saveEvt: (data: Omit<TabiEvent, "id">, toDid: string, editId?: string) => void;
  delEvt: (dayId: string, eid: string) => void;
  reorderEvt: (dayId: string, fromIdx: number, toIdx: number) => void;
  moveEvtToDay: (evtId: string, fromDayId: string, toDayId: string) => void;
  savePool: (data: Omit<PoolSpot, "id">, editId?: string) => void;
  delPool: (pid: string) => void;
  addMember: (name: string) => string | null;
  delMember: (id: string) => void;
  addExpense: (title: string, amount: number, payerId: string, coveredIds: string[]) => void;
  delExpense: (id: string) => void;
  updateExpense: (id: string, data: { title: string; amount: number; payerId: string; coveredMemberIds: string[] }) => void;
  getDayColor: (dayId: string) => string;
  getDayIndex: (dayId: string) => number;
  toast: (msg: string, color?: string) => void;
  applyRemoteTrip: (trip: Trip) => void;
  clientId: string;
  addMemory: (data: Omit<Memory, "id" | "createdAt">) => void;
  delMemory: (memoryId: string) => void;
  toggleTripCompleted: () => void;
}

const TabiContext = createContext<TabiContextType | null>(null);

export function TabiProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(() => {
    try {
      const p = new URLSearchParams(location.search).get("plan");
      if (p) {
        const t = { ...JSON.parse(decodeURIComponent(atob(p))), id: uid() };
        if (!t.members) t.members = [];
        if (!t.expenses) t.expenses = [];
        const st: AppState = { trips: [t], tid: t.id, did: t.days[0]?.id };
        saveState(st);
        history.replaceState({}, "", location.pathname);
        return st;
      }
      const shareParam = new URLSearchParams(location.search).get("share");
      if (shareParam) {
        history.replaceState({}, "", location.pathname);
      }
    } catch (err) {
      console.warn("[TabiContext] URL plan parse failed:", err);
    }
    return loadState();
  });

  const toast = useCallback((msg: string, color?: string) => showToast(msg, color), []);

  // undoロジックを独立したフックに委譲（TabiContextから分離）
  const { canUndo, snap: snapHistory, doUndo } = useUndoHistory(setState, toast);

  const snap = useCallback(() => {
    setState((prev) => {
      snapHistory(prev);
      return prev;
    });
  }, [snapHistory]);

  const update = useCallback((fn: (prev: AppState) => AppState) => {
    setState(prev => {
      const next = fn(prev);
      saveState(next);
      return next;
    });
  }, []);

  const trip = useCallback(() => state.trips.find(t => t.id === state.tid), [state]);
  const day = useCallback(() => trip()?.days.find(d => d.id === state.did), [state, trip]);

  const getDayIndex = useCallback((dayId: string) => {
    return trip()?.days.findIndex(d => d.id === dayId) ?? 0;
  }, [trip]);

  const getDayColor = useCallback((dayId: string) => {
    const idx = getDayIndex(dayId);
    return DC[idx % DC.length];
  }, [getDayIndex]);

  const updateTripField = useCallback((k: keyof Trip, v: string) => {
    snap();
    update(prev => ({
      ...prev,
      trips: prev.trips.map(t => t.id === prev.tid ? { ...t, [k]: v } : t)
    }));
  }, [snap, update]);

  const addTrip = useCallback(() => {
    snap();
    const t = defTrip();
    t.name = "旅行プラン";
    update(prev => ({ ...prev, trips: [...prev.trips, t], tid: t.id, did: t.days[0].id }));
  }, [snap, update]);

  const addTripWithPeriod = useCallback((name: string, destination: string, startDate: string, endDate: string) => {
    snap();
    const s = new Date(startDate);
    const e = new Date(endDate);
    const numDays = Math.round((e.getTime() - s.getTime()) / 86400000) + 1;
    const days: TabiDay[] = Array.from({ length: numDays }, (_, i) => {
      const d = new Date(s.getTime() + i * 86400000);
      return { id: uid(), date: d.toISOString().slice(0, 10), pool: [], events: [] };
    });
    const t: Trip = { id: uid(), name: name || "新しい旅行", destination: destination || "", members: [], expenses: [], days };
    update(prev => ({ ...prev, trips: [...prev.trips, t], tid: t.id, did: t.days[0].id }));
  }, [snap, update]);

  const selTrip = useCallback((id: string) => {
    update(prev => {
      const t = prev.trips.find(x => x.id === id);
      return { ...prev, tid: id, did: t?.days[0]?.id || null };
    });
  }, [update]);

  const delTrip = useCallback((id: string) => {
    if (state.trips.length <= 1) { toast("最後の旅行は削除できません"); return; }
    snap();
    update(prev => {
      const trips = prev.trips.filter(t => t.id !== id);
      const tid = prev.tid === id ? trips[0].id : prev.tid;
      const did = prev.tid === id ? trips[0].days[0].id : prev.did;
      return { ...prev, trips, tid, did };
    });
  }, [state.trips.length, snap, update, toast]);

  const addDay = useCallback(() => {
    snap();
    const d: TabiDay = { id: uid(), date: "", pool: [], events: [] };
    update(prev => ({
      ...prev,
      trips: prev.trips.map(t => t.id === prev.tid ? { ...t, days: [...t.days, d] } : t),
      did: d.id
    }));
  }, [snap, update]);

  const selDay = useCallback((id: string) => {
    update(prev => ({ ...prev, did: id }));
  }, [update]);

  const delDay = useCallback((id: string) => {
    const t = trip();
    if (!t || t.days.length <= 1) { toast("最後の日程は削除できません"); return; }
    snap();
    update(prev => {
      const tr = prev.trips.find(x => x.id === prev.tid)!;
      const days = tr.days.filter(d => d.id !== id);
      const did = prev.did === id ? days[0].id : prev.did;
      return { ...prev, trips: prev.trips.map(t => t.id === prev.tid ? { ...t, days } : t), did };
    });
  }, [trip, snap, update, toast]);

  const changeDayDate = useCallback((v: string) => {
    snap();
    update(prev => ({
      ...prev,
      trips: prev.trips.map(t => t.id === prev.tid ? {
        ...t, days: t.days.map(d => d.id === prev.did ? { ...d, date: v } : d)
      } : t)
    }));
  }, [snap, update]);

  const reorderDay = useCallback((fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    snap();
    update(prev => ({
      ...prev,
      trips: prev.trips.map(t => {
        if (t.id !== prev.tid) return t;
        const days = [...t.days];
        const [moved] = days.splice(fromIdx, 1);
        days.splice(toIdx, 0, moved);
        return { ...t, days };
      })
    }));
  }, [snap, update]);

  const sortDaysByDate = useCallback(() => {
    snap();
    update(prev => ({
      ...prev,
      trips: prev.trips.map(t => {
        if (t.id !== prev.tid) return t;
        const days = [...t.days].sort((a, b) => {
          if (!a.date && !b.date) return 0;
          if (!a.date) return 1;
          if (!b.date) return -1;
          return a.date.localeCompare(b.date);
        });
        return { ...t, days };
      })
    }));
  }, [snap, update]);

  const updateDayName = useCallback((dayId: string, name: string) => {
    snap();
    update(prev => ({
      ...prev,
      trips: prev.trips.map(t => t.id !== prev.tid ? t : {
        ...t, days: t.days.map(d => d.id === dayId ? { ...d, name } : d)
      })
    }));
  }, [snap, update]);

  const changeDayDateById = useCallback((dayId: string, date: string) => {
    snap();
    update(prev => ({
      ...prev,
      trips: prev.trips.map(t => t.id !== prev.tid ? t : {
        ...t, days: t.days.map(d => d.id === dayId ? { ...d, date } : d)
      })
    }));
  }, [snap, update]);

  const saveEvt = useCallback((data: Omit<TabiEvent, "id">, toDid: string, editId?: string) => {
    snap();
    update(prev => ({
      ...prev,
      trips: prev.trips.map(t => {
        if (t.id !== prev.tid) return t;
        let days = t.days.map(d => ({ ...d, events: d.events.filter(e => e.id !== editId) }));
        days = days.map(d => {
          if (d.id !== toDid) return d;
          const events = [...d.events, { ...data, id: editId || uid() }]
            .sort((a, b) => a.time.localeCompare(b.time));
          return { ...d, events };
        });
        return { ...t, days };
      })
    }));
  }, [snap, update]);

  const delEvt = useCallback((dayId: string, eid: string) => {
    snap();
    update(prev => ({
      ...prev,
      trips: prev.trips.map(t => t.id !== prev.tid ? t : {
        ...t, days: t.days.map(d => d.id !== dayId ? d : { ...d, events: d.events.filter(e => e.id !== eid) })
      })
    }));
  }, [snap, update]);

  const moveEvtToDay = useCallback((evtId: string, fromDayId: string, toDayId: string) => {
    if (fromDayId === toDayId) return;
    snap();
    update(prev => {
      const currentTrip = prev.trips.find(t => t.id === prev.tid);
      if (!currentTrip) return prev;
      const evt = currentTrip.days.find(d => d.id === fromDayId)?.events.find(e => e.id === evtId);
      if (!evt) return prev;
      return {
        ...prev,
        trips: prev.trips.map(t => t.id !== prev.tid ? t : {
          ...t,
          days: t.days.map(d => {
            if (d.id === fromDayId) return { ...d, events: d.events.filter(e => e.id !== evtId) };
            if (d.id === toDayId) return { ...d, events: [...d.events, evt] };
            return d;
          })
        })
      };
    });
  }, [snap, update]);

  const reorderEvt = useCallback((dayId: string, fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;
    snap();
    update(prev => ({
      ...prev,
      trips: prev.trips.map(t => t.id !== prev.tid ? t : {
        ...t,
        days: t.days.map(d => {
          if (d.id !== dayId) return d;
          const events = [...d.events];
          const [moved] = events.splice(fromIdx, 1);
          events.splice(toIdx, 0, moved);
          return { ...d, events };
        })
      })
    }));
  }, [snap, update]);

  const savePool = useCallback((data: Omit<PoolSpot, "id">, editId?: string) => {
    snap();
    update(prev => ({
      ...prev,
      trips: prev.trips.map(t => t.id !== prev.tid ? t : {
        ...t,
        days: t.days.map(d => {
          if (d.id !== prev.did) return d;
          const pool = editId
            ? d.pool.map(p => p.id === editId ? { ...data, id: p.id } : p)
            : [...d.pool, { ...data, id: uid() }];
          return { ...d, pool };
        })
      })
    }));
  }, [snap, update]);

  const delPool = useCallback((pid: string) => {
    snap();
    update(prev => ({
      ...prev,
      trips: prev.trips.map(t => t.id !== prev.tid ? t : {
        ...t, days: t.days.map(d => d.id !== prev.did ? d : { ...d, pool: d.pool.filter(p => p.id !== pid) })
      })
    }));
  }, [snap, update]);

  const addMember = useCallback((name: string): string | null => {
    const t = trip();
    if (!t) return "旅行が選択されていません";
    if ((t.members || []).length >= 20) return "メンバーは最大20人まです";
    if ((t.members || []).find(m => m.name === name)) return "同じ名前が既にあります";
    snap();
    update(prev => ({
      ...prev,
      trips: prev.trips.map(t => t.id !== prev.tid ? t : {
        ...t, members: [...(t.members || []), { id: uid(), name }]
      })
    }));
    return null;
  }, [trip, snap, update]);

  const delMember = useCallback((id: string) => {
    snap();
    update(prev => ({
      ...prev,
      trips: prev.trips.map(t => t.id !== prev.tid ? t : {
        ...t,
        members: (t.members || []).filter(m => m.id !== id),
        expenses: (t.expenses || []).map(e => ({
          ...e,
          coveredMemberIds: (e.coveredMemberIds || []).filter(mid => mid !== id),
          payerId: e.payerId === id ? "" : e.payerId
        }))
      })
    }));
  }, [snap, update]);

  const addExpense = useCallback((title: string, amount: number, payerId: string, coveredIds: string[]) => {
    snap();
    update(prev => ({
      ...prev,
      trips: prev.trips.map(t => t.id !== prev.tid ? t : {
        ...t, expenses: [...(t.expenses || []), { id: uid(), title, amount, payerId, coveredMemberIds: coveredIds }]
      })
    }));
  }, [snap, update]);

  const delExpense = useCallback((id: string) => {
    snap();
    update(prev => ({
      ...prev,
      trips: prev.trips.map(t => t.id !== prev.tid ? t : {
        ...t, expenses: (t.expenses || []).filter(e => e.id !== id)
      })
    }));
  }, [snap, update]);

  const updateExpense = useCallback((id: string, data: { title: string; amount: number; payerId: string; coveredMemberIds: string[] }) => {
    snap();
    update(prev => ({
      ...prev,
      trips: prev.trips.map(t => t.id !== prev.tid ? t : {
        ...t, expenses: (t.expenses || []).map(e => e.id !== id ? e : { ...e, ...data })
      })
    }));
  }, [snap, update]);

  const addMemory = useCallback((data: Omit<Memory, "id" | "createdAt">) => {
    snap();
    update(prev => ({
      ...prev,
      trips: prev.trips.map(t => t.id !== prev.tid ? t : {
        ...t, memories: [...(t.memories || []), { ...data, id: uid(), createdAt: new Date().toISOString() }]
      })
    }));
  }, [snap, update]);

  const delMemory = useCallback((memoryId: string) => {
    snap();
    update(prev => ({
      ...prev,
      trips: prev.trips.map(t => t.id !== prev.tid ? t : {
        ...t, memories: (t.memories || []).filter(m => m.id !== memoryId)
      })
    }));
  }, [snap, update]);

  const toggleTripCompleted = useCallback(() => {
    update(prev => ({
      ...prev,
      trips: prev.trips.map(t => t.id !== prev.tid ? t : {
        ...t, status: t.status === 'completed' ? 'planning' : 'completed'
      })
    }));
  }, [update]);

  const applyRemoteTrip = useCallback((remoteTrip: Trip) => {
    update(prev => {
      const trips = prev.trips.map(t => t.id === prev.tid ? { ...remoteTrip, id: t.id } : t);
      const updatedTrip = trips.find(t => t.id === prev.tid);
      const did = updatedTrip?.days.find(d => d.id === prev.did) ? prev.did : updatedTrip?.days[0]?.id || null;
      return { ...prev, trips, did };
    });
    toast("🔄 共有プランが更新されました", "#10b981");
  }, [update, toast]);

  const handleDbLoaded = useCallback((dbState: AppState) => {
    setState(dbState);
    saveState(dbState);
  }, []);
  const { clientId } = useDataPersistence(state, handleDbLoaded);

  return (
    <TabiContext.Provider value={{
      state, trip, day, snap, doUndo, canUndo,
      updateTripField, addTrip, addTripWithPeriod, selTrip, delTrip,
      addDay, selDay, delDay, changeDayDate,
      reorderDay, sortDaysByDate, updateDayName, changeDayDateById,
      saveEvt, delEvt, reorderEvt, moveEvtToDay, savePool, delPool,
      addMember, delMember, addExpense, delExpense, updateExpense,
      getDayColor, getDayIndex, toast, applyRemoteTrip, clientId,
      addMemory, delMemory, toggleTripCompleted
    }}>
      {children}
    </TabiContext.Provider>
  );
}

export function useTabi() {
  const ctx = useContext(TabiContext);
  if (!ctx) throw new Error("useTabi must be used within TabiProvider");
  return ctx;
}

export { dsub, DC, CATS, PCATS, duntil } from "@/lib/store";
export { calcSettlements } from "@/lib/store";
