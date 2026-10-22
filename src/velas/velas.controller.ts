import {
  Body,
  Controller,
  Get,
  Ip,
  Post,
  Query,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import {
  CreateVelaDto,
  VelaCitiesQueryDto,
  VelaListQueryDto,
} from "./vela.dto";
import { VelasService } from "./velas.service";

@Controller("velas")
export class VelasController {
  constructor(private readonly velas: VelasService) {}

  @Get("ubicaciones/paises")
  countries() {
    return this.velas.countries();
  }

  @Get("ubicaciones/ciudades")
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }))
  cities(@Query() query: VelaCitiesQueryDto, @Ip() ip: string) {
    return this.velas.cities(query, ip);
  }

  @Post()
  create(@Body() dto: CreateVelaDto, @Ip() ip: string) {
    return this.velas.create(dto, ip);
  }

  @Get()
  list(@Query() query: VelaListQueryDto) {
    return this.velas.list(query);
  }
}
