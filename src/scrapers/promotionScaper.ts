import { Promotion } from "../models/Promotion";
import { RequestHandler } from "../utils/RequestHandler";

const requestHandler = RequestHandler.instance;

/**
 * Fetches all promotions by making a proxied request to the specified product URL.
 *
 * @returns {Promise<any[]>} A promise that resolves to an array of promotion objects.
 *
 * @example
 * ```typescript
 * getAllPromotions().then(promotions => {
 *   console.log(promotions);
 * });
 * ```
 *
 * @throws Will throw an error if the request fails.
 */
export async function getAllPromotions() {
  console.log("==========     Scraping promotions...     ==========");

  // Initialize an array to store the product data.
  const { promotions } = await requestHandler.proxiedRequest(
    process.env.PROMOTION_URL,
    {},
    {
      clientCode: "CLP",
      placeId: process.env.PLACE_ID,
    }
  );
  7;

  console.log("==========     Scraping done!     ==========");
  console.log(`Total promotions scraped: ${promotions.length}`);
  return promotions as Promotion[];
}
