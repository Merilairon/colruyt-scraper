import "dotenv/config";
import express from "express";
import productRoute from "./routes/products";
import PromotionRoute from "./routes/promotions";
import userRoute from "./routes/users";

//Import User Data as this is not initiated by a scraper or comparer
import "./models/User";
import "./models/UserData";
import { sequelize, authenticateWithRetry } from "./database";
import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import cors from "cors";
import cron from "node-cron";
import { styleText } from "node:util";

import { scraper } from "./scraper";
import { comparer } from "./comparer";
import { refreshCache } from "./utils/cache";
import bodyParser from "body-parser";
import path from "path";

const app = express();
app.use(
  bodyParser.urlencoded({
    extended: true,
  }),
);
app.use(bodyParser.json());
const port = process.env.PORT || 3000;

// Initialize database connection and sync models
async function initializeDatabase() {
  try {
    console.log("==========   Initializing Database   ==========");
    await authenticateWithRetry();
    await sequelize.sync();
    console.log("==========   Database Initialized   ==========");
  } catch (error) {
    console.error("Failed to initialize database:", error);
    process.exit(1);
  }
}

app.use(cors());

app.use("/api/products", productRoute);
app.use("/api/promotions", PromotionRoute);
app.use("/api/me", userRoute);

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
  swaggerUi.setup(specs, { explorer: true }),
);

// Handle unknown paths
app.use((req, res) => {
  res.status(404).json({ message: "Not Found" });
});

// Centralized error handler: never expose stack traces or raw auth errors
app.use(
  (
    err: Error & { status?: number; statusCode?: number; code?: string },
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(err);
    const status = err.status || err.statusCode || 500;
    const message = status >= 500 ? "Internal Server Error" : err.message;
    res.status(status).json({ message });
  },
);

// Start server after database initialization
initializeDatabase().then(() => {
  app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
});

async function scrapeAndCompare() {
  console.log(
    styleText(
      "blue",
      "==========     " + new Date().toLocaleString() + "     ==========",
    ),
  );
  await scraper();
  await comparer();
  await refreshCache("products");
  await refreshCache("promotions");
}

if (process.env.START_MODE === "SCRAPE") {
  console.log("Starting in scrape mode, starting scraper and comparer");
  scrapeAndCompare().catch((e) => console.error(e.message));
} else if (process.env.START_MODE === "COMPARE") {
  console.log("Starting in compare mode, starting comparer");
  comparer().catch((e) => console.error(e.message));
} else {
  console.log("Starting in normal mode");
}

cron.schedule("0 8 * * *", async () => {
  try {
    await scrapeAndCompare();
  } catch (e) {
    console.error(e.message);
  }
});
