import { Price } from "../models/Price";
import { PriceChange } from "../models/PriceChange";
import { SingleBar, Presets } from "cli-progress";

const progressBar = new SingleBar({}, Presets.shades_classic);

/**
 * Compares the prices of products between two lists and categorizes the differences into increases and decreases.
 *
 * @param {Product[]} earlierList - The list of products with earlier prices.
 * @param {Product[]} laterList - The list of products with later prices.
 * @returns {Promise<{ increases: PriceChange[], decreases: PriceChange[] }>} - An object containing two arrays: one for price increases and one for price decreases.
 *
 * @example
 * const earlierList = [{ id: 1, price: 100 }, { id: 2, price: 200 }];
 * const laterList = [{ id: 1, price: 110 }, { id: 2, price: 190 }];
 * const result = await getPriceChange(earlierList, laterList);
 * console.log(result.increases); // [{ id: 1, priceChangePercentage: 0.1 }]
 * console.log(result.decreases); // [{ id: 2, priceChangePercentage: -0.05 }]
 */
export async function getPriceChange(
  earlierList: Price[],
  laterList: Price[],
  priceChanges: PriceChange[]
): Promise<{
  updatedPriceChanges: any[];
  newPriceChanges: any[];
}> {
  console.log("==========   Comparing Data     ==========");
  let updatedPriceChanges: any[] = [];
  let newPriceChanges: any[] = [];

  progressBar.start(laterList.length, 0);
  // Compare the two lists of products and return the price difference.
  laterList.forEach((laterPrice) => {
    // Find the corresponding product in the earlier list.
    const earlierPrice = earlierList.find(
      (earlierPrice) => earlierPrice.productId === laterPrice.productId
    );
    const existingPriceChange = priceChanges.find(
      (pc) => pc.productId === laterPrice.productId
    );
    let priceChange: any;

    // If the earlier product exists and the basic price has changed, calculate the price difference.
    if (earlierPrice && laterPrice.basicPrice !== earlierPrice.basicPrice) {
      let change = laterPrice.basicPrice - earlierPrice.basicPrice; //TODO: maybe change based on sequelize
      priceChange = {
        productId: laterPrice.productId,
        priceChange: change,
        priceChangePercentage: change / earlierPrice.basicPrice,
        involvesPromotion: laterPrice.isPromoActive,
        oldPrice: earlierPrice.basicPrice,
        newprice: laterPrice.basicPrice,
      };
    } else if (
      (!earlierPrice || !existingPriceChange) &&
      laterPrice.basicPrice
    ) {
      // If the earlier price does not exist, create a new price change.
      priceChange = {
        productId: laterPrice.productId,
        priceChange: 0,
        priceChangePercentage: 0,
        involvesPromotion: laterPrice.isPromoActive,
        oldPrice: laterPrice.basicPrice,
        newprice: laterPrice.basicPrice,
      };
    }
    if (priceChange) {
      // If the price change already exists, update it. Otherwise, add it to the new price changes.
      if (existingPriceChange) {
        updatedPriceChanges.push(priceChange);
      } else {
        newPriceChanges.push(priceChange);
      }
    }
    progressBar.increment();
  });
  progressBar.stop();
  console.log("==========   Done Comparing     ==========");

  return { updatedPriceChanges, newPriceChanges };
}
