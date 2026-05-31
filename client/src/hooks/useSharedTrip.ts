// 旅のしおり - リアルタイム共有フック
// DBポーリングで変更を検知し、他ユーザーの更新を自動反映する
import { useCallback, useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";
import type { Trip } from "@/lib/store";

const POLL_INTERVAL = 5000; // 5秒ごとにポーリング

export function useSharedTrip(
  currentTrip: Trip | undefined,
  onRemoteUpdate: (trip: Trip) => void
) {
  const [shareCode, setShareCode] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const lastUpdatedAt = useRef<Date | null>(null);
  const isSyncing = useRef(false);

  const createMutation = trpc.trip.create.useMutation();
  const updateMutation = trpc.trip.update.useMutation();
  const utils = trpc.useUtils();

  // 共有コードを作成して共有を開始する
  const startSharing = useCallback(async (trip: Trip): Promise<string> => {
    setSyncing(true);
    setSyncError(null);
    try {
      const result = await createMutation.mutateAsync({ tripData: JSON.stringify(trip) });
      setShareCode(result.shareCode);
      lastUpdatedAt.current = new Date();
      return result.shareCode;
    } catch (e) {
      setSyncError("共有の開始に失敗しました");
      throw e;
    } finally {
      setSyncing(false);
    }
  }, [createMutation]);

  // 既存の共有コードに参加する
  const joinSharing = useCallback(async (code: string, onJoined: (trip: Trip) => void) => {
    setSyncing(true);
    setSyncError(null);
    try {
      const result = await utils.trip.get.fetch({ shareCode: code.toUpperCase() });
      if (!result) {
        setSyncError("共有コードが見つかりません");
        setSyncing(false);
        return false;
      }
      const trip: Trip = JSON.parse(result.tripData);
      setShareCode(code.toUpperCase());
      lastUpdatedAt.current = result.updatedAt;
      onJoined(trip);
      return true;
    } catch (e) {
      setSyncError("参加に失敗しました");
      return false;
    } finally {
      setSyncing(false);
    }
  }, [utils]);

  // ローカルの変更をDBに同期する
  const pushUpdate = useCallback(async (trip: Trip, code: string) => {
    if (isSyncing.current) return;
    isSyncing.current = true;
    try {
      await updateMutation.mutateAsync({ shareCode: code, tripData: JSON.stringify(trip) });
      lastUpdatedAt.current = new Date();
    } catch (e) {
      console.warn("[Sync] Push failed:", e);
    } finally {
      isSyncing.current = false;
    }
  }, [updateMutation]);

  // 共有を停止する
  const stopSharing = useCallback(() => {
    setShareCode(null);
    lastUpdatedAt.current = null;
    setSyncError(null);
  }, []);

  // ポーリングで他ユーザーの更新を検知する
  useEffect(() => {
    if (!shareCode) return;
    const timer = setInterval(async () => {
      try {
        const poll = await utils.trip.poll.fetch({ shareCode });
        if (!poll) return;
        const remoteTime = new Date(poll.updatedAt).getTime();
        const localTime = lastUpdatedAt.current?.getTime() ?? 0;
        // リモートの方が新しければデータを取得して反映
        if (remoteTime > localTime + 1000) {
          const full = await utils.trip.get.fetch({ shareCode });
          if (full) {
            const trip: Trip = JSON.parse(full.tripData);
            lastUpdatedAt.current = new Date(poll.updatedAt);
            onRemoteUpdate(trip);
          }
        }
      } catch {}
    }, POLL_INTERVAL);
    return () => clearInterval(timer);
  }, [shareCode, onRemoteUpdate, utils]);

  return { shareCode, syncing, syncError, startSharing, joinSharing, pushUpdate, stopSharing };
}
