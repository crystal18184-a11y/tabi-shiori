// 旅のしおり - データ型とLocalStorageストア

export const SK = "tabi_v8";
export const MAX_H = 30;
export const WJA = ["日", "月", "火", "水", "木", "金", "土"];
export const MAX_M = 10;
export const DC = [
  "#3b82f6","#f97316","#10b981","#8b5cf6","#ec4899",
  "#ef4444","#06b6d4","#84cc16","#f43f5e","#0ea5e9"
];

export interface TabiEvent {
  id: string;
  time: string;
  category: string;
  title: string;
  location: string;
  url: string;
  photo: string;
  /** 座標は任意。空文字列でなく undefined で「未設定」を表す */
  lat?: string;
  lng?: string;
  memo: string;
  reservationNo?: string;
  attachments?: string[];
}

export interface PoolSpot {
  id: string;
  name: string;
  priority: string;
  location: string;
  memo: string;
  url: string;
  lat?: string;
  lng?: string;
}

export interface TabiDay {
  id: string;
  date: string;
  name?: string;
  hotel?: string;
  hotelUrl?: string;
  hotelReservationNo?: string;
  pool: PoolSpot[];
  events: TabiEvent[];
}

export interface Member {
  id: string;
  name: string;
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  payerId: string;
  coveredMemberIds: string[];
}

export interface Memory {
  id: string;
  dayId?: string;
  eventId?: string;
  photoUrl: string;
  comment: string;
  createdAt: string;
  location?: string;
}

export interface Trip {
  id: string;
  name: string;
  destination: string;
  members: Member[];
  expenses: Expense[];
  days: TabiDay[];
  memories?: Memory[];
  status?: 'planning' | 'completed';
}

export interface AppState {
  trips: Trip[];
  tid: string | null;
  did: string | null;
}

export const uid = () => Math.random().toString(36).slice(2, 9);

export const dsub = (s: string) => {
  if (!s) return "";
  const [y, m, d] = s.split("-").map(Number);
  return `${m}/${d}(${WJA[new Date(y, m - 1, d).getDay()]})`;
};

export const duntil = (s: string | undefined) => {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  // ローカルタイムゾーンで生成（UTCパースによる1日ずれを防ぐ - バグ3修正）
  const t = new Date(y, m - 1, d);
  const n = new Date();
  n.setHours(0, 0, 0, 0);
  return Math.ceil((t.getTime() - n.getTime()) / 86400000);
};

/**
 * 座標が有効かどうかを判定する（バグ：空文字列の誤判定を修正）
 * 空文字列・undefined どちらも「座標なし」として扱う
 */
export function hasCoord(e: { lat?: string; lng?: string }): boolean {
  return !!(e.lat?.trim() && e.lng?.trim());
}

export const CATS: Record<string, { i: string; c: string }> = {
  移動: { i: "✈️", c: "#3b82f6" },
  食事: { i: "🍜", c: "#f97316" },
  観光: { i: "🏯", c: "#10b981" },
  宿泊: { i: "🏨", c: "#8b5cf6" },
  買物: { i: "🛍️", c: "#ec4899" },
  その他: { i: "📌", c: "#6b7280" },
};

export const PCATS: Record<string, { i: string; c: string }> = {
  絶対行く: { i: "⭐", c: "#f59e0b" },
  時間あれば: { i: "🕐", c: "#94a3b8" },
  候補: { i: "🤔", c: "#a78bfa" },
};

export function defTrip(startDate?: string): Trip {
  const d1 = uid(), d2 = uid(), d3 = uid();
  const base = startDate ? new Date(startDate) : new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return {
    id: uid(),
    name: "新しい旅行",
    destination: "",
    members: [],
    expenses: [],
    days: [
      { id: d1, date: fmt(base), pool: [], events: [] },
      { id: d2, date: fmt(new Date(base.getTime() + 86400000)), pool: [], events: [] },
      { id: d3, date: fmt(new Date(base.getTime() + 86400000 * 2)), pool: [], events: [] },
    ],
  };
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(SK);
    if (!raw) throw new Error("no data");
    const d = JSON.parse(raw);
    if (d?.trips?.length) {
      const trips = d.trips.map((t: Trip) => ({
        ...t,
        members: t.members || [],
        expenses: t.expenses || [],
      }));
      return { trips, tid: d.tid, did: d.did };
    }
  } catch (err) {
    if (err instanceof Error && err.message !== "no data") {
      console.warn("[store] loadState failed, using default:", err.message);
    }
  }
  const t = defTrip();
  return { trips: [t], tid: t.id, did: t.days[0].id };
}

export function saveState(state: AppState) {
  try {
    const serialized = JSON.stringify(state);
    // ⑧ LocalStorage容量対策: 写真データを除いたサイズをチェック
    const sizeKB = Math.round(serialized.length / 1024);
    if (sizeKB > 4500) {
      // 4.5MB超えたらbase64写真を除去して保存（S3 URLは保持）
      const stripped = JSON.stringify(state, (_key, value) => {
        if (typeof value === "string" && value.startsWith("data:image")) {
          return ""; // base64画像を除去（S3 URLへの移行を促す）
        }
        return value;
      });
      localStorage.setItem(SK, stripped);
      console.warn(`[store] State size was ${sizeKB}KB. Stripped base64 images to fit LocalStorage limit.`);
    } else {
      localStorage.setItem(SK, serialized);
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "QuotaExceededError") {
      console.error("[store] LocalStorage quota exceeded. Please export and clear old trips.", err);
    } else {
      console.error("[store] saveState failed:", err);
    }
  }
}

export function calcSettlements(members: Member[], expenses: Expense[]) {
  const bal: Record<string, number> = {};
  members.forEach(m => (bal[m.id] = 0));
  expenses.forEach(e => {
    const cov = e.coveredMemberIds || [];
    if (!cov.length) return;
    const pp = e.amount / cov.length;
    cov.forEach(mid => { if (bal[mid] !== undefined) bal[mid] -= pp; });
    if (bal[e.payerId] !== undefined) bal[e.payerId] += e.amount;
  });
  const pos = members.filter(m => bal[m.id] > 0.5).map(m => ({ ...m, b: bal[m.id] })).sort((a, b) => b.b - a.b);
  const neg = members.filter(m => bal[m.id] < -0.5).map(m => ({ ...m, b: bal[m.id] })).sort((a, b) => a.b - b.b);
  const res: { from: string; to: string; amount: number }[] = [];
  let pi = 0, ni = 0;
  while (pi < pos.length && ni < neg.length) {
    const p = pos[pi], n = neg[ni];
    const amt = Math.min(p.b, -n.b);
    if (amt > 0.5) res.push({ from: n.id, to: p.id, amount: Math.round(amt) });
    p.b -= amt; n.b += amt;
    if (Math.abs(p.b) < 0.5) pi++;
    if (Math.abs(n.b) < 0.5) ni++;
  }
  return res;
}
