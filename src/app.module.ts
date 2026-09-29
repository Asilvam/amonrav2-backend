import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AdminModule } from "./admin/admin.module";
import { HealthController } from "./health.controller";
import { PetitionsModule } from "./petitions/petitions.module";

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGODB_URI || ""),
    PetitionsModule,
    AdminModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
