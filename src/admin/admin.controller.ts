import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Ip,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { Response } from "express";
import {
  AdminLoginDto,
  UpdatePetitionMessageDto,
  UpdatePetitionStatusDto,
} from "../petitions/petition.dto";
import { PetitionsService } from "../petitions/petitions.service";
import { AdminAuthService } from "./admin-auth.service";
import { AdminGuard } from "./admin.guard";

@Controller("admin")
export class AdminController {
  constructor(
    private readonly auth: AdminAuthService,
    private readonly petitions: PetitionsService,
  ) {}

  @Post("login")
  @HttpCode(200)
  login(@Body() dto: AdminLoginDto, @Ip() ip: string, @Res({ passthrough: true }) response: Response) {
    const now = Date.now();
    const attempts = loginAttempts.get(ip) || [];
    const recent = attempts.filter((attempt) => now - attempt < 15 * 60 * 1000);
    if (recent.length >= 5) throw new UnauthorizedException("Demasiados intentos. Inténtalo en 15 minutos.");
    recent.push(now);
    loginAttempts.set(ip, recent);
    if (!this.auth.passwordMatches(dto.password)) throw new UnauthorizedException("Credenciales incorrectas.");
    loginAttempts.delete(ip);
    response.setHeader("Set-Cookie", this.auth.createCookie());
    return { authenticated: true };
  }

  @Post("logout")
  @HttpCode(200)
  logout(@Res({ passthrough: true }) response: Response) {
    response.setHeader("Set-Cookie", this.auth.clearCookie());
    return { authenticated: false };
  }

  @UseGuards(AdminGuard)
  @Get("peticiones")
  async list(@Query("status") status = "all") {
    const petitions = await this.petitions.list(status);
    return { petitions };
  }

  @UseGuards(AdminGuard)
  @Patch("peticiones/:reference")
  update(
    @Param("reference") reference: string,
    @Body() dto: UpdatePetitionStatusDto,
  ) {
    return this.petitions.updateStatus(reference, dto.status);
  }

  @UseGuards(AdminGuard)
  @Patch("peticiones/:reference/mensaje")
  updateMessage(
    @Param("reference") reference: string,
    @Body() dto: UpdatePetitionMessageDto,
  ) {
    return this.petitions.updateMessage(reference, dto.message);
  }

  @UseGuards(AdminGuard)
  @Delete("peticiones/:reference")
  remove(@Param("reference") reference: string) {
    return this.petitions.deletePetition(reference);
  }
}

const loginAttempts = new Map<string, number[]>();
