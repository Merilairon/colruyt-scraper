/**
 * @fileoverview This file defines the routes for handling product-related operations in the application.
 * It includes routes for fetching a product by its ID, searching products by name and availability,
 * and retrieving all products with pagination and availability filtering.
 */

import { Router } from "express";
import { Product } from "../models/Product";
import { get, put } from "memory-cache";
import { Price } from "../models/Price";
import { Op } from "sequelize";
import { PriceChange } from "../models/PriceChange";
import Fuse from "fuse.js";

const router = Router();

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
  const { size = 50, page = 1, isAvailable, search, favourites } = req.query;
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
      productsToFilter = fuse.search(searchQuery).map((result) => result.item);
    }

    // Filter by availability
    filteredProducts = productsToFilter.filter(
      (product) =>
        isAvailable === undefined ||
        product.isAvailable === (isAvailable === "true")
    );
  }

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

//TODO: add interesting changes to the product route

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
  let products: Product[] | undefined = get("products");
  if (!products) {
    products = await Product.findAll({
      include: [
        {
          model: Price,
          where: {
            date: {
              [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
            }, //Only get products with a price
            basicPrice: {
              [Op.not]: null,
            },
          },
        },
        {
          model: PriceChange,
        },
      ],
      order: [[Price, "date", "DESC"]],
    });
    put("products", products, 3600000);
  }
  return products;
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
