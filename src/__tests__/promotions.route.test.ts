// Mock the cache module with an explicit factory — prevents quick-lru (ESM) from loading
jest.mock("../utils/cache", () => ({
  get: jest.fn(),
  put: jest.fn(),
}));
// Mock node-cron to prevent it from scheduling real cron jobs
jest.mock("node-cron", () => ({ schedule: jest.fn() }));
// Prevent Sequelize from being instantiated at import time
jest.mock("../database", () => ({
  sequelize: { define: jest.fn(), authenticate: jest.fn(), sync: jest.fn() },
}));
// Provide lightweight Sequelize model stubs so model files can be imported
jest.mock("sequelize", () => {
  const actual = jest.requireActual("sequelize");
  const MockModel = class {
    static init = jest.fn();
    static hasMany = jest.fn();
    static belongsTo = jest.fn();
    static findAll = jest.fn();
    static belongsToMany = jest.fn();
  };
  return { ...actual, Model: MockModel };
});

import express from "express";
import request from "supertest";
import { get } from "../utils/cache";
import promotionRouter from "../routes/promotions";

const mockedGet = get as jest.MockedFunction<typeof get>;

// Minimal benefit factory
function makeBenefit(overrides: Record<string, any> = {}): any {
  return {
    benefitAmount: 0,
    benefitPercentage: 0,
    minLimit: 0,
    maxLimit: 0,
    limitUnit: "EUR",
    promotionId: "promo1",
    ...overrides,
  };
}

// Minimal promotion factory
function makePromotion(
  promotionId: string,
  overrides: Record<string, any> = {}
): any {
  return {
    promotionId,
    promotionType: "DISCOUNT",
    activeStartDate: "2024-01-01",
    activeEndDate: "2024-12-31",
    benefits: [],
    products: [],
    ...overrides,
  };
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/promotions", promotionRouter);
  return app;
}

describe("GET /api/promotions", () => {
  let app: express.Express;

  beforeEach(() => {
    app = buildApp();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("returns all promotions with default pagination", async () => {
    const promotions = [
      makePromotion("promo1"),
      makePromotion("promo2"),
    ];
    mockedGet.mockResolvedValue(promotions as any);

    const res = await request(app).get("/api/promotions");

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.promotions).toHaveLength(2);
  });

  it("paginates results correctly", async () => {
    const promotions = Array.from({ length: 10 }, (_, i) =>
      makePromotion(`promo${i}`)
    );
    mockedGet.mockResolvedValue(promotions as any);

    const res = await request(app)
      .get("/api/promotions")
      .query({ size: "3", page: "2" });

    expect(res.status).toBe(200);
    expect(res.body.size).toBe(3);
    expect(res.body.page).toBe(2);
    expect(res.body.promotions).toHaveLength(3);
    expect(res.body.total).toBe(10);
  });

  it("returns an empty list when cache returns no promotions", async () => {
    mockedGet.mockResolvedValue([] as any);

    const res = await request(app).get("/api/promotions");

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.promotions).toHaveLength(0);
  });

  it("sorts promotions with benefit amounts desc by default", async () => {
    const promotions = [
      makePromotion("promo1", {
        benefits: [makeBenefit({ benefitAmount: 5, benefitPercentage: 0 })],
      }),
      makePromotion("promo2", {
        benefits: [makeBenefit({ benefitAmount: 10, benefitPercentage: 0 })],
      }),
    ];
    mockedGet.mockResolvedValue(promotions as any);

    const res = await request(app)
      .get("/api/promotions")
      .query({ order: "benefit", sort: "desc" });

    expect(res.status).toBe(200);
    // promo2 has higher amount, so it should appear first in desc order
    expect(res.body.promotions[0].promotionId).toBe("promo2");
    expect(res.body.promotions[1].promotionId).toBe("promo1");
  });

  it("sorts promotions with benefit amounts asc when sort=asc", async () => {
    const promotions = [
      makePromotion("promo1", {
        benefits: [makeBenefit({ benefitAmount: 5, benefitPercentage: 0 })],
      }),
      makePromotion("promo2", {
        benefits: [makeBenefit({ benefitAmount: 10, benefitPercentage: 0 })],
      }),
    ];
    mockedGet.mockResolvedValue(promotions as any);

    const res = await request(app)
      .get("/api/promotions")
      .query({ order: "benefit", sort: "asc" });

    expect(res.status).toBe(200);
    // promo1 has lower amount, so it should appear first in asc order
    expect(res.body.promotions[0].promotionId).toBe("promo1");
    expect(res.body.promotions[1].promotionId).toBe("promo2");
  });

  it("places promotions with no benefits first (sort implementation behaviour)", async () => {
    const promotions = [
      makePromotion("promoNoBenefits", { benefits: [] }),
      makePromotion("promoWithBenefits", {
        benefits: [makeBenefit({ benefitAmount: 5, benefitPercentage: 0 })],
      }),
    ];
    mockedGet.mockResolvedValue(promotions as any);

    const res = await request(app).get("/api/promotions");

    expect(res.status).toBe(200);
    // The sort returns -1 when `a` has no benefits, placing it first
    expect(res.body.promotions[0].promotionId).toBe("promoNoBenefits");
  });

  it("handles first page returning correct slice", async () => {
    const promotions = Array.from({ length: 5 }, (_, i) =>
      makePromotion(`promo${i}`)
    );
    mockedGet.mockResolvedValue(promotions as any);

    const res = await request(app)
      .get("/api/promotions")
      .query({ size: "5", page: "1" });

    expect(res.body.promotions).toHaveLength(5);
  });
});

describe("GET /api/promotions/:promotionId", () => {
  let app: express.Express;

  beforeEach(() => {
    app = buildApp();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("returns the promotion when found", async () => {
    const promotions = [makePromotion("promo42")];
    mockedGet.mockResolvedValue(promotions as any);

    const res = await request(app).get("/api/promotions/promo42");

    expect(res.status).toBe(200);
    expect(res.body.promotionId).toBe("promo42");
  });

  it("returns a not found message when the promotion does not exist", async () => {
    mockedGet.mockResolvedValue([] as any);

    const res = await request(app).get("/api/promotions/nonexistent");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: "Promotion not found" });
  });

  it("sorts benefits by minLimit, benefitAmount, benefitPercentage when returning a promotion", async () => {
    const promotion = makePromotion("promoSorted", {
      benefits: [
        makeBenefit({ minLimit: 2, benefitAmount: 5, benefitPercentage: 0 }),
        makeBenefit({ minLimit: 1, benefitAmount: 3, benefitPercentage: 0 }),
        makeBenefit({ minLimit: 1, benefitAmount: 10, benefitPercentage: 0 }),
      ],
    });
    mockedGet.mockResolvedValue([promotion] as any);

    const res = await request(app).get("/api/promotions/promoSorted");

    expect(res.status).toBe(200);
    const benefits = res.body.benefits;
    expect(benefits[0]).toMatchObject({ minLimit: 1, benefitAmount: 3 });
    expect(benefits[1]).toMatchObject({ minLimit: 1, benefitAmount: 10 });
    expect(benefits[2]).toMatchObject({ minLimit: 2, benefitAmount: 5 });
  });

  it("returns a promotion with empty benefits array without error", async () => {
    const promotion = makePromotion("promoEmpty", { benefits: [] });
    mockedGet.mockResolvedValue([promotion] as any);

    const res = await request(app).get("/api/promotions/promoEmpty");

    expect(res.status).toBe(200);
    expect(res.body.benefits).toEqual([]);
  });
});
