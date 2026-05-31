import { useCallback, useRef, useState } from "react";
import { AppState, MAX_H, saveState } from "@/lib/store";

/**
 * アンドゥ履歴を管理するカスタムフック
 * スナップショット・復元ロジックをTabiContextから分離
 */
export function useUndoHistory(
  setState: React.Dispatch<React.SetStateAction<AppState>>,
  toast: (msg: string, color?: string) => void
) {
  const hist = useRef<string[]>([]);
  const [canUndo, setCanUndo] = useState(false);

  const snap = useCallback((current: AppState) => {
    hist.current.push(JSON.stringify(current));
    if (hist.current.length > MAX_H) hist.current.shift();
    setCanUndo(true);
  }, []);

  const doUndo = useCallback(() => {
    if (!hist.current.length) {
      toast("これ以上戻れません");
      return;
    }
    const s: AppState = JSON.parse(hist.current.pop()!);
    setCanUndo(hist.current.length > 0);

    // 選択中のtrip/dayが存在しない場合は補正
    const tripExists = s.trips.find((t) => t.id === s.tid);
    if (!tripExists) {
      s.tid = s.trips[0]?.id || null;
      s.did = s.trips[0]?.days[0]?.id || null;
    } else {
      const dayExists = tripExists.days.find((d) => d.id === s.did);
      if (!dayExists) s.did = tripExists.days[0]?.id || null;
    }

    saveState(s);
    setState(s);
    toast("↩ 元に戻しました");
  }, [setState, toast]);

  return { canUndo, snap, doUndo };
}
