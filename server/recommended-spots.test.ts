import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createRecommendedSpot, searchRecommendedSpots } from "./db";
import { getDb } from "./db";
import { recommendedSpots } from "../drizzle/schema";
import { eq } from "drizzle-orm";

describe("Recommended Spots Database Tests", () => {
  let testSpotId: string;
  let testData: any;

  beforeAll(() => {
    testSpotId = `test_spot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    testData = {
      id: testSpotId,
      userId: "test_user_123",
      userName: "テストユーザー",
      placeName: "テスト食堂",
      category: "食事",
      address: "東京都渋谷区道玄坂1-2-3",
      lat: "35.6595",
      lng: "139.7004",
      comment: "おいしいテスト食堂です",
      rating: 5,
      sourceUrl: "https://example.com",
      photoUrl: "https://example.com/photo.jpg",
      prefecture: "東京都",
      createdAt: new Date(),
    };
  });

  afterAll(async () => {
    // テスト後にテストデータをクリア
    const db = await getDb();
    if (db) {
      await db.delete(recommendedSpots).where(eq(recommendedSpots.id, testSpotId));
    }
  });

  it("should create a recommended spot", async () => {
    await createRecommendedSpot(testData);
    
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    const result = await db.select().from(recommendedSpots).where(eq(recommendedSpots.id, testSpotId));
    
    expect(result).toHaveLength(1);
    expect(result[0].placeName).toBe("テスト食堂");
    expect(result[0].category).toBe("食事");
    expect(result[0].rating).toBe(5);
    expect(result[0].userId).toBe("test_user_123");
  });

  it("should search recommended spots by prefecture", async () => {
    const results = await searchRecommendedSpots({ prefecture: "東京都" });
    
    expect(results.length).toBeGreaterThan(0);
    const found = results.find(s => s.id === testSpotId);
    expect(found).toBeDefined();
    expect(found?.placeName).toBe("テスト食堂");
  });

  it("should search recommended spots by category", async () => {
    const results = await searchRecommendedSpots({ category: "食事" });
    
    expect(results.length).toBeGreaterThan(0);
    const found = results.find(s => s.id === testSpotId);
    expect(found).toBeDefined();
    expect(found?.category).toBe("食事");
  });

  it("should search recommended spots by keyword", async () => {
    const results = await searchRecommendedSpots({ keyword: "テスト食堂" });
    
    expect(results.length).toBeGreaterThan(0);
    const found = results.find(s => s.id === testSpotId);
    expect(found).toBeDefined();
  });

  it("should search with multiple filters", async () => {
    const results = await searchRecommendedSpots({
      prefecture: "東京都",
      category: "食事",
      keyword: "テスト",
    });
    
    expect(results.length).toBeGreaterThan(0);
    const found = results.find(s => s.id === testSpotId);
    expect(found).toBeDefined();
  });

  it("should verify spot data integrity", async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    
    const result = await db.select().from(recommendedSpots).where(eq(recommendedSpots.id, testSpotId));
    
    expect(result[0]).toMatchObject({
      id: testSpotId,
      userId: "test_user_123",
      userName: "テストユーザー",
      placeName: "テスト食堂",
      category: "食事",
      address: "東京都渋谷区道玄坂1-2-3",
      lat: "35.6595",
      lng: "139.7004",
      comment: "おいしいテスト食堂です",
      rating: 5,
      sourceUrl: "https://example.com",
      photoUrl: "https://example.com/photo.jpg",
      prefecture: "東京都",
    });
  });
});
