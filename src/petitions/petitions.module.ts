import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { EmailSenderService } from "./email-sender.service";
import { Petition, PetitionSchema } from "./petition.schema";
import { PetitionsController } from "./petitions.controller";
import { PetitionsService } from "./petitions.service";
import { RateLimit, RateLimitSchema } from "./rate-limit.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Petition.name, schema: PetitionSchema },
      { name: RateLimit.name, schema: RateLimitSchema },
    ]),
  ],
  controllers: [PetitionsController],
  providers: [PetitionsService, EmailSenderService],
  exports: [PetitionsService],
})
export class PetitionsModule {}
