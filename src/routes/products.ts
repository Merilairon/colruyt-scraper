/**
 * @fileoverview This file defines the routes for handling product-related operations in the application.
 * It includes routes for fetching a product by its ID, searching products by name and availability,
 * and retrieving all products with pagination and availability filtering.
 */

//TODO: add openapi documentation for swagger

import { Router } from "express";
import { Product } from "../models/Product";
import { get, put } from "memory-cache";
import { Price } from "../models/Price";

const router = Router();
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
 * Route to search products by name and availability.
 * @name GET /search/:name
 * @param {string} name - The name of the product to search for.
 * @param {boolean} [isAvailable] - Optional availability filter.
 * @returns {Object} An object containing the total number of products and the list of products.
 */
router.get("/search/:name", async (req, res) => {
  const { name } = req.params;
  const { isAvailable } = req.query;
  const products = await searchProductsByNameAndAvailability(
    name,
    isAvailable ? isAvailable === "true" : undefined
  );
  res.json({
    total: products.length,
    products: products,
  });
});

/**
 * Route to get all products in a collection with pagination and availability filter.
 * @name GET /
 * @param {number} [size=50] - The number of products per page.
 * @param {number} [page=1] - The page number to retrieve.
 * @param {boolean} [isAvailable] - Optional availability filter.
 * @returns {Object} An object containing the page number, page size, total number of products, and the list of products.
 */
router.get("/", async (req, res) => {
  const { size = 50, page = 1, isAvailable } = req.query;
  const pageSize = parseInt(size as string, 10);
  const pageNumber = parseInt(page as string, 10);

  const allProducts = await getAllProducts();
  const filteredProducts = allProducts.filter((product: Product) => {
    return (
      isAvailable === undefined ||
      product.isAvailable === (isAvailable === "true")
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
 * Searches products by name and availability.
 * @param {string} name - The name of the product to search for.
 * @param {boolean} [isAvailable] - Optional availability filter.
 * @returns {Promise<Product[]>} A promise that resolves to an array of products matching the search criteria.
 */
async function searchProductsByNameAndAvailability(
  name: string,
  isAvailable?: boolean
): Promise<Product[]> {
  const products = await getAllProducts();
  return products.filter((product: Product) => {
    const matchesName = product.LongName.toLowerCase().includes(
      name.toLowerCase()
    );
    const matchesAvailability =
      isAvailable === undefined || product.isAvailable === isAvailable;
    return matchesName && matchesAvailability;
  });
}

/**
 * Retrieves all products from the cache or database.
 * @returns {Promise<Product[]>} A promise that resolves to an array of all products.
 */
async function getAllProducts(): Promise<Product[]> {
  let products = get("products");
  if (!products) {
    products = Product.findAll({
      include: Price,
      order: [[Price, "date", "desc"]], //order most recent price first
      logging: false,
    });
    put("products", products);
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
  return products.find((product: Product) => product.productId === productId);
}

export default router;
