import "dotenv/config";
import { getAllProducts } from "./scrapers/productScraper";
import { getAllPromotions } from "./scrapers/promotionScaper";
import { sequelize } from "./data";
import { Product } from "./models/Product";
import { Price } from "./models/Price";
import { Promotion } from "./models/Promotion";
import { Benefit } from "./models/Benefit";

/**
 * The main function that executes the program logic.
 */
async function main() {
  try {
    // Fetch product data using the proxiedRequest function.
    let apiProducts = await getAllProducts();
    let apiPromotions = await getAllPromotions();

    // Save the data to the database.
    console.log("==========   Connecting to DB   ==========");

    await sequelize.authenticate();
    await sequelize.sync();

    console.log("==========     DB Connected     ==========");
    console.log("==========     Saving Data      ==========");
    const products = await Product.bulkCreate(apiProducts, {
      ignoreDuplicates: true,
    }); //doesnt include prices

    const prices = await Price.bulkCreate(
      apiProducts.map((p) => {
        return {
          productId: p.productId,
          ...p.price,
        };
      })
    );

    await Promotion.destroy({
      where: {},
      cascade: true,
      truncate: true,
      restartIdentity: true,
    });
    await Benefit.destroy({
      where: {},
      cascade: true,
      truncate: true,
      restartIdentity: true,
    });

    const promotions = await Promotion.bulkCreate(apiPromotions, {
      ignoreDuplicates: true,
    });

    let apiBenefits = [];
    await apiPromotions.forEach((p) => {
      if (!p.benefit) return;
      p.benefit.forEach((b) => {
        apiBenefits.push({
          promotionId: p.promotionId,
          ...b,
        });
      });
    });

    const benefits = await Benefit.bulkCreate(apiBenefits, {
      ignoreDuplicates: true,
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
