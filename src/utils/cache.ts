import { Product } from "../models/Product";
import { Op } from "sequelize";
import { Price } from "../models/Price";
import { PriceChange } from "../models/PriceChange";
import { Benefit } from "../models/Benefit";
import { Promotion } from "../models/Promotion";
import { PromotionText } from "../models/PromotionText";
import QuickLRU from "quick-lru";

const memCache = new QuickLRU({
  maxAge: 3600000,
  maxSize: 100,
  onEviction: refreshCache,
});

export async function get(
  key: string
): Promise<Product[] | Promotion[] | null> {
  return (await memCache.get(key)) as Product[] | Promotion[] | null;
}
export async function put(
  key: string,
  val: any
): Promise<Product[] | Promotion[] | null> {
  return (await memCache.set(key, val)) as unknown as
    | Product[]
    | Promotion[]
    | null;
}

async function refreshCache(key, value = null) {
  switch (key) {
    case "products":
      await put("products", await getAllProducts());
      break;
    case "promotions":
      await put("promotions", await getAllPromotions());
      break;
  }
}

refreshCache("products");
refreshCache("promotions"); //Refresh at startup

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
