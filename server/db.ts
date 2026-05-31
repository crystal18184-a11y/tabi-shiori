import { eq, and, like, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, sharedTrips, userTripData, recommendedSpots, InsertRecommendedSpot, RecommendedSpot } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ===== 共有旅行プラン =====

/** 共有コードを生成（8文字英数字） */
function genShareCode(): string {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

/** 共有プランを作成または更新する */
export async function upsertSharedTrip(shareCode: string, tripData: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const existing = await db.select().from(sharedTrips).where(eq(sharedTrips.shareCode, shareCode)).limit(1);
  if (existing.length > 0) {
    await db.update(sharedTrips).set({ tripData, updatedAt: new Date() }).where(eq(sharedTrips.shareCode, shareCode));
    return shareCode;
  } else {
    await db.insert(sharedTrips).values({ shareCode, tripData });
    return shareCode;
  }
}

/** 共有プランを取得する */
export async function getSharedTrip(shareCode: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.select().from(sharedTrips).where(eq(sharedTrips.shareCode, shareCode)).limit(1);
  return result.length > 0 ? result[0] : null;
}

/** 新しい共有コードを生成して保存する */
// ② DBスキーマ: JSONカラムのサイズ上限チェック（MySQL TEXT = 65535 bytes上限）
const MAX_TRIP_DATA_BYTES = 60000; // 安全マージンを持たせて60KB

function validateTripDataSize(tripData: string, context: string): void {
  const bytes = Buffer.byteLength(tripData, "utf8");
  if (bytes > MAX_TRIP_DATA_BYTES) {
    throw new Error(
      `[${context}] tripData size (${Math.round(bytes / 1024)}KB) exceeds limit (${Math.round(MAX_TRIP_DATA_BYTES / 1024)}KB). ` +
      "Consider removing large base64 images or splitting trips."
    );
  }
}

export async function createSharedTrip(tripData: string): Promise<string> {
  validateTripDataSize(tripData, "createSharedTrip");
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  let code = genShareCode();
  for (let i = 0; i < 5; i++) {
    const existing = await db.select().from(sharedTrips).where(eq(sharedTrips.shareCode, code)).limit(1);
    if (!existing.length) break;
    code = genShareCode();
  }
  await db.insert(sharedTrips).values({ shareCode: code, tripData });
  return code;
}

// ===== ユーザー個人データ永続化 =====

/** ユーザーの旅行データを保存（upsert） */
export async function saveUserTripData(clientId: string, tripData: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(userTripData)
    .values({ clientId, tripData })
    .onDuplicateKeyUpdate({ set: { tripData, updatedAt: new Date() } });
}

/** ユーザーの旅行データを取得 */
export async function getUserTripData(clientId: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(userTripData).where(eq(userTripData.clientId, clientId)).limit(1);
  return result.length > 0 ? result[0].tripData : null;
}

// ===== みんなのおすすめスポット =====

/** おすすめスポットを登録する */
export async function createRecommendedSpot(data: InsertRecommendedSpot): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(recommendedSpots).values(data);
}

/** おすすめスポットを検索する（都道府県・カテゴリ・キーワード） */
export async function searchRecommendedSpots(opts: {
  prefecture?: string;
  category?: string;
  keyword?: string;
}): Promise<RecommendedSpot[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const conditions = [];
  if (opts.prefecture) conditions.push(eq(recommendedSpots.prefecture, opts.prefecture));
  if (opts.category) conditions.push(eq(recommendedSpots.category, opts.category));
  if (opts.keyword) {
    conditions.push(
      or(
        like(recommendedSpots.placeName, `%${opts.keyword}%`),
        like(recommendedSpots.address, `%${opts.keyword}%`),
        like(recommendedSpots.comment, `%${opts.keyword}%`)
      )
    );
  }

  const query = db.select().from(recommendedSpots);
  const results = conditions.length > 0
    ? await query.where(and(...conditions)).limit(30).orderBy(recommendedSpots.createdAt)
    : await query.limit(30).orderBy(recommendedSpots.createdAt);

  return results;
}
