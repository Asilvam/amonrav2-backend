import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type PetitionDocument = HydratedDocument<Petition>;
export type PetitionStatus = "pending_confirmation" | "received" | "completed" | "cancelled";

@Schema({ timestamps: true, versionKey: false })
export class Petition {
  @Prop({ required: true, unique: true, index: true })
  reference: string;

  @Prop({ required: true, enum: ["Cadena de oración", "Encendido de vela", "Otra petición"] })
  kind: string;

  @Prop()
  duration?: string;

  @Prop()
  candleColor?: string;

  @Prop()
  candleType?: string;

  @Prop({ required: true, maxlength: 600 })
  message: string;

  @Prop({ required: true, trim: true, maxlength: 80 })
  name: string;

  @Prop({ trim: true, maxlength: 30 })
  phone?: string;

  @Prop({ required: true, lowercase: true, trim: true, maxlength: 254 })
  email: string;

  @Prop({ required: true, default: false })
  share: boolean;

  @Prop({ required: true, enum: ["pending_confirmation", "received", "completed", "cancelled"], default: "pending_confirmation", index: true })
  status: PetitionStatus;

  @Prop({ select: false })
  confirmationTokenHash?: string;

  @Prop({ select: false })
  confirmationExpiresAt?: Date;

  @Prop({ required: true, select: false })
  trackingTokenHash: string;

  @Prop()
  confirmedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

export const PetitionSchema = SchemaFactory.createForClass(Petition);
PetitionSchema.index({ status: 1, createdAt: -1 });
PetitionSchema.index({ confirmationTokenHash: 1 });
