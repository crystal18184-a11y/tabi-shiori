import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// 旅のしおり: 共有旅行プランテーブル
export const sharedTrips = mysqlTable("shared_trips", {
  id: int("id").autoincrement().primaryKey(),
  /** 共有コード（8文字英数字）*/
  shareCode: varchar("shareCode", { length: 16 }).notNull().unique(),
  /** 旅行データ（JSON文字列）*/
  tripData: text("tripData").notNull(),
  /** 作成者のopenId（任意）*/
  ownerOpenId: varchar("ownerOpenId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SharedTrip = typeof sharedTrips.$inferSelect;
export type InsertSharedTrip = typeof sharedTrips.$inferInsert;

// 旅のしおり: ユーザーの旅行データ永続化テーブル（ブラウザを閉じても消えない）
export const userTripData = mysqlTable("user_trip_data", {
  id: int("id").autoincrement().primaryKey(),
  /** ユーザーを一意に識別するキー（openIdまたはブラウザ固有ID）*/
  clientId: varchar("clientId", { length: 128 }).notNull().unique(),
  /** 旅行データ全体（JSON文字列）*/
  tripData: text("tripData").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserTripData = typeof userTripData.$inferSelect;
export type InsertUserTripData = typeof userTripData.$inferInsert;

// みんなのおすすめスポットテーブル
export const recommendedSpots = mysqlTable("recommended_spots", {
  id: varchar("id", { length: 64 }).primaryKey(),
  /** 登録したユーザーID（openIdまたはブラウザID）*/
  userId: varchar("userId", { length: 128 }).notNull(),
  /** 表示名 */
  userName: text("userName").notNull(),
  /** 店名・スポット名 */
  placeName: varchar("placeName", { length: 255 }).notNull(),
  /** カテゴリ */
  category: varchar("category", { length: 32 }).notNull().default("その他"),
  /** 住所 */
  address: varchar("address", { length: 512 }).notNull().default(""),
  /** 緯度 */
  lat: varchar("lat", { length: 32 }).notNull().default(""),
  /** 経度 */
  lng: varchar("lng", { length: 32 }).notNull().default(""),
  /** おすすめコメント */
  comment: varchar("comment", { length: 1000 }).notNull().default(""),
  /** 評価（1−5）*/
  rating: int("rating").notNull().default(3),
  /** SNSのURL（任意）*/
  sourceUrl: varchar("sourceUrl", { length: 1000 }).default(""),
  /** 写真URL（任意）*/
  photoUrl: varchar("photoUrl", { length: 1000 }).default(""),
  /** 都道府県 */
  prefecture: varchar("prefecture", { length: 16 }).notNull().default(""),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type RecommendedSpot = typeof recommendedSpots.$inferSelect;
export type InsertRecommendedSpot = typeof recommendedSpots.$inferInsert;