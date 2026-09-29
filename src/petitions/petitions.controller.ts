import { Body, Controller, Ip, Post } from "@nestjs/common";
import {
  ConfirmPetitionDto,
  CreatePetitionDto,
  PetitionStatusDto,
  ResendConfirmationDto,
} from "./petition.dto";
import { PetitionsService } from "./petitions.service";

@Controller("peticiones")
export class PetitionsController {
  constructor(private readonly petitions: PetitionsService) {}

  @Post()
  create(@Body() dto: CreatePetitionDto, @Ip() ip: string) {
    return this.petitions.create(dto, ip);
  }

  @Post("confirmar")
  confirm(@Body() dto: ConfirmPetitionDto) {
    return this.petitions.confirm(dto.token);
  }

  @Post("reenviar")
  resend(@Body() dto: ResendConfirmationDto, @Ip() ip: string) {
    return this.petitions.resend(dto, ip);
  }

  @Post("estado")
  status(@Body() dto: PetitionStatusDto, @Ip() ip: string) {
    return this.petitions.status(dto, ip);
  }
}
