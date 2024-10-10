import "dotenv/config";
import { sequelize } from "./database";
import { Op } from "sequelize";
import { getPriceChange } from "./comparers/comparer";
import { Price } from "./models/Price";
import { PriceChange } from "./models/PriceChange";

/**
 * The main function that executes the program logic.
 */
async function main() {
  try {
    console.log("==========   Connecting to DB   ==========");
    await sequelize.authenticate();
    await sequelize.sync();
    console.log("==========     DB Connected     ==========");
    console.log("==========   Retrieving Data    ==========");

    const pricesToday = await Price.findAll({
      include: ["product"],
      where: {
        date: { [Op.eq]: Date.now() }, // yesterday
      },
      order: ["date"], // order older first
    });
    console.log(pricesToday);

    const pricesYesterday = await Price.findAll({
      include: ["product"],
      where: {
        date: { [Op.eq]: Date.now() - 1 }, // yesterday
      },
      order: ["date"], // order older first
    });

    const priceChanges = await PriceChange.findAll();

    console.log("==========   Data Retrieved     ==========");
    // Compare the prices of products between yesterday and today.
    const { updatedPriceChanges, newPriceChanges } = await getPriceChange(
      pricesYesterday,
      pricesToday,
      priceChanges
    );

    console.log("==========     Saving Data      ==========");

    await PriceChange.bulkCreate(newPriceChanges);
    updatedPriceChanges.forEach(async (priceChange) => {
      await PriceChange.update(priceChange, {
        where: {
          productId: priceChange.productId,
        },
      });
    });

    console.log("==========     Done Saving      ==========");
  } catch (error) {
    // Handle any errors that occur during execution.
    // Log the error message to the console and exit the process with an error code.
    console.error(`Error: ${error.message}`);
    process.exit(1);
  } finally {
    await sequelize.close();
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
