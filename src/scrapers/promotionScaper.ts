import { SingleBar, Presets } from "cli-progress";
import { Promotion } from "../models/Promotion";
import { RequestHandler } from "../utils/RequestHandler";

const requestHandler = RequestHandler.instance;

const progressBar = new SingleBar({}, Presets.shades_classic);

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
  const promotionsPerPage = 50; // The number of products to retrieve per page.

  // Get the total number of products available.
  const productCount = await getPromotionCount();

  // Calculate the number of pages to retrieve.
  const pageCount = Math.ceil(productCount / promotionsPerPage);

  // Initialize an array to store the product data.
  const promotions = [];
  const promises = [];

  progressBar.start(pageCount, 0);

  //create a promise for each page
  for (let i = 1; i <= pageCount; i++) {
    promises.push(
      requestHandler.proxiedRequest(
        process.env.PROMOTION_URL,
        {},
        {
          clientCode: "CLP",
          placeId: process.env.PLACE_ID,
          page: i,
          size: promotionsPerPage,
        }
      )
    );
  }

  //   Create an array of promises to fetch the product data for each page.
  promises.map((p) =>
    p
      .then((res) => {
        progressBar.increment();
        return promotions.push(...res.promotions);
      })
      .catch(console.error)
  );

  // Wait for all promises to resolve.
  await Promise.all(promises);
  progressBar.stop();

  console.log("==========     Scraping done!     ==========");
  console.log(`Total promotions scraped: ${promotions.length}`);
  return promotions as Promotion[];
}

async function getPromotionCount(): Promise<number> {
  const responseBody = await requestHandler.proxiedRequest(
    process.env.PROMOTION_URL,
    {},
    {
      clientCode: "CLP",
      placeId: process.env.PLACE_ID,
      size: 50,
    }
  );

  return responseBody.totalPromotionFound;
}
