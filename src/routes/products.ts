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
import { Op, where } from "sequelize";
import { PriceChange } from "../models/PriceChange";

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
 * Route to get all products in a collection with pagination and availability filter.
 * @name GET /
 * @param {number} [size=50] - The number of products per page.
 * @param {number} [page=1] - The page number to retrieve.
 * @param {boolean} [isAvailable] - Optional availability filter.
 * @param {string} [search] - Optional search filter.
 * @returns {Object} An object containing the page number, page size, total number of products, and the list of products.
 */
router.get("/", async (req, res) => {
  const { size = 50, page = 1, isAvailable, search } = req.query;
  const pageSize = parseInt(size as string, 10);
  const pageNumber = parseInt(page as string, 10);
  const searchQuery = search as string;

  const allProducts = await getAllProducts();
  const filteredProducts = allProducts.filter((product: Product) => {
    return search
      ? product.LongName.toLowerCase().includes(searchQuery.toLowerCase())
      : true &&
          (isAvailable === undefined ||
            product.isAvailable === (isAvailable === "true"));
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
 * Retrieves all products from the cache or database.
 * @returns {Promise<Product[]>} A promise that resolves to an array of all products.
 */
async function getAllProducts(): Promise<Product[]> {
  let products = get("products");
  if (!products) {
    products = Product.findAll({
      include: [
        {
          model: Price,
          where: {
            date: {
              [Op.gte]: new Date().getTime() - 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
            }, //Only get products with a price
            basicPrice: {
              [Op.not]: null,
            },
          },
          order: ["date", "desc"],
        },
        {
          model: PriceChange,
        },
      ],
      order: [[Price, "date", "desc"]],
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
  return products.find((product: Product) => product.productId === productId, {
    include: [
      {
        model: Price,
        where: {
          date: {
            [Op.gte]: new Date().getTime() - 30 * 24 * 60 * 60 * 1000, // 30 days in milliseconds
          },
        },
        order: ["date", "desc"],
      },
      {
        model: PriceChange,
      },
    ],
    order: [[Price, "date", "desc"]],
  });
}

export default router;
