import "dotenv/config";
import express from "express";
import productRoute from "./routes/products";

const app = express();
const port = process.env.PORT || 3000;

app.use("/products", productRoute);

// Handle unknown paths
app.use((req, res) => {
  res.status(404).json({ message: "Not Found" });
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
