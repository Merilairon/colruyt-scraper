import "dotenv/config";
import { getAllProducts } from "./scrapers/productScraper";
import { getAllPromotions } from "./scrapers/promotionScaper";
import { sequelize } from "./data";
import { Day } from "./models/Day";

/**
 * The main function that executes the program logic.
 */
async function main() {
  try {
    // Fetch product data using the proxiedRequest function.
    let products = await getAllProducts();
    let promotions = await getAllPromotions();

    // Save the data to the database.
    console.log("==========   Connecting to DB   ==========");
    await sequelize.authenticate();
    await sequelize.sync();
    console.log("==========     DB Connected     ==========");
    console.log("==========     Saving Data      ==========");
    const day = await Day.create({
      date: Date.now(),
      products: products,
      promotions: promotions,
    });
    console.log("==========     Done Saving      ==========");
    await sequelize.close();
  } catch (error) {
    // Handle any errors that occur during execution.
    // Log the error message to the console and exit the process with an error code.
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

//TODO: add more logic for when crashing
// Call the main function to start the program execution.
main()
  .catch(async (e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {});
