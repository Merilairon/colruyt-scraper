/**
 * @fileoverview This file defines the routes for handling promotion-related operations in the application.
 * It includes routes for fetching a promotion by its ID and retrieving all promotions with pagination.
 */

import { Router } from "express";
import { Product } from "../models/Product";
import { get, put } from "memory-cache";
import { Promotion } from "../models/Promotion";
import { Benefit } from "../models/Benefit";
import { PromotionProduct } from "../models/PromotionProduct";
import { Op } from "sequelize";

const router = Router();

/**
 * Route to fetch a promotion by its ID.
 * @name GET /:promotionId
 * @function
 * @memberof module:routes/promotions
 * @param {string} promotionId - The ID of the promotion to fetch.
 * @returns {Object} The promotion object or a message indicating that the promotion was not found.
 */
router.get("/:promotionId", async (req, res) => {
  const { promotionId } = req.params;
  const promotion = await getPromotionById(promotionId);
  res.json(promotion || { message: "Promotion not found" });
});

/**
 * Route to fetch all promotions with pagination.
 * @name GET /
 * @function
 * @memberof module:routes/promotions
 * @param {number} [size=50] - The number of promotions per page.
 * @param {number} [page=1] - The page number to fetch.
 * @returns {Object} An object containing the current page, page size, total promotions, and the list of promotions.
 */
router.get("/", async (req, res) => {
  const { size = 50, page = 1 } = req.query;
  const pageSize = parseInt(size as string, 10);
  const pageNumber = parseInt(page as string, 10);

  const allPromotions = await getAllPromotions();

  const paginatedPromotions = allPromotions.slice(
    (pageNumber - 1) * pageSize,
    pageNumber * pageSize
  );

  res.json({
    page: pageNumber,
    size: pageSize,
    total: allPromotions.length,
    promotions: paginatedPromotions,
  });
});

/**
 * Fetches all promotions from the cache or database.
 * @async
 * @function
 * @returns {Promise<Promotion[]>} A promise that resolves to an array of promotions.
 */
async function getAllPromotions(): Promise<Promotion[]> {
  let promotions = get("promotions");
  if (!promotions) {
    promotions = Promotion.findAll({
      //include: [{ all: true, nested: true }],
      include: [
        Benefit,
        { model: Product, as: "products", through: { attributes: [] } },
      ],
      where: { linkedTechnicalArticleNumber: { [Op.not]: null } },
      logging: false,
    });
    put("promotions", promotions);
  }
  return promotions;
}

/**
 * Fetches a promotion by its ID from the cache or database.
 * @async
 * @function
 * @param {string} promotionId - The ID of the promotion to fetch.
 * @returns {Promise<Promotion | null>} A promise that resolves to the promotion object or null if not found.
 */
async function getPromotionById(
  promotionId: string
): Promise<Promotion | null> {
  const promotions = await getAllPromotions();
  return promotions.find(
    (promotion: Promotion) => promotion.promotionId === promotionId,
    {
      include: [
        Benefit,
        { model: Product, as: "products", through: { attributes: [] } },
      ],
      logging: false,
    }
  );
}

export default router;
