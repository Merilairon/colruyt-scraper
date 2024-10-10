import { Model, DataTypes } from "sequelize";
import { sequelize } from "../database";

export class Comparison extends Model {}
Comparison.init(
  {
    date: DataTypes.DATEONLY,
    increases: DataTypes.JSON,
    decreases: DataTypes.JSON,
  },
  {
    sequelize,
    modelName: "comparison",
    indexes: [{ unique: true, fields: ["date"] }],
  }
);
