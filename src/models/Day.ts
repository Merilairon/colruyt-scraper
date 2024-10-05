import { Model, DataTypes } from "sequelize";
import { Product } from "./Product";
import { Promotion } from "./Promotion";
import { sequelize } from "../data";

export class Day extends Model {
  date: Date;
  products: Product[];
  promotions: Promotion[];
}
Day.init(
  {
    date: DataTypes.DATE,
    products: DataTypes.JSON,
    promotions: DataTypes.JSON,
  },
  { sequelize, modelName: "day" }
);
