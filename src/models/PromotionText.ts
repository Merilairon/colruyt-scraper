import {DataTypes, Model} from "sequelize";
import {sequelize} from "../database";
import {Promotion} from "./Promotion";

export class PromotionText extends Model {
    declare textType?: String;
    declare text?: String;
    declare sequence?: number;
    declare promotionId: string;
}

PromotionText.init(
    {
        textType: DataTypes.STRING,
        text: DataTypes.STRING,
        sequence: DataTypes.DECIMAL,
    },
    {sequelize, modelName: "promotionText"}
);

Promotion.hasMany(PromotionText, {foreignKey: "promotionId"});
PromotionText.belongsTo(Promotion, {foreignKey: "promotionId"});
