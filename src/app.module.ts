import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AdminModule } from "./admin/admin.module";
import { HealthController } from "./health.controller";
import { PetitionsModule } from "./petitions/petitions.module";
import { VelasModule } from "./velas/velas.module";

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGODB_URI || ""),
    PetitionsModule,
    VelasModule,
    AdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
