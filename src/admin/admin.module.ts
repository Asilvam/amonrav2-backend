import { Module } from "@nestjs/common";
import { PetitionsModule } from "../petitions/petitions.module";
import { AdminController } from "./admin.controller";
import { AdminAuthService } from "./admin-auth.service";
import { AdminGuard } from "./admin.guard";

@Module({
  imports: [PetitionsModule],
  controllers: [AdminController],
  providers: [AdminAuthService, AdminGuard],
})
export class AdminModule {}
