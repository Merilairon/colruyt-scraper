/**
 * @fileoverview This file defines the routes for handling product-related operations in the application.
 * It includes routes for fetching a product by its ID, searching products by name and availability,
 * and retrieving all products with pagination and availability filtering.
 */

import { Router } from "express";
import { Product } from "../models/Product";
import { Price } from "../models/Price";
import { Op } from "sequelize";
import { PriceChange, PriceChangeType } from "../models/PriceChange";
import Fuse from "fuse.js";
import { get } from "../utils/cache";

const router = Router();

/**
 * Route to get products with the most significant price decreases.
 * @name GET /changes
 * @param {number} [size=10] - The number of products per page.
 * @param {number} [page=1] - The page number to retrieve.
 * @param {float} [fromPerc=-1000] - The percentage to compare from
 * @param {float} [toPerc=0] - The percentage to compare to
 * @returns {Object} An object containing the page number, page size, total number of products, and the list of products with the best price drops.
 */
router.get("/changes", async (req, res) => {
  const { size = 10, page = 1, fromPerc = -1000, toPerc = 0 } = req.query;
  const pageSize = parseInt(size as string);
  const pageNumber = parseInt(page as string);
  const fromPercValue = parseFloat(fromPerc as string) / 100;
  const toPercValue = parseFloat(toPerc as string) / 100;

  const allProducts = await getAllProducts();

  // Filter and sort in one pass if possible, or optimize the filtering logic.
  // Create a map for quick lookup of basic price changes to avoid repeated `find` calls.
  const productPriceChangeMap = new Map<string, PriceChange | undefined>();
  allProducts.forEach((p) => {
    productPriceChangeMap.set(
      p.productId,
      p.priceChanges?.find((pc) => pc.priceChangeType === PriceChangeType.BASIC)
    );
  });

  const productsWithDecreases = allProducts
    .filter((p: Product) => {
      const priceChangeP1 = productPriceChangeMap.get(p.productId);
      // Ensure priceChangeP1 exists and its percentage is less than the threshold
      return (
        priceChangeP1 &&
        priceChangeP1.priceChangePercentage < toPercValue &&
        priceChangeP1.priceChangePercentage > fromPercValue
      );
    })
    .sort((a, b) => {
      // Retrieve pre-fetched price changes from the map
      const aPriceChangeP1 = productPriceChangeMap.get(a.productId);
      const bPriceChangeP1 = productPriceChangeMap.get(b.productId);

      // This sort assumes aPriceChangeP1 and bPriceChangeP1 will always exist due to the filter.
      // If there's any chance they might not, add null/undefined checks.
      return (
        (aPriceChangeP1?.priceChangePercentage || 0) -
        (bPriceChangeP1?.priceChangePercentage || 0)
      );
    });

  const paginatedProducts = productsWithDecreases.slice(
    (pageNumber - 1) * pageSize,
    pageNumber * pageSize
  );

  res.json({
    page: pageNumber,
    size: pageSize,
    total: productsWithDecreases.length,
    products: paginatedProducts,
  });
});

/**
 * Route to get all products in a collection with pagination, availability filter, and favourites filter.
 * @name GET /
 * @param {number} [size=50] - The number of products per page.
 * @param {number} [page=1] - The page number to retrieve.
 * @param {boolean} [isAvailable] - Optional availability filter.
 * @param {string} [search] - Optional search filter for fuzzy searching product names.
 * @param {string} [favourites] - Optional comma-separated list of favourite product IDs.
 * @returns {Object} An object containing the page number, page size, total number of products, and the list of products.
 */
router.get("/", async (req, res) => {
  const {
    size = 50,
    page = 1,
    isAvailable,
    search,
    favourites,
    sort = "desc",
  } = req.query;
  const pageSize = parseInt(size as string, 10);
  const pageNumber = parseInt(page as string, 10);
  const searchQuery = search as string;
  const favouritesArray = favourites
    ? (favourites as string).split(",")
    : undefined;

  const allProducts = await getAllProducts();
  let filteredProducts: Product[];

  // If favourites are provided, return the products in the favourites list
  if (favouritesArray) {
    const favouritesSet = new Set(favouritesArray);
    filteredProducts = allProducts.filter((product: Product) =>
      favouritesSet.has(product.productId)
    );
  } else {
    let productsToFilter = allProducts;
    // Fuzzy search if search query is provided
    if (searchQuery) {
      const fuseOptions = {
        threshold: 0.2, // Adjust for strictness. 0.0 is perfect match, 1.0 is any match.
        keys: ["LongName", "ShortName", "brand"],
      };
      const fuse = new Fuse(allProducts, fuseOptions);
      productsToFilter = await fuse
        .search(searchQuery)
        .map((result) => result.item);
    }

    // Filter by availability
    filteredProducts =
      productsToFilter?.filter(
        (product) =>
          isAvailable === undefined ||
          product.isAvailable === (isAvailable === "true")
      ) || [];
  }

  // Filter and sort in one pass if possible, or optimize the filtering logic.
  // Create a map for quick lookup of basic price changes to avoid repeated `find` calls.
  const productPriceChangeMap = new Map<string, PriceChange | undefined>();
  filteredProducts.forEach((p) => {
    productPriceChangeMap.set(
      p.productId,
      p.priceChanges?.find((pc) => pc.priceChangeType === PriceChangeType.BASIC)
    );
  });

  filteredProducts = filteredProducts.sort((a, b) => {
    // Retrieve pre-fetched price changes from the map
    const aPriceChangeP1 = productPriceChangeMap.get(a.productId);
    const bPriceChangeP1 = productPriceChangeMap.get(b.productId);

    // This sort assumes aPriceChangeP1 and bPriceChangeP1 will always exist due to the filter.
    // If there's any chance they might not, add null/undefined checks.
    return (
      (aPriceChangeP1?.priceChangePercentage || 0) -
      (bPriceChangeP1?.priceChangePercentage || 0)
    );
  });

  const paginatedProducts = filteredProducts.slice(
    (pageNumber - 1) * pageSize,
    pageNumber * pageSize
  );

  res.json({
    page: pageNumber,
    size: pageSize,
    total: filteredProducts.length,
    products: paginatedProducts,
  });
});

/**
 * Route to fetch a product by its ID.
 * @name GET /:productId
 * @param {string} productId - The ID of the product to fetch.
 * @returns {Product | { message: string }} The product object or a message if not found.
 */
router.get("/:productId", async (req, res) => {
  const { productId } = req.params;
  const product = await getProductById(productId);
  res.json(product || { message: "Product not found" });
});

/**
 * Retrieves all products from the cache or database.
 * @returns {Promise<Product[]>} A promise that resolves to an array of all products.
 */
async function getAllProducts(): Promise<Product[]> {
  let products: Product[] | undefined = (await get("products")) as Product[];
  return products || [];
}

/**
 * Fetches a product by its ID from the cache or database.
 * @param {string} productId - The ID of the product to fetch.
 * @returns {Promise<Product | null>} A promise that resolves to the product object or null if not found.
 */
async function getProductById(productId: string): Promise<Product | null> {
  const products = await getAllProducts();
  return (
    products.find((product: Product) => product.productId === productId) || null
  );
}

export default router;
