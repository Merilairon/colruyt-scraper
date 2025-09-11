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
import { Op, Transaction } from "sequelize";

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
async function saveProducts(apiProducts: any[], transaction: Transaction) {
  console.log("==========     Saving Products     ==========");

  // De-duplicate products by productId to prevent "ON CONFLICT" errors.
  const uniqueProducts = Array.from(
    new Map(apiProducts.map((p) => [p.productId, p])).values()
  );

  // Upsert products to handle new and updated ones.
  await Product.bulkCreate(uniqueProducts, {
    updateOnDuplicate: Object.keys(Product.getAttributes()),
    transaction,
  });

  await Price.bulkCreate(
    uniqueProducts.map((p) => ({
      productId: p.productId,
      ...p.price,
    })),
    { ignoreDuplicates: true, transaction } // Ignore if a price for this product on this day already exists.
  );
}

/**
 * Removes products and promotions from the database that are no longer available in the API.
 * This prevents the database from growing with stale data.
 * @param apiProducts The list of products currently available from the API.
 * @param apiPromotions The list of promotions currently available from the API.
 */
async function handleStaleData(
  apiProducts: any[],
  apiPromotions: any[],
  transaction: Transaction
) {
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
      transaction,
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
      transaction,
    });
  } else {
    console.log("No stale promotions found.");
  }

  // 3. Handle stale prices (older than 90 days)
  const XDaysAgo = new Date();
  XDaysAgo.setDate(
    XDaysAgo.getDate() -
      (Number.parseInt(process.env.AMOUNT_OF_DAYS_KEPT) || 90)
  );

  const oldPricesCount = await Price.destroy({
    where: {
      date: {
        [Op.lt]: XDaysAgo,
      },
    },
    transaction,
  });

  if (oldPricesCount > 0) {
    console.log(`Removed ${oldPricesCount} prices older than 90 days.`);
  } else {
    console.log("No old prices to remove.");
  }
}

/**
 * Saves promotions to the database.
 */
async function savePromotions(
  apiPromotions: any[],
  apiProducts: any[],
  transaction: Transaction
) {
  console.log("==========     Saving Promotions     ==========");

  // De-duplicate promotions by promotionId to prevent "ON CONFLICT" errors.
  const uniquePromotions = Array.from(
    new Map(apiPromotions.map((p) => [p.promotionId, p])).values()
  );

  // Upsert promotions to handle new and updated ones.
  await Promotion.bulkCreate(uniquePromotions, {
    updateOnDuplicate: Object.keys(Promotion.getAttributes()),
    transaction,
  });

  // For the promotions we are processing, we'll clear their old associations
  // and bulk-insert the new ones. This is more efficient than a per-promotion update.
  const apiPromotionIds = uniquePromotions.map((p) => p.promotionId);
  if (apiPromotionIds.length > 0) {
    const destroyOptions = {
      where: { promotionId: { [Op.in]: apiPromotionIds } },
      transaction,
    };
    await Promise.all([
      PromotionProduct.destroy(destroyOptions),
      Benefit.destroy(destroyOptions),
      PromotionText.destroy(destroyOptions),
    ]);
  }

  const apiPromotionProducts = [];
  const apiBenefits = [];
  const apiTexts = [];

  for (const promotion of uniquePromotions) {
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
    transaction,
  });
  await Benefit.bulkCreate(apiBenefits, {
    ignoreDuplicates: true,
    transaction,
  });
  await PromotionText.bulkCreate(apiTexts, {
    ignoreDuplicates: true,
    transaction,
  });
}

/**
 * The scraper function that executes the program logic.
 */
export async function scraper() {
  console.log("==========   Starting Scraper   ==========");
  try {
    const apiProducts = await getAllProducts();
    const apiPromotions = await getAllPromotions();

    await connectToDatabase();

    await sequelize.transaction(async (t) => {
      await handleStaleData(apiProducts, apiPromotions, t);
      await saveProducts(apiProducts, t);
      await savePromotions(apiPromotions, apiProducts, t);
    });

    console.log("==========     Done Saving      ==========");
  } catch (error) {
    console.error(`Error: ${error.message}`);
    console.error(error.errors);
  }
}
