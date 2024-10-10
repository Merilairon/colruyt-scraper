import { Router } from "express";

const router = Router();

// Route to get a product by slug
router.get("/:productId", (req, res) => {
  const { productId } = req.params;
  // Logic to fetch product by slug
  res.send(`Product with slug: ${productId}`);
});

// Route to get all products in a collection
router.get("/", (req, res) => {
  res.send(`Products`);
});

export default router;
