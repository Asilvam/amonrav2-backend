import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type VelaDocument = HydratedDocument<Vela>;

@Schema({ timestamps: true, versionKey: false })
export class Vela {
  @Prop({ required: true, unique: true, index: true })
  reference: string;

  @Prop({ required: true, enum: ["Gratitud", "Esperanza", "Calma", "Amor", "Fortaleza", "Recuerdo"] })
  intention: string;

  @Prop({ trim: true, maxlength: 180, default: "" })
  dedication: string;

  @Prop({ trim: true, maxlength: 80, default: "" })
  name: string;

  @Prop({ required: true, enum: ["marfil", "ambar", "rosa", "azul"] })
  color: string;

  @Prop({ required: true, index: true })
  startedAt: Date;

  @Prop({ uppercase: true, match: /^[A-Z]{2}$/u })
  countryCode?: string;

  @Prop({ trim: true, maxlength: 20 })
  cityId?: string;

  @Prop({ trim: true, maxlength: 120 })
  cityName?: string;

  @Prop({ required: true, default: false })
  publishLocation: boolean;

  @Prop({ required: true, select: false })
  trackingTokenHash: string;

  createdAt: Date;
  updatedAt: Date;
}

export const VelaSchema = SchemaFactory.createForClass(Vela);
VelaSchema.index({ startedAt: -1 });
