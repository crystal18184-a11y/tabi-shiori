import type { Request, Response, Express } from "express";

// 接続中のSSEクライアントを管理
// shareCode → Set<Response>
const clients = new Map<string, Set<Response>>();

/**
 * SSEエンドポイントを登録する
 * GET /api/sse/:shareCode
 */
export function registerSseRoutes(app: Express) {
  app.get("/api/sse/:shareCode", (req: Request, res: Response) => {
    const { shareCode } = req.params;
    if (!shareCode || shareCode.length < 4) {
      res.status(400).json({ error: "Invalid shareCode" });
      return;
    }

    // SSEヘッダー設定
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Nginxバッファリング無効
    res.flushHeaders();

    // クライアントを登録
    if (!clients.has(shareCode)) {
      clients.set(shareCode, new Set());
    }
    clients.get(shareCode)!.add(res);

    // 接続確認イベント送信
    res.write(`event: connected\ndata: ${JSON.stringify({ shareCode, ts: Date.now() })}\n\n`);

    // 現在の接続数を通知
    broadcastPresence(shareCode);

    // 接続切断時の処理
    req.on("close", () => {
      clients.get(shareCode)?.delete(res);
      if (clients.get(shareCode)?.size === 0) {
        clients.delete(shareCode);
      } else {
        broadcastPresence(shareCode);
      }
    });

    // ハートビート（30秒ごと）
    const heartbeat = setInterval(() => {
      if (res.writableEnded) {
        clearInterval(heartbeat);
        return;
      }
      res.write(`: heartbeat\n\n`);
    }, 30000);

    req.on("close", () => clearInterval(heartbeat));
  });
}

/**
 * 特定のshareCodeに接続している全クライアントにイベントをブロードキャスト
 */
export function broadcastToRoom(shareCode: string, event: string, data: unknown, excludeRes?: Response) {
  const room = clients.get(shareCode);
  if (!room) return;

  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  const dead: Response[] = [];

  for (const client of Array.from(room)) {
    if (client === excludeRes) continue;
    if (client.writableEnded) {
      dead.push(client);
      continue;
    }
    try {
      client.write(payload);
    } catch {
      dead.push(client);
    }
  }

  // 切断済みクライアントを削除
  dead.forEach((d) => room.delete(d));
}

/**
 * 接続人数を全クライアントに通知
 */
function broadcastPresence(shareCode: string) {
  const count = clients.get(shareCode)?.size ?? 0;
  broadcastToRoom(shareCode, "presence", { count, shareCode });
}

/**
 * 旅行データ更新をブロードキャスト
 */
export function broadcastTripUpdate(shareCode: string, tripData: string, excludeRes?: Response) {
  broadcastToRoom(shareCode, "trip_update", { tripData, ts: Date.now() }, excludeRes);
}
