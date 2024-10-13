import "dotenv/config";
import express from "express";
import productRoute from "./routes/products";
import PromotionRoute from "./routes/promotions";
import swaggerJSDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import cors from "cors";

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());

app.use("/products", productRoute);
app.use("/promotions", PromotionRoute);

const swaggerSpec = swaggerJSDoc({
  failOnErrors: true, // Whether or not to throw when parsing errors. Defaults to false.
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Hello World",
      version: "1.0.0",
    },
  },
  apis: ["./src/routes/*.ts"],
});

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Handle unknown paths
app.use((req, res) => {
  res.status(404).json({ message: "Not Found" });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
