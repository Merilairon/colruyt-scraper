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
import { Op } from "sequelize";

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
  // Upsert products to handle new and updated ones.
  await Product.bulkCreate(apiProducts, {
    updateOnDuplicate: Object.keys(Product.getAttributes()),
  });
  await Price.bulkCreate(
    apiProducts.map((p) => ({
      productId: p.productId,
      ...p.price,
    })),
    { ignoreDuplicates: true } // Ignore if a price for this product on this day already exists.
  );
}

/**
 * Removes products and promotions from the database that are no longer available in the API.
 * This prevents the database from growing with stale data.
 * @param apiProducts The list of products currently available from the API.
 * @param apiPromotions The list of promotions currently available from the API.
 */
async function handleStaleData(apiProducts: any[], apiPromotions: any[]) {
  console.log("==========     Checking for stale data     ==========");

  // 1. Handle stale products
  const allDbProducts = await Product.findAll({ attributes: ["productId"] });
  const dbProductIds = new Set(allDbProducts.map((p) => p.productId));
  const apiProductIds = new Set(apiProducts.map((p) => p.productId));

  const productsToRemove = [...dbProductIds].filter(
    (id) => !apiProductIds.has(id)
  );

  if (productsToRemove.length > 0) {
    console.log(`Found ${productsToRemove.length} stale products to remove.`);
    // Assuming Product model has cascade delete for its associations (Price, PriceChange, etc.)
    await Product.destroy({
      where: {
        productId: {
          [Op.in]: productsToRemove,
        },
      },
    });
  } else {
    console.log("No stale products found.");
  }

  // 2. Handle stale promotions
  const allDbPromotions = await Promotion.findAll({
    attributes: ["promotionId"],
  });
  const dbPromotionIds = new Set(allDbPromotions.map((p) => p.promotionId));
  const apiPromotionIds = new Set(apiPromotions.map((p) => p.promotionId));

  const promotionsToRemove = [...dbPromotionIds].filter(
    (id) => !apiPromotionIds.has(id)
  );

  if (promotionsToRemove.length > 0) {
    console.log(
      `Found ${promotionsToRemove.length} stale promotions to remove.`
    );
    // Assuming Promotion model has cascade delete for its associations
    await Promotion.destroy({
      where: {
        promotionId: {
          [Op.in]: promotionsToRemove,
        },
      },
    });
  } else {
    console.log("No stale promotions found.");
  }
}

/**
 * Saves promotions to the database.
 */
async function savePromotions(apiPromotions, apiProducts) {
  console.log("==========     Saving Promotions     ==========");
  // Upsert promotions to handle new and updated ones.
  await Promotion.bulkCreate(apiPromotions, {
    updateOnDuplicate: Object.keys(Promotion.getAttributes()),
  });

  // For the promotions we are processing, we'll clear their old associations
  // and bulk-insert the new ones. This is more efficient than a per-promotion update.
  const apiPromotionIds = apiPromotions.map((p) => p.promotionId);
  if (apiPromotionIds.length > 0) {
    await PromotionProduct.destroy({
      where: { promotionId: { [Op.in]: apiPromotionIds } },
    });
    await Benefit.destroy({
      where: { promotionId: { [Op.in]: apiPromotionIds } },
    });
    await PromotionText.destroy({
      where: { promotionId: { [Op.in]: apiPromotionIds } },
    });
  }

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
    await handleStaleData(apiProducts, apiPromotions);
    await saveProducts(apiProducts);
    await savePromotions(apiPromotions, apiProducts);

    console.log("==========     Done Saving      ==========");
  } catch (error) {
    console.error(`Error: ${error.message}`);
    console.error(error.errors);
  }
}
