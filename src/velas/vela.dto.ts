import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from "class-validator";
import { COUNTRY_CODES } from "./vela.locations";

export const CANDLE_INTENTIONS = [
  "Gratitud",
  "Esperanza",
  "Calma",
  "Amor",
  "Fortaleza",
  "Recuerdo",
] as const;

export const CANDLE_COLORS = ["marfil", "ambar", "rosa", "azul"] as const;

export class CreateVelaDto {
  @IsIn(CANDLE_INTENTIONS)
  intention: (typeof CANDLE_INTENTIONS)[number];

  @IsOptional()
  @IsString()
  @MaxLength(180)
  dedication?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  name?: string;

  @IsIn(CANDLE_COLORS)
  color: (typeof CANDLE_COLORS)[number];

  @ValidateIf((value: CreateVelaDto) => value.publishLocation || value.countryCode !== undefined)
  @IsIn(COUNTRY_CODES)
  countryCode?: string;

  @ValidateIf((value: CreateVelaDto) => value.cityId !== undefined || value.publishLocation)
  @IsString()
  @Matches(/^\d{1,12}$/u)
  cityId?: string;

  @ValidateIf((value: CreateVelaDto) => value.cityName !== undefined || value.publishLocation)
  @IsString()
  @MaxLength(120)
  @Matches(/\S/u)
  cityName?: string;

  @IsBoolean()
  publishLocation: boolean;
}

export class VelaTrackingDto {
  @IsString()
  @Matches(/^V-[A-F0-9]{24}$/u)
  reference: string;

  @IsString()
  @MinLength(20)
  @MaxLength(80)
  @Matches(/^[A-Za-z0-9_-]+$/u)
  trackingToken: string;
}

export class VelaCitiesQueryDto {
  @IsString()
  @IsIn(COUNTRY_CODES)
  country: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Matches(/\S/u)
  q: string;
}

export class VelaListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 60;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  skip = 0;
}
