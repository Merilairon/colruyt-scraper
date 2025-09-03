import "dotenv/config";
import { sequelize } from "./database";
import { Op } from "sequelize";
import { getPriceChange } from "./comparers/comparer";
import { Price } from "./models/Price";
import { PriceChange } from "./models/PriceChange";

/**
 * The comparer function that executes the program logic.
 */
export async function comparer() {
  console.log("==========   Starting Comparer  ==========");
  try {
    console.log("==========   Connecting to DB   ==========");
    await sequelize.authenticate();
    await sequelize.sync();
    console.log("==========     DB Connected     ==========");
    console.log("==========   Retrieving Data    ==========");

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const [pricesToday, pricesYesterday, priceChanges] = await Promise.all([
      Price.findAll({
        include: ["product"],
        where: {
          date: { [Op.eq]: today },
        },
        order: ["date"],
      }),
      Price.findAll({
        include: ["product"],
        where: {
          date: { [Op.eq]: yesterday },
        },
        order: ["date"],
      }),
      PriceChange.findAll(),
    ]);

    console.log("==========   Data Retrieved     ==========");
    // Compare the prices of products between yesterday and today.
    const { updatedPriceChanges, newPriceChanges } = await getPriceChange(
      pricesYesterday,
      pricesToday,
      priceChanges
    );

    console.log("==========     Saving Data      ==========");

    await sequelize.transaction(async (t) => {
      const dbPriceChanges = await PriceChange.bulkCreate(newPriceChanges, {
        transaction: t,
      });

      console.log(
        `=========   New Changes: ${dbPriceChanges.length.toLocaleString(
          "en-US",
          {
            minimumIntegerDigits: 5,
            useGrouping: false,
          }
        )}   =========`
      );

      const updatePromises = updatedPriceChanges.map((priceChange) =>
        PriceChange.update(priceChange, {
          where: {
            productId: priceChange.productId,
            priceChangeType: priceChange.priceChangeType,
          },
          transaction: t,
        })
      );

      await Promise.all(updatePromises);

      console.log(
        `=======   Updated Changes: ${updatedPriceChanges.length.toLocaleString(
          "en-US",
          {
            minimumIntegerDigits: 5,
            useGrouping: false,
          }
        )}   =======`
      );
    });

    console.log("==========     Done Saving      ==========");
  } catch (error) {
    // Handle any errors that occur during execution.
    // Log the error message to the console and exit the process with an error code.
    console.error(`Error: ${error.message}`);
  }
}
