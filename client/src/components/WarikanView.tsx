// 割り勘ビュー（Tailwind CSS化・アクセシビリティ対応済み）
import React from "react";
import type { Trip } from "@/lib/store";

interface Props {
  trip: Trip | null;
  wkMemberName: string; setWkMemberName: (v: string) => void;
  wkExpTitle: string; setWkExpTitle: (v: string) => void;
  wkExpAmount: string; setWkExpAmount: (v: string) => void;
  wkExpPayer: string; setWkExpPayer: (v: string) => void;
  wkExpCovered: string[]; setWkExpCovered: (v: string[]) => void;
  onAddMember: () => void;
  onDelMember: (id: string) => void;
  onAddExpense: () => void;
  onDelExpense: (id: string) => void;
  onUpdateExpense: (id: string, data: { title: string; amount: number; payerId: string; coveredMemberIds: string[] }) => void;
}

function calcSettlements(members: { id: string; name: string }[], expenses: { id: string; amount: number; payerId: string; coveredMemberIds: string[] }[]) {
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
  wkExpCovered, setWkExpCovered, onAddMember, onDelMember, onAddExpense, onDelExpense, onUpdateExpense,
}: Props) {
  const members = trip?.members || [];
  const expenses = trip?.expenses || [];
  const settlements = members.length >= 2 ? calcSettlements(members, expenses) : [];
  const total = expenses.reduce((s, e) => s + e.amount, 0);

  // 編集モーダル状態
  const [editingExpId, setEditingExpId] = React.useState<string | null>(null);
  const [editTitle, setEditTitle] = React.useState("");
  const [editAmount, setEditAmount] = React.useState("");
  const [editPayer, setEditPayer] = React.useState("");
  const [editCovered, setEditCovered] = React.useState<string[]>([]);

  function startEditExp(e: { id: string; title: string; amount: number; payerId: string; coveredMemberIds: string[] }) {
    setEditingExpId(e.id);
    setEditTitle(e.title);
    setEditAmount(String(e.amount));
    setEditPayer(e.payerId);
    setEditCovered(e.coveredMemberIds || []);
  }

  function saveEditExp() {
    if (!editingExpId) return;
    const amount = parseFloat(editAmount);
    if (!editTitle.trim() || isNaN(amount) || amount <= 0) { alert("内容と金額を入力してください"); return; }
    if (!editCovered.length) { alert("誰の分か選んでください"); return; }
    onUpdateExpense(editingExpId, { title: editTitle.trim(), amount, payerId: editPayer, coveredMemberIds: editCovered });
    setEditingExpId(null);
  }

  return (
    <section aria-label="割り勘" className="flex-1 overflow-y-auto p-3 flex flex-col gap-4">
      {/* メンバー管理 */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">👥 メンバー</h3>
        <div className="flex gap-1.5 mb-2">
          <input
            id="member-name-input"
            value={wkMemberName}
            onChange={e => setWkMemberName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && onAddMember()}
            placeholder="名前を入力"
            aria-label="メンバーの名前"
            className="flex-1 bg-slate-50 border border-slate-200 rounded-lg text-sm px-2.5 py-2 outline-none focus:border-blue-300 transition-colors"
          />
          <button
            onClick={onAddMember}
            aria-label="メンバーを追加"
            className="bg-slate-900 text-white border-none rounded-lg px-3 py-2 text-xs font-bold cursor-pointer hover:bg-slate-700 transition-colors"
          >追加</button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {members.map(m => (
            <div key={m.id} className="inline-flex items-center gap-1 bg-blue-50 border border-blue-200 rounded-full px-2.5 py-1 text-xs font-semibold text-blue-800">
              {m.name}
              <button
                onClick={() => onDelMember(m.id)}
                aria-label={`${m.name}を削除`}
                className="bg-transparent border-none text-blue-400 cursor-pointer text-xs ml-0.5 hover:text-red-500 transition-colors"
              >×</button>
            </div>
          ))}
          {!members.length && <p className="text-xs text-slate-400">まだメンバーがいません</p>}
        </div>
      </div>

      {/* 支出追加 */}
      {members.length >= 2 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">💸 支出を追加</h3>
          <div className="flex flex-col gap-2">
            <input
              value={wkExpTitle}
              onChange={e => setWkExpTitle(e.target.value)}
              placeholder="内容（例：夕食、タクシー）"
              aria-label="支出の内容"
              className="bg-slate-50 border border-slate-200 rounded-lg text-sm px-2.5 py-2 outline-none w-full box-border focus:border-blue-300 transition-colors"
            />
            <input
              type="number"
              value={wkExpAmount}
              onChange={e => setWkExpAmount(e.target.value)}
              placeholder="金額（円）"
              aria-label="金額"
              min="0"
              className="bg-slate-50 border border-slate-200 rounded-lg text-sm px-2.5 py-2 outline-none w-full box-border focus:border-blue-300 transition-colors"
            />
            <div>
              <label className="text-[11px] font-bold text-slate-500 block mb-1">支払者</label>
              <select
                value={wkExpPayer}
                onChange={e => setWkExpPayer(e.target.value)}
                aria-label="支払者を選択"
                className="bg-slate-50 border border-slate-200 rounded-lg text-sm px-2.5 py-2 outline-none w-full box-border cursor-pointer focus:border-blue-300 transition-colors"
              >
                <option value="">選択してください</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-500 block mb-1">誰の分？（複数選択可）</label>
              <div className="flex flex-wrap gap-1.5">
                {members.map(m => (
                  <label key={m.id} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold cursor-pointer border transition-colors ${wkExpCovered.includes(m.id) ? "bg-indigo-500 text-white border-indigo-500" : "bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300"}`}>
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
              className="bg-gradient-to-r from-blue-500 to-indigo-500 text-white border-none rounded-lg py-2 text-sm font-bold cursor-pointer hover:from-blue-600 hover:to-indigo-600 transition-all"
            >＋ 支出を記録</button>
          </div>
        </div>
      )}

      {/* 支出一覧 */}
      {expenses.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">📋 支出一覧</h3>
          <div className="flex flex-col gap-2 mb-2">
            {expenses.map(e => {
              const payer = members.find(m => m.id === e.payerId);
              const covered = members.filter(m => e.coveredMemberIds?.includes(m.id));
              return (
                <div key={e.id} className="flex items-center gap-2 py-1.5 border-b border-slate-100 last:border-0">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">{e.title}</div>
                    <div className="text-[10px] text-slate-400">
                      {payer?.name}が支払い・{covered.map(m => m.name).join("・")}の分
                    </div>
                  </div>
                  <span className="text-sm font-bold text-slate-900 whitespace-nowrap">¥{e.amount.toLocaleString()}</span>
                  <button
                    onClick={() => startEditExp(e)}
                    aria-label={`${e.title}を編集`}
                    className="bg-transparent border-none text-slate-300 cursor-pointer text-sm hover:text-blue-400 transition-colors"
                  >✏️</button>
                  <button
                    onClick={() => onDelExpense(e.id)}
                    aria-label={`${e.title}を削除`}
                    className="bg-transparent border-none text-slate-300 cursor-pointer text-sm hover:text-red-400 transition-colors"
                  >🗑️</button>
                </div>
              );
            })}
          </div>
          <div className="text-right text-sm font-bold text-slate-700">
            合計: ¥{total.toLocaleString()}
          </div>
        </div>
      )}

      {/* 支出編集モーダル */}
      {editingExpId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[400] p-3" onClick={e => e.target === e.currentTarget && setEditingExpId(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center px-4 py-3 border-b border-slate-100">
              <h3 className="font-bold text-sm text-slate-900">支出を編集</h3>
              <button onClick={() => setEditingExpId(null)} className="text-slate-400 hover:text-slate-600 text-lg font-bold bg-transparent border-none cursor-pointer">×</button>
            </div>
            <div className="p-4 flex flex-col gap-3">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">内容</label>
                <input value={editTitle} onChange={e => setEditTitle(e.target.value)} placeholder="例：夕食" className="w-full bg-slate-50 border border-slate-200 rounded-lg text-sm px-2.5 py-2 outline-none focus:border-blue-300 transition-colors" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">金額（円）</label>
                <input type="number" value={editAmount} onChange={e => setEditAmount(e.target.value)} placeholder="金額" min="0" className="w-full bg-slate-50 border border-slate-200 rounded-lg text-sm px-2.5 py-2 outline-none focus:border-blue-300 transition-colors" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">支払者</label>
                <select value={editPayer} onChange={e => setEditPayer(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg text-sm px-2.5 py-2 outline-none cursor-pointer focus:border-blue-300 transition-colors">
                  <option value="">選択してください</option>
                  {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1">誰の分？</label>
                <div className="flex flex-wrap gap-1.5">
                  {members.map(m => (
                    <label key={m.id} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold cursor-pointer border transition-colors ${editCovered.includes(m.id) ? "bg-indigo-500 text-white border-indigo-500" : "bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300"}`}>
                      <input type="checkbox" checked={editCovered.includes(m.id)} onChange={ev => setEditCovered(ev.target.checked ? [...editCovered, m.id] : editCovered.filter(id => id !== m.id))} className="sr-only" />
                      {m.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-2 px-4 pb-4 justify-end">
              <button onClick={() => setEditingExpId(null)} className="bg-slate-100 border-none rounded-lg text-slate-500 px-3 py-1.5 text-xs cursor-pointer hover:bg-slate-200 transition-colors">キャンセル</button>
              <button onClick={saveEditExp} className="bg-gradient-to-r from-blue-500 to-indigo-500 border-none rounded-lg text-white px-4 py-1.5 text-xs font-bold cursor-pointer hover:from-blue-600 hover:to-indigo-600 transition-all">保存する</button>
            </div>
          </div>
        </div>
      )}

      {/* 精算結果 */}
      {settlements.length > 0 && (
        <div className="bg-green-50 rounded-xl border border-green-200 shadow-sm p-3">
          <h3 className="text-xs font-bold text-green-800 uppercase tracking-wider mb-2">✅ 精算結果</h3>
          <div className="flex flex-col gap-2">
            {settlements.map((s, i) => (
              <div key={i} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-green-100">
                <span className="text-sm font-bold text-slate-700">{s.fromName}</span>
                <span className="text-slate-400">→</span>
                <span className="text-sm font-bold text-slate-700">{s.toName}</span>
                <span className="ml-auto text-sm font-extrabold text-green-700">¥{s.amount.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {members.length >= 2 && expenses.length > 0 && settlements.length === 0 && (
        <div className="bg-green-50 rounded-xl border border-green-200 p-3 text-center text-sm font-semibold text-green-700">
          🎉 精算不要！みんな均等です
        </div>
      )}
    </section>
  );
}
