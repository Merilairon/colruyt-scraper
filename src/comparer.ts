import "dotenv/config";
import { sequelize } from "./data";
import { Day } from "./models/Day";
import { Op } from "sequelize";
import { getPriceDifference } from "./comparers/comparer";

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

    const days = await Day.findAll({
      where: {
        date: { [Op.gte]: new Date().getDate() - 1 }, // yesterday
      },
      order: ["date"], // order older first
    });

    const yesterday = days[0].dataValues as Day;
    const today = days[1].dataValues as Day;
    console.log("==========   Data Retrieved     ==========");
    // Compare the prices of products between yesterday and today.
    const priceDifferences = await getPriceDifference(
      yesterday.products,
      today.products
    );
    console.log(priceDifferences);
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
