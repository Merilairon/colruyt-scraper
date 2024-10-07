import { PriceDifference } from "../models/PriceDifference";
import { Product } from "../models/Product";
import { SingleBar, Presets } from "cli-progress";

const progressBar = new SingleBar({}, Presets.shades_classic);

/**
 * Compares the prices of products between two lists and categorizes the differences into increases and decreases.
 *
 * @param {Product[]} earlierList - The list of products with earlier prices.
 * @param {Product[]} laterList - The list of products with later prices.
 * @returns {Promise<{ increases: PriceDifference[], decreases: PriceDifference[] }>} - An object containing two arrays: one for price increases and one for price decreases.
 *
 * @example
 * const earlierList = [{ id: 1, price: 100 }, { id: 2, price: 200 }];
 * const laterList = [{ id: 1, price: 110 }, { id: 2, price: 190 }];
 * const result = await getPriceDifference(earlierList, laterList);
 * console.log(result.increases); // [{ id: 1, priceChangePercentage: 0.1 }]
 * console.log(result.decreases); // [{ id: 2, priceChangePercentage: -0.05 }]
 */
export async function getPriceDifference(
  earlierList: Product[],
  laterList: Product[]
) {
  console.log("==========   Comparing Data     ==========");
  let differences: PriceDifference[] = await compare(earlierList, laterList);
  let increases: PriceDifference[] = [];
  let decreases: PriceDifference[] = [];
  differences.forEach((difference) => {
    if (difference.priceChangePercentage >= 0.01) {
      increases.push(difference);
    } else {
      decreases.push(difference);
    }
  });
  console.log("==========   Done Comparing     ==========");
  return { increases, decreases };
}

/**
 * Compares two lists of products and identifies the price differences between them.
 *
 * @param earlierList - The list of products from an earlier time.
 * @param laterList - The list of products from a later time.
 * @returns A list of price differences for products whose prices have changed.
 *
 * @remarks
 * This function iterates over the `laterList` and finds the corresponding product in the `earlierList`
 * by matching the `commercialArticleNumber`. If the basic price of the product has changed, it calculates
 * the price difference and the percentage change, then stores this information in the `differences` array.
 *
 * @example
 * ```typescript
 * const earlierList: Product[] = [...];
 * const laterList: Product[] = [...];
 * const differences = await compare(earlierList, laterList);
 * console.log(differences);
 * ```
 */
async function compare(earlierList: Product[], laterList: Product[]) {
  let differences: PriceDifference[] = [];

  progressBar.start(laterList.length, 0);

  // Compare the two lists of products and return the price difference.
  laterList.forEach((laterProduct) => {
    // Find the corresponding product in the earlier list.
    const earlierProduct = earlierList.find(
      (earlierProduct) =>
        earlierProduct.commercialArticleNumber ===
        laterProduct.commercialArticleNumber
    );
    // If the earlier product exists and the basic price has changed, calculate the price difference.
    if (
      earlierProduct &&
      laterProduct.price?.basicPrice !== earlierProduct.price?.basicPrice
    ) {
      let change =
        laterProduct.price?.basicPrice - earlierProduct.price?.basicPrice;
      differences.push({
        longName: laterProduct.longName,
        priceChange: change,
        priceChangePercentage: change / earlierProduct.price?.basicPrice,
        oldPrice: earlierProduct.price,
        price: laterProduct.price,
        product: laterProduct,
      } as PriceDifference);
    }
    progressBar.increment();
  });

  progressBar.stop();

  return differences;
}
