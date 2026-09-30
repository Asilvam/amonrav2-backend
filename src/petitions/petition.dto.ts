import {
  Equals,
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";

const KINDS = ["Cadena de oración", "Encendido de vela", "Otra petición"] as const;
const DURATIONS = ["Una semana", "Un día", "Un mes"] as const;
const CANDLE_COLORS = ["Ayúdame a elegir", "Blanca", "Amarilla", "Roja", "Azul", "Otra"] as const;
const CANDLE_TYPES = ["Simbólico", "Vela física"] as const;

export class CreatePetitionDto {
  @IsIn(KINDS)
  kind: (typeof KINDS)[number];

  @ValidateIf((value: CreatePetitionDto) => value.kind === "Cadena de oración")
  @IsIn(DURATIONS)
  duration?: (typeof DURATIONS)[number];

  @ValidateIf((value: CreatePetitionDto) => value.kind === "Encendido de vela")
  @IsIn(CANDLE_COLORS)
  candleColor?: (typeof CANDLE_COLORS)[number];

  @ValidateIf((value: CreatePetitionDto) => value.kind === "Encendido de vela")
  @IsIn(CANDLE_TYPES)
  candleType?: (typeof CANDLE_TYPES)[number];

  @IsString()
  @MinLength(5)
  @MaxLength(600)
  message: string;

  @IsString()
  @MinLength(1)
  @MaxLength(80)
  @Matches(/\S/u)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsBoolean()
  share: boolean;

  @Equals(true)
  consent: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  website?: string;
}

export class ConfirmPetitionDto {
  @IsString()
  @MinLength(40)
  @MaxLength(60)
  @Matches(/^[A-Za-z0-9_-]+$/u)
  token: string;
}

export class ResendConfirmationDto {
  @IsString()
  @Matches(/^AM-[A-F0-9]{12}$/u)
  reference: string;

  @IsEmail()
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(10)
  @MaxLength(60)
  @Matches(/^[A-Za-z0-9_-]+$/u)
  trackingToken: string;
}

export class PetitionStatusDto {
  @IsString()
  @Matches(/^AM-[A-F0-9]{12}$/u)
  reference: string;

  @IsString()
  @MinLength(10)
  @MaxLength(60)
  @Matches(/^[A-Za-z0-9_-]+$/u)
  trackingToken: string;
}

export class AdminLoginDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  password: string;
}

export class UpdatePetitionStatusDto {
  @IsIn(["received", "completed", "cancelled"])
  status: "received" | "completed" | "cancelled";
}
