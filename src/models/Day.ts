import { Model, DataTypes } from "sequelize";
import { Product } from "./Product";
import { Promotion } from "./Promotion";
import { sequelize } from "../data";

export class Day extends Model {
  declare date: Date;
  declare products: Product[];
  declare promotions: Promotion[];
}
Day.init(
  {
    date: DataTypes.DATEONLY,
    products: DataTypes.JSON,
    promotions: DataTypes.JSON,
  },
  { sequelize, modelName: "day", indexes: [{ unique: true, fields: ["date"] }] }
);

/*
export class Day extends Model {}
Day.init(
  {
    date: DataTypes.DATEONLY,
    products: DataTypes.JSON,
    promotions: DataTypes.JSON,
  },
  { sequelize, modelName: "day", indexes: [{ unique: true, fields: ["date"] }] }
);

*/
