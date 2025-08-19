import "dotenv/config";
import { getAllProducts } from "./scrapers/productScraper";
import { getAllPromotions } from "./scrapers/promotionScaper";
import { sequelize } from "./database";
import { Product } from "./models/Product";
import { Price } from "./models/Price";
import { Promotion } from "./models/Promotion";
import { Benefit } from "./models/Benefit";
import { PromotionProduct } from "./models/PromotionProduct";
import { PromotionText } from "./models/PromotionText";

/**
 * Connects to the database and syncs the models.
 */
async function connectToDatabase() {
  console.log("==========   Connecting to DB   ==========");
  await sequelize.authenticate();
  await sequelize.sync();
  console.log("==========     DB Connected     ==========");
}

/**
 * Saves products and prices to the database.
 */
async function saveProducts(apiProducts) {
  console.log("==========     Saving Products     ==========");
  await Product.bulkCreate(apiProducts, { ignoreDuplicates: true });
  await Price.bulkCreate(
    apiProducts.map((p) => ({
      productId: p.productId,
      ...p.price,
    }))
  );
}

/**
 * Clears existing promotions and benefits from the database.
 */
//TODO do a daily check for removed products and promotions and remove them from the db
async function clearPromotionsAndBenefits() {
  console.log("==========     Clearing Promotions and Benefits     ==========");
  await Promotion.destroy({
    where: {},
    cascade: true,
    truncate: true,
    restartIdentity: true,
  });
  await PromotionProduct.destroy({
    where: {},
    cascade: true,
    truncate: true,
    restartIdentity: true,
  });
  await Benefit.destroy({
    where: {},
    cascade: true,
    truncate: true,
    restartIdentity: true,
  });
  await PromotionText.destroy({
    where: {},
    cascade: true,
    truncate: true,
    restartIdentity: true,
  });
}

/**
 * Saves promotions to the database.
 */
async function savePromotions(apiPromotions, apiProducts) {
  console.log("==========     Saving Promotions     ==========");
  await Promotion.bulkCreate(apiPromotions, { ignoreDuplicates: true });

  const apiPromotionProducts = [];
  const apiBenefits = [];
  const apiTexts = [];

  for (const promotion of apiPromotions) {
    if (promotion.linkedTechnicalArticleNumber) {
      const linkedTechnicalArticleNumbers =
        promotion.linkedTechnicalArticleNumber
          .split(",")
          .map((id) => id.trim());
      const productIds = linkedTechnicalArticleNumbers
        .map((tan) => {
          const product = apiProducts.find(
            (p) => p.technicalArticleNumber === tan
          );
          return product ? product.productId : null;
        })
        .filter(Boolean);

      for (const productId of productIds) {
        apiPromotionProducts.push({
          promotionId: promotion.promotionId,
          productId,
        });
      }
    }

    if (promotion.benefit) {
      for (const benefit of promotion.benefit) {
        apiBenefits.push({ promotionId: promotion.promotionId, ...benefit });
      }
    }

    if (promotion.text) {
      for (const text of promotion.text) {
        apiTexts.push({ promotionId: promotion.promotionId, ...text });
      }
    }
  }

  await PromotionProduct.bulkCreate(apiPromotionProducts, {
    ignoreDuplicates: true,
  });
  await Benefit.bulkCreate(apiBenefits, { ignoreDuplicates: true });
  await PromotionText.bulkCreate(apiTexts, { ignoreDuplicates: true });
}

/**
 * The scraper function that executes the program logic.
 */
export async function scraper() {
  try {
    const apiProducts = await getAllProducts();
    const apiPromotions = await getAllPromotions();

    await connectToDatabase();
    await saveProducts(apiProducts);
    await clearPromotionsAndBenefits();
    await savePromotions(apiPromotions, apiProducts);

    console.log("==========     Done Saving      ==========");
  } catch (error) {
    console.error(`Error: ${error.message}`);
    console.error(error.errors);
  }
}
