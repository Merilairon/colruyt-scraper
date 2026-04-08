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
    static belongsTo = jest.fn();
    static findAll = jest.fn();
    static belongsToMany = jest.fn();
  };
  return { ...actual, Model: MockModel };
});

import { getPriceChange } from "../comparers/comparer";
import { PriceChangeType } from "../models/PriceChange";

// Helper to create a minimal Price-like object
function makePrice(
  productId: string,
  basicPrice?: number,
  quantityPrice?: number,
  isPromoActive?: string
) {
  return {
    productId,
    basicPrice,
    quantityPrice,
    isPromoActive,
  } as any;
}

// Helper to create a minimal PriceChange-like object
function makePriceChange(
  productId: string,
  priceChangeType: PriceChangeType,
  extra: Record<string, any> = {}
) {
  return {
    productId,
    priceChangeType,
    priceChange: 0,
    priceChangePercentage: 0,
    involvesPromotion: false,
    oldPrice: 0,
    newprice: 0,
    ...extra,
  } as any;
}

describe("getPriceChange", () => {
  describe("new products (no earlier price)", () => {
    it("creates a new price change record when a product has no earlier price", async () => {
      const laterList = [makePrice("p1", 2.5)];
      const { newPriceChanges, updatedPriceChanges } = await getPriceChange(
        [],
        laterList,
        []
      );

      expect(newPriceChanges).toHaveLength(1);
      expect(updatedPriceChanges).toHaveLength(0);
      expect(newPriceChanges[0]).toMatchObject({
        productId: "p1",
        priceChangeType: PriceChangeType.BASIC,
        priceChange: 0,
        priceChangePercentage: 0,
        oldPrice: 2.5,
        newprice: 2.5,
      });
    });

    it("creates new price change records for both basicPrice and quantityPrice when both are present and product is new", async () => {
      const laterList = [makePrice("p1", 3.0, 2.5)];
      const { newPriceChanges, updatedPriceChanges } = await getPriceChange(
        [],
        laterList,
        []
      );

      expect(newPriceChanges).toHaveLength(2);
      expect(updatedPriceChanges).toHaveLength(0);

      const basicChange = newPriceChanges.find(
        (pc) => pc.priceChangeType === PriceChangeType.BASIC
      );
      const quantityChange = newPriceChanges.find(
        (pc) => pc.priceChangeType === PriceChangeType.QUANTITY
      );

      expect(basicChange).toBeDefined();
      expect(quantityChange).toBeDefined();
    });
  });

  describe("price increases", () => {
    it("detects a basic price increase correctly", async () => {
      const earlierList = [makePrice("p1", 2.0)];
      const laterList = [makePrice("p1", 2.5)];

      const { newPriceChanges, updatedPriceChanges } = await getPriceChange(
        earlierList,
        laterList,
        []
      );

      expect(newPriceChanges).toHaveLength(1);
      expect(updatedPriceChanges).toHaveLength(0);
      expect(newPriceChanges[0]).toMatchObject({
        productId: "p1",
        priceChangeType: PriceChangeType.BASIC,
        priceChange: 0.5,
        priceChangePercentage: 0.25,
        oldPrice: 2.0,
        newprice: 2.5,
      });
    });

    it("rounds price change percentage correctly for a doubling in price", async () => {
      const earlierList = [makePrice("p1", 1.0)];
      const laterList = [makePrice("p1", 2.0)];

      const { newPriceChanges } = await getPriceChange(
        earlierList,
        laterList,
        []
      );

      expect(newPriceChanges[0].priceChangePercentage).toBeCloseTo(1.0);
    });
  });

  describe("price decreases", () => {
    it("detects a basic price decrease correctly", async () => {
      const earlierList = [makePrice("p1", 5.0)];
      const laterList = [makePrice("p1", 4.0)];

      const { newPriceChanges } = await getPriceChange(
        earlierList,
        laterList,
        []
      );

      expect(newPriceChanges[0]).toMatchObject({
        priceChange: -1.0,
        priceChangePercentage: -0.2,
        oldPrice: 5.0,
        newprice: 4.0,
      });
    });
  });

  describe("no price change", () => {
    it("does not emit any records when basic price is unchanged and a price change already exists", async () => {
      const earlierList = [makePrice("p1", 3.0)];
      const laterList = [makePrice("p1", 3.0)];
      const existingPriceChanges = [
        makePriceChange("p1", PriceChangeType.BASIC),
      ];

      const { newPriceChanges, updatedPriceChanges } = await getPriceChange(
        earlierList,
        laterList,
        existingPriceChanges
      );

      // Price didn't change and record already exists — nothing should be emitted
      expect(newPriceChanges).toHaveLength(0);
      expect(updatedPriceChanges).toHaveLength(0);
    });
  });

  describe("updating existing records", () => {
    it("adds to updatedPriceChanges when an existing price change record already exists for a changed price", async () => {
      const earlierList = [makePrice("p1", 2.0)];
      const laterList = [makePrice("p1", 2.5)];
      const existingPriceChanges = [
        makePriceChange("p1", PriceChangeType.BASIC),
      ];

      const { newPriceChanges, updatedPriceChanges } = await getPriceChange(
        earlierList,
        laterList,
        existingPriceChanges
      );

      expect(newPriceChanges).toHaveLength(0);
      expect(updatedPriceChanges).toHaveLength(1);
      expect(updatedPriceChanges[0]).toMatchObject({
        productId: "p1",
        priceChangeType: PriceChangeType.BASIC,
        priceChange: 0.5,
        newprice: 2.5,
        oldPrice: 2.0,
      });
    });
  });

  describe("quantity price logic", () => {
    it("uses earlier quantityPrice as old price when available for P2 type", async () => {
      const earlierList = [makePrice("p1", 3.0, 2.5)];
      const laterList = [makePrice("p1", 3.0, 2.0)];

      const { newPriceChanges } = await getPriceChange(
        earlierList,
        laterList,
        []
      );

      const quantityChange = newPriceChanges.find(
        (pc) => pc.priceChangeType === PriceChangeType.QUANTITY
      );
      expect(quantityChange).toMatchObject({
        priceChangeType: PriceChangeType.QUANTITY,
        oldPrice: 2.5,
        newprice: 2.0,
        priceChange: -0.5,
      });
    });

    it("falls back to earlierBasicPrice as oldPrice for P2 when earlierQuantityPrice is absent", async () => {
      const earlierList = [makePrice("p1", 4.0, undefined)];
      const laterList = [makePrice("p1", 4.0, 3.5)];

      const { newPriceChanges } = await getPriceChange(
        earlierList,
        laterList,
        []
      );

      const quantityChange = newPriceChanges.find(
        (pc) => pc.priceChangeType === PriceChangeType.QUANTITY
      );
      expect(quantityChange).toMatchObject({
        priceChangeType: PriceChangeType.QUANTITY,
        oldPrice: 4.0,
        newprice: 3.5,
      });
    });

    it("skips P2 when laterPrice has no quantityPrice", async () => {
      const earlierList = [makePrice("p1", 3.0, 2.5)];
      const laterList = [makePrice("p1", 3.0, undefined)];

      const { newPriceChanges, updatedPriceChanges } = await getPriceChange(
        earlierList,
        laterList,
        []
      );

      const quantityChanges = [
        ...newPriceChanges,
        ...updatedPriceChanges,
      ].filter((pc) => pc.priceChangeType === PriceChangeType.QUANTITY);
      expect(quantityChanges).toHaveLength(0);
    });
  });

  describe("promotion tracking", () => {
    it("sets involvesPromotion to true when isPromoActive is truthy", async () => {
      const laterList = [makePrice("p1", 2.0, undefined, "true")];

      const { newPriceChanges } = await getPriceChange([], laterList, []);

      expect(newPriceChanges[0].involvesPromotion).toBe(true);
    });

    it("sets involvesPromotion to false when isPromoActive is falsy", async () => {
      const laterList = [makePrice("p1", 2.0, undefined, undefined)];

      const { newPriceChanges } = await getPriceChange([], laterList, []);

      expect(newPriceChanges[0].involvesPromotion).toBe(false);
    });
  });

  describe("empty inputs", () => {
    it("returns empty arrays when all inputs are empty", async () => {
      const { newPriceChanges, updatedPriceChanges } = await getPriceChange(
        [],
        [],
        []
      );
      expect(newPriceChanges).toHaveLength(0);
      expect(updatedPriceChanges).toHaveLength(0);
    });

    it("returns empty arrays when laterList is empty", async () => {
      const earlierList = [makePrice("p1", 2.0)];
      const { newPriceChanges, updatedPriceChanges } = await getPriceChange(
        earlierList,
        [],
        []
      );
      expect(newPriceChanges).toHaveLength(0);
      expect(updatedPriceChanges).toHaveLength(0);
    });
  });

  describe("multiple products", () => {
    it("processes multiple products independently", async () => {
      const earlierList = [makePrice("p1", 1.0), makePrice("p2", 2.0)];
      const laterList = [makePrice("p1", 1.5), makePrice("p2", 1.8)];

      const { newPriceChanges } = await getPriceChange(
        earlierList,
        laterList,
        []
      );

      expect(newPriceChanges).toHaveLength(2);

      const p1Change = newPriceChanges.find((pc) => pc.productId === "p1");
      const p2Change = newPriceChanges.find((pc) => pc.productId === "p2");

      expect(p1Change!.priceChange).toBeCloseTo(0.5);
      expect(p2Change!.priceChange).toBeCloseTo(-0.2);
    });
  });
});
