// Mock cli-progress to avoid real progress bar output during tests
jest.mock("cli-progress", () => ({
  SingleBar: jest.fn().mockImplementation(() => ({
    start: jest.fn(),
    increment: jest.fn(),
    stop: jest.fn(),
  })),
  Presets: { shades_classic: {} },
}));

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
    static hasOne = jest.fn();
    static belongsTo = jest.fn();
    static findAll = jest.fn();
    static belongsToMany = jest.fn();
    static bulkCreate = jest.fn();
    static getAttributes = jest.fn().mockReturnValue({});
  };
  return { ...actual, Model: MockModel, DataTypes: actual.DataTypes };
});

jest.mock("../utils/RequestHandler", () => ({
  RequestHandler: {
    instance: { proxiedRequest: jest.fn() },
  },
}));

import { getAllPromotions } from "../scrapers/promotionScaper";
import { RequestHandler } from "../utils/RequestHandler";

const mockedProxiedRequest = RequestHandler.instance.proxiedRequest as jest.Mock;

describe("getAllPromotions", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      PROMOTION_URL: "https://example.com/promotions",
      PLACE_ID: "place-123",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("fetches all promotions across multiple pages", async () => {
    mockedProxiedRequest
      .mockResolvedValueOnce({ totalPromotionFound: 75 })
      .mockResolvedValueOnce({ promotions: [{ promotionId: "promo1" }] })
      .mockResolvedValueOnce({
        promotions: [{ promotionId: "promo2" }, { promotionId: "promo3" }],
      });

    const promotions = await getAllPromotions();

    expect(promotions).toHaveLength(3);
    expect(promotions.map((p: any) => p.promotionId)).toEqual([
      "promo1",
      "promo2",
      "promo3",
    ]);
    expect(mockedProxiedRequest).toHaveBeenCalledTimes(3);
    expect(mockedProxiedRequest).toHaveBeenNthCalledWith(
      1,
      "https://example.com/promotions",
      {},
      expect.objectContaining({
        clientCode: "CLP",
        placeId: "place-123",
        size: 50,
      })
    );
    expect(mockedProxiedRequest).toHaveBeenNthCalledWith(
      2,
      "https://example.com/promotions",
      {},
      expect.objectContaining({
        clientCode: "CLP",
        placeId: "place-123",
        page: 1,
        size: 50,
      })
    );
    expect(mockedProxiedRequest).toHaveBeenNthCalledWith(
      3,
      "https://example.com/promotions",
      {},
      expect.objectContaining({
        clientCode: "CLP",
        placeId: "place-123",
        page: 2,
        size: 50,
      })
    );
  });

  it("returns an empty array when no promotions are found", async () => {
    mockedProxiedRequest.mockResolvedValueOnce({ totalPromotionFound: 0 });

    const promotions = await getAllPromotions();

    expect(promotions).toEqual([]);
    expect(mockedProxiedRequest).toHaveBeenCalledTimes(1);
  });
});
