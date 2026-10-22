import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { VelaRateLimit, VelaRateLimitSchema } from "./vela-rate-limit.schema";
import { Vela, VelaSchema } from "./vela.schema";
import { VelasController } from "./velas.controller";
import { VelasService } from "./velas.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Vela.name, schema: VelaSchema },
      { name: VelaRateLimit.name, schema: VelaRateLimitSchema },
    ]),
  ],
  controllers: [VelasController],
  providers: [VelasService],
})
export class VelasModule {}
