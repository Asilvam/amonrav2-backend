import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type BlockedContactDocument = HydratedDocument<BlockedContact>;
export type BlockedContactType = "email" | "phone";

@Schema({ timestamps: true, versionKey: false })
export class BlockedContact {
  @Prop({ required: true, enum: ["email", "phone"], index: true })
  type: BlockedContactType;

  @Prop({ required: true, trim: true })
  normalizedValue: string;

  @Prop({ required: true, trim: true })
  value: string;

  @Prop({ trim: true, maxlength: 200 })
  reason?: string;

  createdAt: Date;
  updatedAt: Date;
}

export const BlockedContactSchema = SchemaFactory.createForClass(BlockedContact);
BlockedContactSchema.index({ type: 1, normalizedValue: 1 }, { unique: true });
