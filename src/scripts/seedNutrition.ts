import "dotenv/config";
import { Op } from "sequelize";
import { sequelize, authenticateWithRetry } from "../database";
import { Product } from "../models/Product";
import { Nutrition } from "../models/Nutrition";
import { enrichProductsWithNutrition } from "../scrapers/nutritionScraper";

/**
 * One-off script to backfill the Nutrition table for products that already
 * exist in the database and have at least one GTIN, but do not yet have a
 * nutrition record. Existing Nutrition rows are skipped.
 */
async function seedNutrition() {
  console.log("==========   Seeding nutrition data   ==========");
  try {
    await authenticateWithRetry();

    const enrichedIds = (
      await Nutrition.findAll({ attributes: ["productId"] })
    ).map((n) => n.productId);

    const productsToEnrich = await Product.findAll({
      where: {
        productId: { [Op.notIn]: enrichedIds },
        gtin: { [Op.ne]: null },
      },
    });

    if (productsToEnrich.length === 0) {
      console.log("No products need nutrition enrichment.");
      return;
    }

    console.log(
      `Found ${productsToEnrich.length} products without nutrition data.`,
    );

    await enrichProductsWithNutrition(productsToEnrich);

    console.log(
      `==========   Seeded nutrition for up to ${productsToEnrich.length} products   ==========`,
    );
  } catch (error) {
    console.error(`Error seeding nutrition: ${(error as Error).message}`);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

seedNutrition();
