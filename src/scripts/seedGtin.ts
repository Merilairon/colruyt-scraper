import "dotenv/config";
import { getAllProducts } from "../scrapers/productScraper";
import { sequelize } from "../database";
import { Product } from "../models/Product";

/**
 * One-off script to backfill the `GTIN` (barcode) field for products that
 * already exist in the database, without re-scraping any product-info pages.
 *
 * The Colruyt product API (already used by `getAllProducts`) returns the
 * `GTIN` field for every product, so this script simply re-fetches the
 * product list and updates only the `GTIN` column for existing rows.
 */
async function seedGtin() {
  console.log("==========   Seeding GTIN field   ==========");

  try {
    await sequelize.authenticate();

    const apiProducts = await getAllProducts();

    // De-duplicate products by productId, same as the regular scraper does.
    const uniqueProducts = Array.from(
      new Map(apiProducts.map((p) => [p.productId, p])).values()
    );

    await Product.bulkCreate(uniqueProducts, {
      updateOnDuplicate: ["GTIN"],
    });

    console.log(
      `==========   Seeded GTIN for ${uniqueProducts.length} products   ==========`
    );
  } catch (error) {
    console.error(`Error seeding GTIN: ${error.message}`);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

seedGtin();
