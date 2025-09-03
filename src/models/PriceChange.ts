import { Model, DataTypes } from "sequelize";
import { sequelize } from "../database"; // Adjust the path to your sequelize instance
import { Product } from "./Product";

export class PriceChange extends Model {
  declare pricechangeId: number;
  declare productId: string;
  declare priceChangeType: string;
  declare priceChange: number;
  declare priceChangePercentage: number;
  declare involvesPromotion: boolean;
  declare oldPrice: number;
  declare newprice: number;
}

PriceChange.init(
  {
    pricechangeId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    priceChangeType: {
      type: DataTypes.TEXT,
      primaryKey: true,
      defaultValue: "P1",
    },
    priceChange: DataTypes.FLOAT,
    priceChangePercentage: DataTypes.FLOAT,
    involvesPromotion: DataTypes.BOOLEAN,
    oldPrice: DataTypes.FLOAT,
    newprice: DataTypes.FLOAT,
  },
  {
    sequelize,
    modelName: "pricechange",
    indexes: [
      // Add a composite unique index
      { unique: true, fields: ["productId", "priceChangeType"] },
    ],
  }
);

Product.hasMany(PriceChange, { foreignKey: "productId" });
PriceChange.belongsTo(Product, { foreignKey: "productId" });
