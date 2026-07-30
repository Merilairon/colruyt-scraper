import { Product } from "../models/Product";
import { Nutrition } from "../models/Nutrition";
import { SingleBar, Presets } from "cli-progress";

const OFF_FIELDS = [
  "product_name",
  "code",
  "nutriments",
  "nutriscore_grade",
  "nova_group",
];

const OFF_BASE_URL = "https://world.openfoodfacts.org";

type NutritionData = Partial<Nutrition> & { productId: string };

type OpenFoodFactsClient = {
  getProductV3: (
    gtin: string,
    options: { fields: string[] },
  ) => Promise<{ data?: any }>;
};

function createOpenFoodFactsClient(): OpenFoodFactsClient {
  return {
    async getProductV3(gtin, options) {
      const fields = options.fields.join(",");
      const url = `${OFF_BASE_URL}/api/v3/product/${encodeURIComponent(
        gtin,
      )}?fields=${encodeURIComponent(fields)}`;

      const response = await fetch(url);
      if (!response.ok) {
        return { data: undefined };
      }

      const data = await response.json();
      return { data };
    },
  };
}

/**
 * Looks up nutritional information on Open Food Facts for a single product.
 * Tries each GTIN in order and returns the first one that has usable nutriments.
 */
export async function fetchNutritionForProduct(
  product: Pick<Product, "productId" | "gtin">,
  client: OpenFoodFactsClient = createOpenFoodFactsClient(),
): Promise<NutritionData | null> {
  if (!product.gtin || product.gtin.length === 0) {
    return null;
  }

  for (const gtin of product.gtin) {
    if (!gtin) continue;

    try {
      const response = await client.getProductV3(gtin, {
        fields: OFF_FIELDS as any,
      });

      if (!response.data || response.data.status === "failure") {
        continue;
      }

      const offProduct = (response.data as any).product;
      if (!offProduct) continue;

      const mapped = mapOffProductToNutrition(product.productId, offProduct);
      if (hasAnyNutriments(mapped)) {
        return mapped;
      }
    } catch (error) {
      console.error(
        `Error fetching nutrition for GTIN ${gtin} (product ${product.productId}):`,
        (error as Error).message,
      );
    }
  }

  return null;
}

/**
 * Enriches the provided products with nutrition data from Open Food Facts.
 * Products that already have a Nutrition row are skipped.
 */
export async function enrichProductsWithNutrition(
  products: Pick<Product, "productId" | "gtin">[],
  client: OpenFoodFactsClient = createOpenFoodFactsClient(),
): Promise<void> {
  if (products.length === 0) return;

  const progressBar = new SingleBar(
    { hideCursor: true, autopadding: true },
    Presets.shades_classic,
  );

  progressBar.start(products.length, 0);

  const nutritionRows: NutritionData[] = [];

  for (const product of products) {
    const nutrition = await fetchNutritionForProduct(product, client);
    if (nutrition) {
      nutritionRows.push(nutrition);
    }
    progressBar.increment();
  }

  progressBar.stop();

  if (nutritionRows.length > 0) {
    await Nutrition.bulkCreate(nutritionRows, {
      updateOnDuplicate: Object.keys(Nutrition.getAttributes()).filter(
        (key) => key !== "productId",
      ),
    });
  }

  console.log(
    `==========     Enriched ${nutritionRows.length} / ${products.length} products with nutrition     ==========`,
  );
}

function getNutrient(
  nutriments: Record<string, unknown>,
  key: string,
): number | undefined {
  const value =
    nutriments[key] ??
    nutriments[key.replace(/_/g, "-")] ??
    nutriments[key.replace(/-/g, "_")];

  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function mapOffProductToNutrition(
  productId: string,
  offProduct: any,
): NutritionData {
  const nutriments = offProduct.nutriments ?? {};

  return {
    productId,
    energyKcal100g: getNutrient(nutriments, "energy-kcal_100g"),
    fat100g: getNutrient(nutriments, "fat_100g"),
    saturatedFat100g: getNutrient(nutriments, "saturated-fat_100g"),
    carbohydrates100g: getNutrient(nutriments, "carbohydrates_100g"),
    sugars100g: getNutrient(nutriments, "sugars_100g"),
    proteins100g: getNutrient(nutriments, "proteins_100g"),
    salt100g: getNutrient(nutriments, "salt_100g"),
    fiber100g: getNutrient(nutriments, "fiber_100g"),
    sodium100g: getNutrient(nutriments, "sodium_100g"),
    nutriscoreGrade: offProduct.nutriscore_grade ?? undefined,
    novaGroup: offProduct.nova_group ?? undefined,
  };
}

function hasAnyNutriments(nutrition: NutritionData): boolean {
  return (
    nutrition.energyKcal100g !== undefined ||
    nutrition.fat100g !== undefined ||
    nutrition.saturatedFat100g !== undefined ||
    nutrition.carbohydrates100g !== undefined ||
    nutrition.sugars100g !== undefined ||
    nutrition.proteins100g !== undefined ||
    nutrition.salt100g !== undefined ||
    nutrition.fiber100g !== undefined ||
    nutrition.sodium100g !== undefined
  );
}
