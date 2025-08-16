/**
 * @fileoverview This file defines the routes for handling promotion-related operations in the application.
 * It includes routes for fetching a promotion by its ID and retrieving all promotions with pagination.
 */

import { Router } from "express";
import { Product } from "../models/Product";
import { get, put } from "memory-cache";
import { Promotion } from "../models/Promotion";
import { Benefit } from "../models/Benefit";
import { Op } from "sequelize";
import { PromotionText } from "../models/PromotionText";
import { Price } from "../models/Price";
import { PriceChange } from "../models/PriceChange";

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
  // Sort benefits by minLimit, benefitAmount, and benefitPercentage
  if (promotion)
    promotion.benefits = promotion.benefits.sort((a: Benefit, b: Benefit) => {
      return (
        a.minLimit - b.minLimit ||
        a.benefitAmount - b.benefitAmount ||
        a.benefitPercentage - b.benefitPercentage ||
        0
      );
    });
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
  const { size = 50, page = 1, order = "benefit", sort = "desc" } = req.query;
  const pageSize = parseInt(size as string, 10);
  const pageNumber = parseInt(page as string, 10);

  const allPromotions = await getAllPromotions();

  const filteredPromotions = allPromotions.sort(
    (a: Promotion, b: Promotion) => {
      // If a promotion has no benefits, it should come last
      if (a.benefits === undefined || a.benefits.length === 0) {
        return -1;
      } else if (b.benefits === undefined || b.benefits.length === 0) {
        return 1;
      }

      // If one promotion has a benefit amount and the other has a benefit percentage, sort by type
      if (a.benefits[0]?.benefitAmount && b.benefits[0]?.benefitPercentage) {
        return sort === "asc" ? -1 : 1;
      } else if (
        a.benefits[0]?.benefitPercentage &&
        b.benefits[0]?.benefitAmount
      ) {
        return sort === "asc" ? 1 : -1;
      }

      // If both promotions have a benefit amount or percentage, sort by the benefit value
      let aBenefit =
        a.benefits[0]?.benefitAmount || a.benefits[0]?.benefitPercentage;
      let bBenefit =
        b.benefits[0]?.benefitAmount || b.benefits[0]?.benefitPercentage;
      if (order === "benefit") {
        return sort === "asc" ? aBenefit - bBenefit : bBenefit - aBenefit;
      } else {
        return 0;
      }
    }
  );

  const paginatedPromotions = filteredPromotions.slice(
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
    promotions = await Promotion.findAll({
      include: [
        {
          model: Benefit,
          order: [["minLimit", "asc"]],
        },
        PromotionText,
        {
          model: Product,
          as: "products",
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
          through: { attributes: [] },
        },
      ],
      where: { linkedTechnicalArticleNumber: { [Op.not]: null } },
    });
    promotions = promotions.filter(
      (promotion: Promotion) => promotion.products.length > 0
    );
    put("promotions", promotions, 3600000);
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
        {
          model: Benefit,
          order: [
            ["benefitAmount", "asc"],
            ["benefitPercentage", "asc"],
            ["minLimit", "asc"],
          ],
        },
        PromotionText,
        {
          model: Product,
          as: "products",
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
          through: { attributes: [] },
        },
      ],
    }
  );
}

export default router;
