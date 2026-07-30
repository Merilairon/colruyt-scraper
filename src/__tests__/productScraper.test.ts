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

import { getAllProducts } from "../scrapers/productScraper";
import { RequestHandler } from "../utils/RequestHandler";

const mockedProxiedRequest = RequestHandler.instance.proxiedRequest as jest.Mock;

describe("getAllProducts", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      PRODUCT_URL: "https://example.com/products",
      PLACE_ID: "place-123",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("fetches all products across multiple pages", async () => {
    mockedProxiedRequest
      .mockResolvedValueOnce({ productsFound: 400 })
      .mockResolvedValueOnce({
        products: [{ productId: "p1" }, { productId: "p2" }],
      })
      .mockResolvedValueOnce({
        products: [{ productId: "p3" }, { productId: "p4" }],
      });

    const products = await getAllProducts();

    expect(products).toHaveLength(4);
    expect(products.map((p: any) => p.productId)).toEqual([
      "p1",
      "p2",
      "p3",
      "p4",
    ]);
    expect(mockedProxiedRequest).toHaveBeenCalledTimes(3);
    expect(mockedProxiedRequest).toHaveBeenNthCalledWith(
      1,
      "https://example.com/products",
      {},
      expect.objectContaining({
        clientCode: "CLP",
        placeId: "place-123",
        size: 1,
      })
    );
    expect(mockedProxiedRequest).toHaveBeenNthCalledWith(
      2,
      "https://example.com/products",
      {},
      expect.objectContaining({
        clientCode: "CLP",
        placeId: "place-123",
        page: 1,
        size: 250,
        sort: "basicprice asc",
      })
    );
    expect(mockedProxiedRequest).toHaveBeenNthCalledWith(
      3,
      "https://example.com/products",
      {},
      expect.objectContaining({
        clientCode: "CLP",
        placeId: "place-123",
        page: 2,
        size: 250,
        sort: "basicprice asc",
      })
    );
  });

  it("returns an empty array when no products are found", async () => {
    mockedProxiedRequest.mockResolvedValueOnce({ productsFound: 0 });

    const products = await getAllProducts();

    expect(products).toEqual([]);
    expect(mockedProxiedRequest).toHaveBeenCalledTimes(1);
  });
});
