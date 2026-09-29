import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";

@Schema({ versionKey: false })
export class RateLimit {
  @Prop({ required: true })
  bucket: string;

  @Prop({ required: true })
  windowStart: Date;

  @Prop({ required: true, default: 0 })
  hits: number;

  @Prop({ required: true, expires: 0 })
  expiresAt: Date;
}

export const RateLimitSchema = SchemaFactory.createForClass(RateLimit);
RateLimitSchema.index({ bucket: 1, windowStart: 1 }, { unique: true });
