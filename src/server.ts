import "dotenv/config";
import express from "express";
import productRoute from "./routes/products";
import PromotionRoute from "./routes/promotions";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import cors from "cors";
import cron from "node-cron";

import { scraper } from "./scraper";
import { comparer } from "./comparer";
import bodyParser from "body-parser";
import path from "path";

const app = express();
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);
app.use(bodyParser.json());
const port = process.env.PORT || 3000;

app.use(cors());

app.use("/api/products", productRoute);
app.use("/api/promotions", PromotionRoute);

const options = {
  definition: {
    openapi: "3.1.0",
    info: {
      title: "Colruit Swagger API",
      version: "1.0.0",
    },
  },
  apis: [
    path.join(__dirname, "routes/*.js"),
    path.join(__dirname, "../src/docs/*.yaml"),
    path.join(__dirname, "docs/*.yaml"),
  ],
};

const specs = swaggerJsdoc(options);
app.use(
  "/api/docs",
  swaggerUi.serve,
  swaggerUi.setup(specs, { explorer: true })
);

// Handle unknown paths
app.use((req, res) => {
  res.status(404).json({ message: "Not Found" });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

async function scrapeAndCompare() {
  scraper()
    .then(comparer)
    .catch((e) => console.error(e.message));
}

const now = new Date();
const hours = now.getHours();

// if (hours > 9) {
//   console.log("Started after CRON, starting scraper");
//   scrapeAndCompare();
// }

cron.schedule("0 6 * * *", async () => {
  try {
    await scrapeAndCompare();
  } catch (e) {
    console.error(e.message);
  }
});
