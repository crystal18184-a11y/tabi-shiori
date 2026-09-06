// 割り勘ビュー（Tailwind CSS化・アクセシビリティ対応済み・多通貨対応）
import React from "react";
import type { Trip, Currency } from "@/lib/store";
import { formatCurrency, toJpy } from "@/lib/store";

const CURRENCIES: Currency[] = ["JPY", "USD", "EUR"];

interface Props {
  trip: Trip | null;
  wkMemberName: string; setWkMemberName: (v: string) => void;
  wkExpTitle: string; setWkExpTitle: (v: string) => void;
  wkExpAmount: string; setWkExpAmount: (v: string) => void;
  wkExpPayer: string; setWkExpPayer: (v: string) => void;
  wkExpCovered: string[]; setWkExpCovered: (v: string[]) => void;
  wkExpCurrency: Currency; setWkExpCurrency: (v: Currency) => void;
  onAddMember: () => void;
  onDelMember: (id: string) => void;
  onAddExpense: () => void;
  onDelExpense: (id: string) => void;
  onUpdateExpense: (id: string, data: { title: string; amount: number; currency?: Currency; payerId: string; coveredMemberIds: string[] }) => void;
  onUpdateExchangeRates: (rates: { USD?: number; EUR?: number }) => void;
}

function calcSettlements(
  members: { id: string; name: string }[],
  expenses: { id: string; amount: number; currency?: Currency; payerId: string; coveredMemberIds: string[] }[],
  exchangeRates?: { USD?: number; EUR?: number }
) {
  const bal: Record<string, number> = {};
  members.forEach(m => (bal[m.id] = 0));
  expenses.forEach(e => {
    const cov = e.coveredMemberIds || [];
    if (!cov.length) return;
    const amountJpy = toJpy(e.amount, e.currency, exchangeRates);
    const pp = amountJpy / cov.length;
    cov.forEach(mid => { if (bal[mid] !== undefined) bal[mid] -= pp; });
    if (bal[e.payerId] !== undefined) bal[e.payerId] += amountJpy;
  });
  const pos = members.filter(m => bal[m.id] > 0.5).map(m => ({ ...m, b: bal[m.id] })).sort((a, b) => b.b - a.b);
  const neg = members.filter(m => bal[m.id] < -0.5).map(m => ({ ...m, b: bal[m.id] })).sort((a, b) => a.b - b.b);
  const res: { from: string; fromName: string; to: string; toName: string; amount: number }[] = [];
  let pi = 0, ni = 0;
  while (pi < pos.length && ni < neg.length) {
    const p = pos[pi], n = neg[ni];
    const amt = Math.min(p.b, -n.b);
    if (amt > 0.5) res.push({ from: n.id, fromName: n.name, to: p.id, toName: p.name, amount: Math.round(amt) });
    p.b -= amt; n.b += amt;
    if (Math.abs(p.b) < 0.5) pi++;
    if (Math.abs(n.b) < 0.5) ni++;
  }
  return res;
}

export default function WarikanView({
  trip, wkMemberName, setWkMemberName, wkExpTitle, setWkExpTitle,
  wkExpAmount, setWkExpAmount, wkExpPayer, setWkExpPayer,
  wkExpCovered, setWkExpCovered, wkExpCurrency, setWkExpCurrency,
  onAddMember, onDelMember, onAddExpense, onDelExpense, onUpdateExpense, onUpdateExchangeRates,
}: Props) {
  const members = trip?.members || [];
  const expenses = trip?.expenses || [];
  const exchangeRates = trip?.exchangeRates;
  const settlements = members.length >= 2 ? calcSettlements(members, expenses, exchangeRates) : [];
  const totalJpy = expenses.reduce((s, e) => s + toJpy(e.amount, e.currency, exchangeRates), 0);

  // レート入力欄の一時状態（未編集時はtripの値を表示）
  const [rateUsdInput, setRateUsdInput] = React.useState(String(exchangeRates?.USD ?? ""));
  const [rateEurInput, setRateEurInput] = React.useState(String(exchangeRates?.EUR ?? ""));
  React.useEffect(() => { setRateUsdInput(String(exchangeRates?.USD ?? "")); }, [exchangeRates?.USD]);
  React.useEffect(() => { setRateEurInput(String(exchangeRates?.EUR ?? "")); }, [exchangeRates?.EUR]);

  function saveRate(currency: "USD" | "EUR", value: string) {
    const n = parseFloat(value);
    onUpdateExchangeRates({ [currency]: isNaN(n) || n <= 0 ? undefined : n });
  }

  // 編集モーダル状態
  const [editingExpId, setEditingExpId] = React.useState<string | null>(null);
  const [editTitle, setEditTitle] = React.useState("");
  const [editAmount, setEditAmount] = React.useState("");
  const [editCurrency, setEditCurrency] = React.useState<Currency>("JPY");
  const [editPayer, setEditPayer] = React.useState("");
  const [editCovered, setEditCovered] = React.useState<string[]>([]);

  function startEditExp(e: { id: string; title: string; amount: number; currency?: Currency; payerId: string; coveredMemberIds: string[] }) {
    setEditingExpId(e.id);
    setEditTitle(e.title);
    setEditAmount(String(e.amount));
    setEditCurrency(e.currency || "JPY");
    setEditPayer(e.payerId);
    setEditCovered(e.coveredMemberIds || []);
  }

  function saveEditExp() {
    if (!editingExpId) return;
    const amount = parseFloat(editAmount);
    if (!editTitle.trim() || isNaN(amount) || amount <= 0) { alert("内容と金額を入力してください"); return; }
    if (!editCovered.length) { alert("誰の分か選んでください"); return; }
    if (editCurrency !== "JPY" && !exchangeRates?.[editCurrency]) { alert(`先に「${editCurrency}のレート」を設定してください`); return; }
    onUpdateExpense(editingExpId, { title: editTitle.trim(), amount, currency: editCurrency, payerId: editPayer, coveredMemberIds: editCovered });
    setEditingExpId(null);
  }

  return (
    <section aria-label="割り勘" className="flex-1 overflow-y-auto p-3 flex flex-col gap-4">
      {/* メンバー管理 */}
      <div className="bg-m3-surface rounded-2xl border border-m3-outline-variant m3-elevation-1 p-3">
        <h3 className="text-xs font-bold text-m3-on-surface-variant uppercase tracking-wider mb-2">👥 メンバー</h3>
        <div className="flex gap-1.5 mb-2">
          <input
            id="member-name-input"
            value={wkMemberName}
            onChange={e => setWkMemberName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && onAddMember()}
            placeholder="名前を入力"
            aria-label="メンバーの名前"
            className="flex-1 bg-m3-surface-variant border border-m3-outline-variant rounded-lg text-sm px-2.5 py-2 outline-none focus:border-m3-primary transition-colors"
          />
          <button
            onClick={onAddMember}
            aria-label="メンバーを追加"
            className="bg-m3-primary text-m3-on-primary border-none rounded-full px-4 py-2 text-xs font-bold cursor-pointer hover:opacity-90 transition-opacity"
          >追加</button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {members.map(m => (
            <div key={m.id} className="inline-flex items-center gap-1 bg-m3-primary-container border border-transparent rounded-full px-2.5 py-1 text-xs font-semibold text-m3-on-primary-container">
              {m.name}
              <button
                onClick={() => onDelMember(m.id)}
                aria-label={`${m.name}を削除`}
                className="bg-transparent border-none text-m3-on-primary-container/70 cursor-pointer text-xs ml-0.5 hover:text-red-500 transition-colors"
              >×</button>
            </div>
          ))}
          {!members.length && <p className="text-xs text-m3-on-surface-variant">まだメンバーがいません</p>}
        </div>
      </div>

      {/* レート設定 */}
      <div className="bg-m3-surface rounded-2xl border border-m3-outline-variant m3-elevation-1 p-3">
        <h3 className="text-xs font-bold text-m3-on-surface-variant uppercase tracking-wider mb-2">💱 為替レート設定</h3>
        <p className="text-[10px] text-m3-on-surface-variant mb-2">USD・EURの支出を円換算するためのレートです。最新レートはご自身でご確認の上、手入力してください。</p>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-m3-on-surface-variant w-24 shrink-0">1 USD =</span>
            <input
              type="number" min="0" step="0.01"
              value={rateUsdInput}
              onChange={e => setRateUsdInput(e.target.value)}
              onBlur={e => saveRate("USD", e.target.value)}
              placeholder="例: 150"
              aria-label="USDレート（1USDあたりの円）"
              className="flex-1 bg-m3-surface-variant border border-m3-outline-variant rounded-lg text-sm px-2.5 py-1.5 outline-none focus:border-m3-primary transition-colors"
            />
            <span className="text-xs text-m3-on-surface-variant">円</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-m3-on-surface-variant w-24 shrink-0">1 EUR =</span>
            <input
              type="number" min="0" step="0.01"
              value={rateEurInput}
              onChange={e => setRateEurInput(e.target.value)}
              onBlur={e => saveRate("EUR", e.target.value)}
              placeholder="例: 160"
              aria-label="EURレート（1EURあたりの円）"
              className="flex-1 bg-m3-surface-variant border border-m3-outline-variant rounded-lg text-sm px-2.5 py-1.5 outline-none focus:border-m3-primary transition-colors"
            />
            <span className="text-xs text-m3-on-surface-variant">円</span>
          </div>
        </div>
      </div>

      {/* 支出追加 */}
      {members.length >= 2 && (
        <div className="bg-m3-surface rounded-2xl border border-m3-outline-variant m3-elevation-1 p-3">
          <h3 className="text-xs font-bold text-m3-on-surface-variant uppercase tracking-wider mb-2">💸 支出を追加</h3>
          <div className="flex flex-col gap-2">
            <input
              value={wkExpTitle}
              onChange={e => setWkExpTitle(e.target.value)}
              placeholder="内容（例：夕食、タクシー）"
              aria-label="支出の内容"
              className="bg-m3-surface-variant border border-m3-outline-variant rounded-lg text-sm px-2.5 py-2 outline-none w-full box-border focus:border-m3-primary transition-colors"
            />
            <div className="flex gap-2">
              <input
                type="number"
                value={wkExpAmount}
                onChange={e => setWkExpAmount(e.target.value)}
                placeholder="金額"
                aria-label="金額"
                min="0"
                className="flex-1 bg-m3-surface-variant border border-m3-outline-variant rounded-lg text-sm px-2.5 py-2 outline-none w-full box-border focus:border-m3-primary transition-colors"
              />
              <select
                value={wkExpCurrency}
                onChange={e => setWkExpCurrency(e.target.value as Currency)}
                aria-label="通貨を選択"
                className="bg-m3-surface-variant border border-m3-outline-variant rounded-lg text-sm px-2 py-2 outline-none cursor-pointer focus:border-m3-primary transition-colors"
              >
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-m3-on-surface-variant block mb-1">支払者</label>
              <select
                value={wkExpPayer}
                onChange={e => setWkExpPayer(e.target.value)}
                aria-label="支払者を選択"
                className="bg-m3-surface-variant border border-m3-outline-variant rounded-lg text-sm px-2.5 py-2 outline-none w-full box-border cursor-pointer focus:border-m3-primary transition-colors"
              >
                <option value="">選択してください</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-m3-on-surface-variant block mb-1">誰の分？（複数選択可）</label>
              <div className="flex flex-wrap gap-1.5">
                {members.map(m => (
                  <label key={m.id} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold cursor-pointer border transition-colors ${wkExpCovered.includes(m.id) ? "bg-m3-primary-container text-m3-on-primary-container border-transparent" : "bg-m3-surface-variant text-m3-on-surface-variant border-m3-outline-variant hover:border-m3-outline"}`}>
                    <input
                      type="checkbox"
                      checked={wkExpCovered.includes(m.id)}
                      onChange={e => setWkExpCovered(e.target.checked ? [...wkExpCovered, m.id] : wkExpCovered.filter(id => id !== m.id))}
                      className="sr-only"
                    />
                    {m.name}
                  </label>
                ))}
              </div>
            </div>
            <button
              onClick={onAddExpense}
              className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-none rounded-full py-2 text-sm font-bold cursor-pointer hover:from-blue-600 hover:to-indigo-600 transition-all"
            >＋ 支出を記録</button>
          </div>
        </div>
      )}

      {/* 支出一覧 */}
      {expenses.length > 0 && (
        <div className="bg-m3-surface rounded-2xl border border-m3-outline-variant m3-elevation-1 p-3">
          <h3 className="text-xs font-bold text-m3-on-surface-variant uppercase tracking-wider mb-2">📋 支出一覧</h3>
          <div className="flex flex-col gap-2 mb-2">
            {expenses.map(e => {
              const payer = members.find(m => m.id === e.payerId);
              const covered = members.filter(m => e.coveredMemberIds?.includes(m.id));
              const currency = e.currency || "JPY";
              const jpy = toJpy(e.amount, currency, exchangeRates);
              return (
                <div key={e.id} className="flex items-center gap-2 py-1.5 border-b border-m3-outline-variant last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-m3-on-surface truncate">{e.title}</div>
                    <div className="text-[10px] text-m3-on-surface-variant">
                      {payer?.name}が支払い・{covered.map(m => m.name).join("・")}の分
                    </div>
                  </div>
                  <div className="text-right whitespace-nowrap">
                    <div className="text-sm font-bold text-m3-on-surface">{formatCurrency(e.amount, currency)}</div>
                    {currency !== "JPY" && <div className="text-[10px] text-m3-on-surface-variant">≈ {formatCurrency(jpy, "JPY")}</div>}
                  </div>
                  <button
                    onClick={() => startEditExp(e)}
                    aria-label={`${e.title}を編集`}
                    className="w-6 h-6 flex items-center justify-center bg-transparent border-none cursor-pointer text-sm m3-icon-btn"
                  >✏️</button>
                  <button
                    onClick={() => onDelExpense(e.id)}
                    aria-label={`${e.title}を削除`}
                    className="w-6 h-6 flex items-center justify-center bg-transparent border-none cursor-pointer text-sm m3-icon-btn"
                  >🗑️</button>
                </div>
              );
            })}
          </div>
          <div className="text-right text-sm font-bold text-m3-on-surface">
            合計: {formatCurrency(totalJpy, "JPY")}
          </div>
        </div>
      )}

      {/* 支出編集モーダル */}
      {editingExpId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[400] p-3" onClick={e => e.target === e.currentTarget && setEditingExpId(null)}>
          <div className="bg-m3-surface rounded-3xl w-full max-w-sm m3-elevation-2 flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center px-4 py-3 border-b border-m3-outline-variant">
              <h3 className="font-bold text-sm text-m3-on-surface">支出を編集</h3>
              <button onClick={() => setEditingExpId(null)} className="text-m3-on-surface-variant hover:text-m3-on-surface text-lg font-bold bg-transparent border-none cursor-pointer">×</button>
            </div>
            <div className="p-4 flex flex-col gap-3">
              <div>
                <label className="text-[10px] font-bold text-m3-on-surface-variant uppercase tracking-wider block mb-1">内容</label>
                <input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="例：夕食" className="w-full bg-m3-surface-variant border border-m3-outline-variant rounded-lg text-sm px-2.5 py-2 outline-none focus:border-m3-primary transition-colors" />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="text-[10px] font-bold text-m3-on-surface-variant uppercase tracking-wider block mb-1">金額</label>
                  <input type="number" value={editAmount} onChange={e => setEditAmount(e.target.value)} placeholder="金額" min="0" className="w-full bg-m3-surface-variant border border-m3-outline-variant rounded-lg text-sm px-2.5 py-2 outline-none focus:border-m3-primary transition-colors" />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-m3-on-surface-variant uppercase tracking-wider block mb-1">通貨</label>
                  <select value={editCurrency} onChange={e => setEditCurrency(e.target.value as Currency)} className="bg-m3-surface-variant border border-m3-outline-variant rounded-lg text-sm px-2 py-2 outline-none cursor-pointer focus:border-m3-primary transition-colors">
                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-m3-on-surface-variant uppercase tracking-wider block mb-1">支払者</label>
                <select value={editPayer} onChange={e => setEditPayer(e.target.value)} className="w-full bg-m3-surface-variant border border-m3-outline-variant rounded-lg text-sm px-2.5 py-2 outline-none cursor-pointer focus:border-m3-primary transition-colors">
                  <option value="">選択してください</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-m3-on-surface-variant uppercase tracking-wider block mb-1">誰の分？</label>
                <div className="flex flex-wrap gap-1.5">
                  {members.map(m => (
                    <label key={m.id} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold cursor-pointer border transition-colors ${editCovered.includes(m.id) ? "bg-m3-primary-container text-m3-on-primary-container border-transparent" : "bg-m3-surface-variant text-m3-on-surface-variant border-m3-outline-variant hover:border-m3-outline"}`}>
                      <input type="checkbox" checked={editCovered.includes(m.id)} onChange={ev => setEditCovered(ev.target.checked ? [...editCovered, m.id] : editCovered.filter(id => id !== m.id))} className="sr-only" />
                      {m.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 px-4 pb-4 justify-end">
              <button onClick={() => setEditingExpId(null)} className="bg-m3-surface-variant border-none rounded-full text-m3-on-surface-variant px-3 py-1.5 text-xs cursor-pointer hover:opacity-80 transition-opacity">キャンセル</button>
              <button onClick={saveEditExp} className="bg-gradient-to-r from-blue-500 to-indigo-500 border-none rounded-full text-white px-4 py-1.5 text-xs font-bold cursor-pointer hover:from-blue-600 hover:to-indigo-600 transition-all">保存する</button>
            </div>
          </div>
        </div>
      )}

      {/* 精算結果 */}
      {settlements.length > 0 && (
        <div className="bg-green-50 rounded-2xl border border-green-200 shadow-sm p-3">
          <h3 className="text-xs font-bold text-green-800 uppercase tracking-wider mb-2">✅ 精算結果</h3>
          <div className="flex flex-col gap-2">
            {settlements.map((s, i) => (
              <div key={i} className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-green-100">
                <span className="text-sm font-bold text-slate-700">{s.fromName}</span>
                <span className="text-slate-400">→</span>
                <span className="text-sm font-bold text-slate-700">{s.toName}</span>
                <span className="ml-auto text-sm font-extrabold text-green-700">{formatCurrency(s.amount, "JPY")}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {members.length >= 2 && expenses.length > 0 && settlements.length === 0 && (
        <div className="bg-green-50 rounded-2xl border border-green-200 p-3 text-center text-sm font-semibold text-green-700">
          🎉 精算不要！みんな均等です
        </div>
      )}
    </section>
  );
}
