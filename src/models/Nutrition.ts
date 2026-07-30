import { DataTypes, Model } from "sequelize";
import { sequelize } from "../database";
import { Product } from "./Product";

export class Nutrition extends Model {
  declare productId: string;
  declare energyKcal100g?: number;
  declare fat100g?: number;
  declare saturatedFat100g?: number;
  declare carbohydrates100g?: number;
  declare sugars100g?: number;
  declare proteins100g?: number;
  declare salt100g?: number;
  declare fiber100g?: number;
  declare sodium100g?: number;
  declare nutriscoreGrade?: string;
  declare novaGroup?: number;
}

Nutrition.init(
  {
    productId: {
      type: DataTypes.STRING,
      primaryKey: true,
      references: {
        model: Product,
        key: "productId",
      },
    },
    energyKcal100g: DataTypes.FLOAT,
    fat100g: DataTypes.FLOAT,
    saturatedFat100g: DataTypes.FLOAT,
    carbohydrates100g: DataTypes.FLOAT,
    sugars100g: DataTypes.FLOAT,
    proteins100g: DataTypes.FLOAT,
    salt100g: DataTypes.FLOAT,
    fiber100g: DataTypes.FLOAT,
    sodium100g: DataTypes.FLOAT,
    nutriscoreGrade: DataTypes.STRING,
    novaGroup: DataTypes.INTEGER,
  },
  {
    sequelize,
    modelName: "nutrition",
  },
);

Product.hasOne(Nutrition, { foreignKey: "productId", onDelete: "CASCADE" });
Nutrition.belongsTo(Product, { foreignKey: "productId", onDelete: "CASCADE" });
