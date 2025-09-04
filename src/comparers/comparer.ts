import { Price } from "../models/Price";
import { PriceChange, PriceChangeType } from "../models/PriceChange"; // Assuming PriceChange attributes are defined
import { SingleBar, Presets } from "cli-progress";

const progressBar = new SingleBar({}, Presets.shades_classic);
/**
 * Compares the prices of products between two lists and categorizes the differences into updates and new changes.
 *
 * @param {Product[]} earlierList - The list of products with earlier prices.
 * @param {Product[]} laterList - The list of products with later prices.
 * @returns {Promise<{ updatedPriceChanges: PriceChange[], newPriceChanges: PriceChange[] }>} - The two lists in a promise, one for updates the other for new changes
 *
 * @example
 * const earlierList = [{ id: 1, price: 100 }, { id: 2, price: 200 }];
 * const laterList = [{ id: 1, price: 110 }, { id: 2, price: 190 }];
 * const laterList = [{ id: 1, price: 110 }, { id: 2, price: 190 }, ...];
 * const result = await getPriceChange(earlierList, laterList, priceChanges);
 * console.log(result.updatedPriceChanges); // [{ id: 1, priceChangePercentage: 0.1 }]
 * console.log(result.PriceChange); // [{ id: 2, priceChangePercentage: -0.05 }]
 */
export async function getPriceChange(
  earlierList: Price[],
  laterList: Price[],
  priceChanges: PriceChange[]
): Promise<{
  updatedPriceChanges: Partial<PriceChange>[];
  newPriceChanges: Partial<PriceChange>[];
}> {
  console.log("==========   Comparing Data     ==========");
  const updatedPriceChanges: Partial<PriceChange>[] = [];
  const newPriceChanges: Partial<PriceChange>[] = [];

  // Create maps for efficient lookups
  const earlierPriceMap = new Map(
    earlierList.map((price) => [price.productId, price])
  );
  const existingPriceChangeMap = new Map(
    priceChanges.map((pc) => [`${pc.productId}-${pc.priceChangeType}`, pc])
  );

  /**
   * Processes a single price type (P1 or P2) for a given product.
   */
  const processSinglePriceType = (
    laterPrice: Price,
    priceType: PriceChangeType,
    newPrice: number,
    oldPrice?: number
  ) => {
    const existingPriceChange = existingPriceChangeMap.get(
      `${laterPrice.productId}-${priceType}`
    );
    const earlierPrice = earlierPriceMap.get(laterPrice.productId);

    // Determine if a change record should be created
    const hasPriceChanged = oldPrice !== undefined && newPrice !== oldPrice;
    const isNewRecord = !earlierPrice || !existingPriceChange;

    if (hasPriceChanged || isNewRecord) {
      const change = hasPriceChanged ? newPrice - (oldPrice ?? 0) : 0;
      const percentage =
        hasPriceChanged && oldPrice && oldPrice > 0 ? change / oldPrice : 0;

      const priceChangeData: Partial<PriceChange> = {
        productId: laterPrice.productId,
        priceChange: change,
        priceChangePercentage: percentage,
        involvesPromotion: Boolean(laterPrice.isPromoActive),
        oldPrice: oldPrice ?? newPrice,
        newprice: newPrice,
        priceChangeType: priceType,
      };

      if (existingPriceChange) {
        updatedPriceChanges.push(priceChangeData);
      } else {
        newPriceChanges.push(priceChangeData);
      }
    }
  };

  progressBar.start(laterList.length, 0);

  for (const laterPrice of laterList) {
    const earlierPrice = earlierPriceMap.get(laterPrice.productId);

    // P1 (basicPrice) comparison
    if (laterPrice.basicPrice) {
      processSinglePriceType(
        laterPrice,
        PriceChangeType.BASIC,
        laterPrice.basicPrice,
        earlierPrice?.basicPrice
      );
    }

    // P2 (quantityPrice) comparison
    if (laterPrice.quantityPrice) {
      const oldPriceForP2 =
        earlierPrice?.quantityPrice ?? earlierPrice?.basicPrice;
      processSinglePriceType(
        laterPrice,
        PriceChangeType.QUANTITY,
        laterPrice.quantityPrice,
        oldPriceForP2
      );
    }

    progressBar.increment();
  }
  progressBar.stop();
  console.log("==========   Done Comparing     ==========");

  return { updatedPriceChanges, newPriceChanges };
}
