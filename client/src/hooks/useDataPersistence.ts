// 旅のしおり - データ永続化フック（根本修正版）
// 毎回DBから最新データを読み込み、変更はすぐDBに保存する
import { useCallback, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import type { AppState } from "@/lib/store";

const SAVE_DEBOUNCE_MS = 2000; // 2秒デバウンス

/**
 * ブラウザ固有のクライアントIDを取得（ログインしていなくても使える）
 * localStorageに保存して永続化する。一度生成したら絶対に変えない。
 */
export function getClientId(): string {
  const KEY = "tabi_client_id_v2";
  let id = localStorage.getItem(KEY);
  if (!id) {
    // crypto.randomUUID が使えない環境のフォールバック
    const rand = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : "anon_" + Math.random().toString(36).slice(2, 18) + "_" + Date.now().toString(36);
    id = rand;
    localStorage.setItem(KEY, id);
  }
  return id;
}

// モジュールレベルで一度だけ生成（Reactの再レンダリングで変わらない）
const CLIENT_ID = getClientId();

export function useDataPersistence(
  state: AppState,
  onLoaded: (state: AppState) => void
) {
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLoaded = useRef(false);
  const lastSaved = useRef<string>("");
  const isLoadingFromDb = useRef(false);
  // onLoadedをrefで保持して依存配列から外す
  const onLoadedRef = useRef(onLoaded);
  onLoadedRef.current = onLoaded;

  const utils = trpc.useUtils();

  // saveMutationをrefで保持して安定した参照を使う
  const saveMutation = trpc.userData.save.useMutation();
  const saveMutationRef = useRef(saveMutation);
  saveMutationRef.current = saveMutation;

  // 起動時に必ずDBから最新データを読み込む（DB優先）
  useEffect(() => {
    if (hasLoaded.current) return;
    hasLoaded.current = true;
    isLoadingFromDb.current = true;

    utils.userData.load.fetch({ clientId: CLIENT_ID }, { staleTime: 0 }).then((result) => {
      if (result?.tripData) {
        try {
          const parsed: AppState = JSON.parse(result.tripData);
          if (parsed?.trips?.length) {
            // DBのデータを常に優先して適用
            onLoadedRef.current(parsed);
            // DBから読み込んだデータをlastSavedに記録（不要な再保存を防ぐ）
            lastSaved.current = result.tripData;
          }
        } catch {
          // パースエラーは無視
        }
      }
      // 読み込み完了後にフラグを解除（少し遅延させてReactのstateが確実に反映されるのを待つ）
      setTimeout(() => {
        isLoadingFromDb.current = false;
      }, 500);
    }).catch(() => {
      isLoadingFromDb.current = false;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // 空依存配列: 初回マウント時のみ実行

  // stateが変わるたびにDBに自動保存（デバウンス）
  const saveToDb = useCallback((currentState: AppState) => {
    // DB読み込み中は保存しない
    if (isLoadingFromDb.current) return;

    const json = JSON.stringify(currentState);
    if (json === lastSaved.current) return; // 変更なしはスキップ

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await saveMutationRef.current.mutateAsync({ clientId: CLIENT_ID, tripData: json });
        lastSaved.current = json;
      } catch {
        // 保存失敗は無視（localStorageのバックアップがある）
      }
    }, SAVE_DEBOUNCE_MS);
  }, []); // 空依存配列: saveMutationRefを使うので安定

  // stateが変わるたびに自動保存をトリガー
  useEffect(() => {
    saveToDb(state);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state, saveToDb]);

  return { clientId: CLIENT_ID };
}
