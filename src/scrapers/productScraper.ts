import { Product } from "../models/Product";
import { RequestHandler } from "../utils/RequestHandler";
import { SingleBar, Presets } from "cli-progress";
const requestHandler = RequestHandler.instance;

const progressBar = new SingleBar({}, Presets.shades_classic);

/**
 * Retrieves all products by fetching them in pages.
 *
 * @returns {Promise<any[]>} A promise that resolves to an array of all products.
 *
 * @remarks
 * This function fetches products in pages, with each page containing a specified number of products.
 * It uses a progress bar to indicate the progress of the fetching process.
 *
 * @example
 * ```typescript
 * const products = await getAllProducts();
 * console.log(products);
 * ```
 *
 * @throws Will throw an error if the request to fetch products fails.
 */
export async function getAllProducts() {
  console.log("==========     Scraping products...     ==========");
  const productsPerPage = 250; // The number of products to retrieve per page.

  // Get the total number of products available.
  const productCount = await getProductCount();

  // Calculate the number of pages to retrieve.
  const pageCount = Math.ceil(productCount / productsPerPage);

  // Initialize an array to store the product data.
  const products = [];
  const promises = [];

  progressBar.start(pageCount, 0);

  //create a promise for each page
  for (let i = 1; i <= pageCount; i++) {
    promises.push(
      requestHandler.proxiedRequest(
        process.env.PRODUCT_URL,
        {},
        {
          clientCode: "CLP",
          placeId: process.env.PLACE_ID,
          sort: "basicprice asc",
          page: i,
          size: 250,
        }
      )
    );
  }
  //   Create an array of promises to fetch the product data for each page.
  promises.map((p) =>
    p
      .then((res) => {
        progressBar.increment();
        return products.push(...res.products);
      })
      .catch(console.error)
  );

  // Wait for all promises to resolve.
  await Promise.all(promises);
  progressBar.stop();

  console.log("==========     Scraping done!     ==========");
  console.log(`Total products scraped: ${products.length}`);
  return products as Product[];
}

/**
 * Fetches the total number of products available from the specified product URL.
 *
 * @returns {Promise<number>} A promise that resolves to the number of products found.
 *
 * @throws Will throw an error if the request fails or if the response does not contain the expected data.
 */
async function getProductCount(): Promise<number> {
  const responseBody = await requestHandler.proxiedRequest(
    process.env.PRODUCT_URL,
    {},
    {
      clientCode: "CLP",
      placeId: process.env.PLACE_ID,
      size: 1,
    }
  );

  return responseBody.productsFound;
}
