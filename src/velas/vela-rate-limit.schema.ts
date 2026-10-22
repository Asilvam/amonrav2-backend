import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";

@Schema({ versionKey: false })
export class VelaRateLimit {
  @Prop({ required: true })
  bucket: string;

  @Prop({ required: true })
  windowStart: Date;

  @Prop({ required: true, expires: 0 })
  expiresAt: Date;

  @Prop({ required: true, default: 0 })
  hits: number;
}

export const VelaRateLimitSchema =
  SchemaFactory.createForClass(VelaRateLimit);
VelaRateLimitSchema.index({ bucket: 1, windowStart: 1 }, { unique: true });
