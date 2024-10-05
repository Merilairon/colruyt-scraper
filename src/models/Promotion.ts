import { Benefit } from "./Benefit";

export class Promotion {
  promotionId: string;
  promotionType: string;
  activeStartDate: string;
  activeEndDate: string;
  benefit: Benefit;
  seoBrandList: string[];
  linkedTechnicalArticleNumber: string;
  linkedCommercialArticleNumber: string;
}
