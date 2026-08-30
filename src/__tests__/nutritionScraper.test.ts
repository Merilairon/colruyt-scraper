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
  sequelize: {
    define: jest.fn(),
    authenticate: jest.fn(),
    sync: jest.fn(),
    transaction: jest.fn(),
  },
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
  return {
    ...actual,
    Model: MockModel,
    DataTypes: actual.DataTypes,
    Transaction: {
      ISOLATION_LEVELS: {
        READ_COMMITTED: "READ COMMITTED",
      },
    },
  };
});

jest.mock("../models/Nutrition", () => ({
  Nutrition: {
    bulkCreate: jest.fn().mockResolvedValue(undefined),
    getAttributes: jest.fn().mockReturnValue({
      productId: {},
      energyKcal100g: {},
      fat100g: {},
      saturatedFat100g: {},
      carbohydrates100g: {},
      sugars100g: {},
      proteins100g: {},
      salt100g: {},
      fiber100g: {},
      sodium100g: {},
      nutriscoreGrade: {},
      novaGroup: {},
    }),
  },
}));

import {
  fetchNutritionForProduct,
  enrichProductsWithNutrition,
} from "../scrapers/nutritionScraper";
import { Nutrition } from "../models/Nutrition";

const mockedBulkCreate = Nutrition.bulkCreate as jest.MockedFunction<
  typeof Nutrition.bulkCreate
>;

type FakeClient = {
  getProductV3: jest.Mock;
};

function makeClient(): FakeClient {
  return {
    getProductV3: jest.fn(),
  };
}

describe("fetchNutritionForProduct", () => {
  let client: FakeClient;

  beforeEach(() => {
    client = makeClient();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("returns nutrition data when the first GTIN has nutriments", async () => {
    client.getProductV3.mockResolvedValue({
      data: {
        status: "success",
        product: {
          nutriments: {
            "energy-kcal_100g": 100,
            fat_100g: 5,
            "saturated-fat_100g": 2,
            carbohydrates_100g: 20,
            sugars_100g: 8,
            proteins_100g: 4,
            salt_100g: 0.5,
            fiber_100g: 3,
            sodium_100g: 0.2,
          },
          nutriscore_grade: "b",
          nova_group: 3,
        },
      },
    });

    const result = await fetchNutritionForProduct(
      { productId: "p1", gtin: ["1111111111111"] } as any,
      client as any,
    );

    expect(result).toMatchObject({
      productId: "p1",
      energyKcal100g: 100,
      fat100g: 5,
      saturatedFat100g: 2,
      carbohydrates100g: 20,
      sugars100g: 8,
      proteins100g: 4,
      salt100g: 0.5,
      fiber100g: 3,
      sodium100g: 0.2,
      nutriscoreGrade: "b",
      novaGroup: 3,
    });
    expect(client.getProductV3).toHaveBeenCalledTimes(1);
  });

  it("falls back to the second GTIN when the first has no data", async () => {
    client.getProductV3.mockResolvedValueOnce({
      data: {
        status: "failure",
        errors: [{ message: "product not found" }],
      },
    });
    client.getProductV3.mockResolvedValueOnce({
      data: {
        status: "success",
        product: {
          nutriments: { energy_kcal_100g: 250, fat_100g: 10 },
        },
      },
    });

    const result = await fetchNutritionForProduct(
      { productId: "p2", gtin: ["0000000000000", "2222222222222"] } as any,
      client as any,
    );

    expect(result).toMatchObject({
      productId: "p2",
      energyKcal100g: 250,
      fat100g: 10,
    });
    expect(client.getProductV3).toHaveBeenCalledTimes(2);
  });

  it("falls back through multiple GTINs and returns null when none have nutriments", async () => {
    client.getProductV3
      .mockResolvedValueOnce({ data: { status: "failure", errors: [] } })
      .mockResolvedValueOnce({ data: { status: "failure", errors: [] } })
      .mockResolvedValueOnce({
        data: {
          status: "success",
          product: { nutriments: {} },
        },
      });

    const result = await fetchNutritionForProduct(
      { productId: "p3", gtin: ["gtin1", "gtin2", "gtin3"] } as any,
      client as any,
    );

    expect(result).toBeNull();
    expect(client.getProductV3).toHaveBeenCalledTimes(3);
  });

  it("returns null for products with no GTINs", async () => {
    const result = await fetchNutritionForProduct(
      { productId: "p4", gtin: [] } as any,
      client as any,
    );

    expect(result).toBeNull();
    expect(client.getProductV3).not.toHaveBeenCalled();
  });
});

describe("enrichProductsWithNutrition", () => {
  let client: FakeClient;

  beforeEach(() => {
    client = makeClient();
    mockedBulkCreate.mockReset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("bulk-creates nutrition rows for products with data", async () => {
    client.getProductV3.mockResolvedValue({
      data: {
        status: "success",
        product: {
          nutriments: { energy_kcal_100g: 100, fat_100g: 5 },
        },
      },
    });

    await enrichProductsWithNutrition(
      [
        { productId: "p1", gtin: ["1111111111111"] } as any,
        { productId: "p2", gtin: ["2222222222222"] } as any,
      ],
      undefined,
      client as any,
    );

    expect(mockedBulkCreate).toHaveBeenCalledTimes(1);
    const created = mockedBulkCreate.mock.calls[0][0];
    expect(created).toHaveLength(2);
    expect(created.map((r: any) => r.productId)).toEqual(["p1", "p2"]);
  });

  it("does not bulk-create when no products have nutrition data", async () => {
    client.getProductV3.mockResolvedValue({
      data: { status: "failure", errors: [] },
    });

    await enrichProductsWithNutrition(
      [{ productId: "p1", gtin: ["1111111111111"] } as any],
      undefined,
      client as any,
    );

    expect(mockedBulkCreate).not.toHaveBeenCalled();
  });
});
