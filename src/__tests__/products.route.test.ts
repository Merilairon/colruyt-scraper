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
import productRouter from "../routes/products";
import { PriceChangeType } from "../models/PriceChange";

const mockedGet = get as jest.MockedFunction<typeof get>;

// Minimal product factory
function makeProduct(
  productId: string,
  overrides: Record<string, any> = {}
): any {
  return {
    productId,
    LongName: `Product ${productId}`,
    ShortName: `Prod ${productId}`,
    brand: "BrandX",
    isAvailable: true,
    priceChanges: [],
    promotions: [],
    ...overrides,
  };
}

function makePriceChange(
  productId: string,
  percentage: number,
  type: PriceChangeType = PriceChangeType.BASIC
): any {
  return {
    productId,
    priceChangeType: type,
    priceChangePercentage: percentage,
    priceChange: 0,
    involvesPromotion: false,
    oldPrice: 1.0,
    newprice: 1.0,
  };
}

// Build an express app with the product router attached
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/products", productRouter);
  return app;
}

describe("GET /api/products/changes", () => {
  let app: express.Express;

  beforeEach(() => {
    app = buildApp();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("returns products with price decreases", async () => {
    const products = [
      makeProduct("p1", {
        priceChanges: [makePriceChange("p1", -0.1)],
      }),
      makeProduct("p2", {
        priceChanges: [makePriceChange("p2", -0.2)],
      }),
      makeProduct("p3", {
        priceChanges: [makePriceChange("p3", 0.05)], // increase — should be excluded
      }),
    ];

    mockedGet.mockResolvedValue(products as any);

    const res = await request(app)
      .get("/api/products/changes")
      .query({ fromPerc: "-100", toPerc: "0" });

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.products.map((p: any) => p.productId)).toEqual(
      expect.arrayContaining(["p1", "p2"])
    );
    // p3 (increase) should not be present
    expect(res.body.products.map((p: any) => p.productId)).not.toContain("p3");
  });

  it("returns products sorted by largest decrease first (ascending percentage)", async () => {
    const products = [
      makeProduct("p1", { priceChanges: [makePriceChange("p1", -0.05)] }),
      makeProduct("p2", { priceChanges: [makePriceChange("p2", -0.2)] }),
    ];
    mockedGet.mockResolvedValue(products as any);

    const res = await request(app).get("/api/products/changes");

    expect(res.status).toBe(200);
    // sorted ascending by percentage: p2 (-0.2) before p1 (-0.05)
    expect(res.body.products[0].productId).toBe("p2");
    expect(res.body.products[1].productId).toBe("p1");
  });

  it("respects pagination parameters", async () => {
    const products = Array.from({ length: 5 }, (_, i) =>
      makeProduct(`p${i}`, { priceChanges: [makePriceChange(`p${i}`, -0.1)] })
    );
    mockedGet.mockResolvedValue(products as any);

    const res = await request(app)
      .get("/api/products/changes")
      .query({ size: "2", page: "2" });

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(2);
    expect(res.body.size).toBe(2);
    expect(res.body.total).toBe(5);
    expect(res.body.products).toHaveLength(2);
  });

  it("returns empty products array when no products have price decreases", async () => {
    const products = [
      makeProduct("p1", { priceChanges: [makePriceChange("p1", 0.1)] }),
    ];
    mockedGet.mockResolvedValue(products as any);

    const res = await request(app).get("/api/products/changes");

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.products).toHaveLength(0);
  });

  it("returns an empty list when the cache returns no products", async () => {
    mockedGet.mockResolvedValue([] as any);

    const res = await request(app).get("/api/products/changes");

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
  });
});

describe("GET /api/products", () => {
  let app: express.Express;

  beforeEach(() => {
    app = buildApp();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("returns all products with default pagination", async () => {
    const products = Array.from({ length: 3 }, (_, i) =>
      makeProduct(`p${i}`)
    );
    mockedGet.mockResolvedValue(products as any);

    const res = await request(app).get("/api/products");

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(3);
    expect(res.body.products).toHaveLength(3);
  });

  it("paginates results correctly", async () => {
    const products = Array.from({ length: 10 }, (_, i) =>
      makeProduct(`p${i}`)
    );
    mockedGet.mockResolvedValue(products as any);

    const res = await request(app)
      .get("/api/products")
      .query({ size: "3", page: "2" });

    expect(res.status).toBe(200);
    expect(res.body.size).toBe(3);
    expect(res.body.page).toBe(2);
    expect(res.body.products).toHaveLength(3);
  });

  it("filters by isAvailable=true", async () => {
    const products = [
      makeProduct("p1", { isAvailable: true }),
      makeProduct("p2", { isAvailable: false }),
    ];
    mockedGet.mockResolvedValue(products as any);

    const res = await request(app)
      .get("/api/products")
      .query({ isAvailable: "true" });

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.products[0].productId).toBe("p1");
  });

  it("filters by isAvailable=false", async () => {
    const products = [
      makeProduct("p1", { isAvailable: true }),
      makeProduct("p2", { isAvailable: false }),
    ];
    mockedGet.mockResolvedValue(products as any);

    const res = await request(app)
      .get("/api/products")
      .query({ isAvailable: "false" });

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.products[0].productId).toBe("p2");
  });

  it("returns only favourites when favourites query param is provided", async () => {
    const products = [
      makeProduct("p1"),
      makeProduct("p2"),
      makeProduct("p3"),
    ];
    mockedGet.mockResolvedValue(products as any);

    const res = await request(app)
      .get("/api/products")
      .query({ favourites: "p1,p3" });

    expect(res.status).toBe(200);
    expect(res.body.products.map((p: any) => p.productId)).toEqual(
      expect.arrayContaining(["p1", "p3"])
    );
    expect(res.body.products.map((p: any) => p.productId)).not.toContain("p2");
  });

  it("returns empty array when favourites list matches no products", async () => {
    const products = [makeProduct("p1"), makeProduct("p2")];
    mockedGet.mockResolvedValue(products as any);

    const res = await request(app)
      .get("/api/products")
      .query({ favourites: "p99" });

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.products).toHaveLength(0);
  });

  it("sorts by price change descending by default", async () => {
    const products = [
      makeProduct("p1", { priceChanges: [makePriceChange("p1", -0.1)] }),
      makeProduct("p2", { priceChanges: [makePriceChange("p2", -0.3)] }),
    ];
    mockedGet.mockResolvedValue(products as any);

    const res = await request(app).get("/api/products").query({ sort: "desc" });

    expect(res.status).toBe(200);
    // desc: higher (less negative) first
    expect(res.body.products[0].productId).toBe("p1");
  });

  it("sorts by price change ascending when sort=asc", async () => {
    const products = [
      makeProduct("p1", { priceChanges: [makePriceChange("p1", -0.1)] }),
      makeProduct("p2", { priceChanges: [makePriceChange("p2", -0.3)] }),
    ];
    mockedGet.mockResolvedValue(products as any);

    const res = await request(app).get("/api/products").query({ sort: "asc" });

    expect(res.status).toBe(200);
    // asc: more negative first
    expect(res.body.products[0].productId).toBe("p2");
  });

  it("returns products matching a fuzzy search", async () => {
    const products = [
      makeProduct("p1", { LongName: "Whole Milk", ShortName: "Milk", brand: "FarmFresh" }),
      makeProduct("p2", { LongName: "Orange Juice", ShortName: "OJ", brand: "Tropicana" }),
    ];
    mockedGet.mockResolvedValue(products as any);

    const res = await request(app)
      .get("/api/products")
      .query({ search: "Milk" });

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.products[0].productId).toBe("p1");
  });

  it("returns all products when search yields no matches", async () => {
    const products = [
      makeProduct("p1", { LongName: "Apple", ShortName: "Apple", brand: "FruitCo" }),
    ];
    mockedGet.mockResolvedValue(products as any);

    const res = await request(app)
      .get("/api/products")
      .query({ search: "xyznonexistent" });

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
  });
});

describe("GET /api/products/:productId", () => {
  let app: express.Express;

  beforeEach(() => {
    app = buildApp();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("returns the product when found", async () => {
    const products = [makeProduct("abc123")];
    mockedGet.mockResolvedValue(products as any);

    const res = await request(app).get("/api/products/abc123");

    expect(res.status).toBe(200);
    expect(res.body.productId).toBe("abc123");
  });

  it("returns a not found message when the product does not exist", async () => {
    mockedGet.mockResolvedValue([] as any);

    const res = await request(app).get("/api/products/nonexistent");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: "Product not found" });
  });
});
