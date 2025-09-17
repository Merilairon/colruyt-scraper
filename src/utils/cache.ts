import { Product } from "../models/Product";
import { Op } from "sequelize";
import { Price } from "../models/Price";
import { PriceChange } from "../models/PriceChange";
import { Benefit } from "../models/Benefit";
import { Promotion } from "../models/Promotion";
import { PromotionText } from "../models/PromotionText";
import QuickLRU from "quick-lru";
import cron from "node-cron";

type CacheKey = "products" | "promotions";
type CacheValue = Product[] | Promotion[];

const memCache = new QuickLRU({
  maxSize: 10, // We only have a few keys like 'products' and 'promotions'
});

/**
 * Retrieves a value from the cache. If the value is not present,
 * it fetches it from the database, caches it, and returns it.
 * @param key The key to retrieve from the cache ('products' or 'promotions').
 * @returns The cached or freshly fetched data.
 */
export async function get(key: CacheKey): Promise<CacheValue> {
  if (!memCache.has(key)) {
    console.log(`Cache miss for key: ${key}. Fetching from DB.`);
    await refreshCache(key);
  }
  return (memCache.get(key) as CacheValue) || [];
}

/**
 * Stores a value in the cache.
 * @param key The key to store the value under.
 * @param val The value to store.
 */
export function put(key: CacheKey, val: CacheValue): void {
  memCache.set(key, val);
}

/**
 * Refreshes the cache for a given key by fetching data from the database.
 * @param key The cache key to refresh.
 */
async function refreshCache(key: CacheKey) {
  console.log(`Refreshing cache for key: ${key}`);
  switch (key) {
    case "products":
      put("products", await getAllProducts());
      break;
    case "promotions":
      put("promotions", await getAllPromotions());
      break;
  }
}

// Schedule a daily cache refresh at 6:05 AM.
cron.schedule("10 8 * * *", async () => {
  console.log("Running scheduled cache refresh at 8:05 AM...");
  await refreshCache("products");
  await refreshCache("promotions");
  console.log("Scheduled cache refresh finished.");
});

/**
 * Retrieves all products from the database.
 * @returns {Promise<Product[]>} A promise that resolves to an array of all products.
 */
async function getAllProducts(): Promise<Product[]> {
  let products: Product[];
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
        as: "priceChanges",
      },
    ],
    order: [[Price, "date", "DESC"]],
  });
  return products;
}

/**
 * Fetches all promotions from the database.
 * @async
 * @function
 * @returns {Promise<Promotion[]>} A promise that resolves to an array of promotions.
 */
async function getAllPromotions(): Promise<Promotion[]> {
  let promotions: Promotion[];
  promotions = await Promotion.findAll({
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
                //Only get products with a price
                [Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
              },
              basicPrice: {
                [Op.not]: null,
              },
            },
            order: [["date", "DESC"]],
          },
          {
            model: PriceChange,
            as: "priceChanges",
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
  return promotions;
}
