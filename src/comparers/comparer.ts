import { Price } from "../models/Price";
import { PriceChange } from "../models/PriceChange"; // Assuming PriceChange attributes are defined
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

  progressBar.start(laterList.length, 0);

  const processPriceChange = (
    priceChange: Partial<PriceChange>,
    existingPriceChange: PriceChange | undefined
  ) => {
    if (existingPriceChange) {
      updatedPriceChanges.push(priceChange);
    } else {
      newPriceChanges.push(priceChange);
    }
  };

  for (const laterPrice of laterList) {
    const earlierPrice = earlierPriceMap.get(laterPrice.productId);
    const existingPriceChangeP1 = existingPriceChangeMap.get(
      `${laterPrice.productId}-P1`
    );
    const existingPriceChangeP2 = existingPriceChangeMap.get(
      `${laterPrice.productId}-P2`
    );

    // P1 (basicPrice) comparison
    if (laterPrice.basicPrice) {
      if (earlierPrice && laterPrice.basicPrice !== earlierPrice.basicPrice) {
        const change = laterPrice.basicPrice - earlierPrice.basicPrice;
        const priceChangeData: Partial<PriceChange> = {
          productId: laterPrice.productId,
          priceChange: change,
          priceChangePercentage:
            earlierPrice.basicPrice > 0 ? change / earlierPrice.basicPrice : 0,
          involvesPromotion: Boolean(laterPrice.isPromoActive),
          oldPrice: earlierPrice.basicPrice,
          newprice: laterPrice.basicPrice,
          priceChangeType: "P1",
        };
        processPriceChange(priceChangeData, existingPriceChangeP1);
      } else if (!earlierPrice || !existingPriceChangeP1) {
        // New product or no existing price change record
        const priceChangeData: Partial<PriceChange> = {
          productId: laterPrice.productId,
          priceChange: 0,
          priceChangePercentage: 0,
          involvesPromotion: Boolean(laterPrice.isPromoActive),
          oldPrice: laterPrice.basicPrice,
          newprice: laterPrice.basicPrice,
          priceChangeType: "P1",
        };
        processPriceChange(priceChangeData, existingPriceChangeP1);
      }
    }

    // P2 (quantityPrice) comparison
    if (laterPrice.quantityPrice) {
      const oldPriceForP2 =
        earlierPrice?.quantityPrice || earlierPrice?.basicPrice;

      if (earlierPrice && oldPriceForP2) {
        if (laterPrice.quantityPrice !== oldPriceForP2) {
          const change = laterPrice.quantityPrice - oldPriceForP2;
          const priceChangeData: Partial<PriceChange> = {
            productId: laterPrice.productId,
            priceChange: change,
            priceChangePercentage:
              oldPriceForP2 > 0 ? change / oldPriceForP2 : 0,
            involvesPromotion: Boolean(laterPrice.isPromoActive),
            oldPrice: oldPriceForP2,
            newprice: laterPrice.quantityPrice,
            priceChangeType: "P2",
          };
          processPriceChange(priceChangeData, existingPriceChangeP2);
        }
      } else if (!earlierPrice || !existingPriceChangeP2) {
        // New product with a P2 price, or no existing price change record
        const priceChangeData: Partial<PriceChange> = {
          productId: laterPrice.productId,
          priceChange: 0,
          priceChangePercentage: 0,
          involvesPromotion: Boolean(laterPrice.isPromoActive),
          oldPrice: laterPrice.quantityPrice,
          newprice: laterPrice.quantityPrice,
          priceChangeType: "P2",
        };
        processPriceChange(priceChangeData, existingPriceChangeP2);
      }
    }

    progressBar.increment();
  }
  progressBar.stop();
  console.log("==========   Done Comparing     ==========");

  return { updatedPriceChanges, newPriceChanges };
}
