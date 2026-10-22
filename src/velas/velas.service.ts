import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { createHash, randomBytes } from "node:crypto";
import { Model } from "mongoose";
import {
  CreateVelaDto,
  VelaCitiesQueryDto,
  VelaListQueryDto,
} from "./vela.dto";
import {
  findVelaCities,
  findVelaCity,
  listVelaCountries,
} from "./vela.locations";
import {
  VelaRateLimit,
} from "./vela-rate-limit.schema";
import { Vela } from "./vela.schema";

const HOUR_MS = 60 * 60 * 1000;
const CREATE_LIMIT_PER_HOUR = 8;
const CITY_SEARCH_LIMIT_PER_HOUR = 120;

export interface PublicVela {
  id: string;
  intention: string;
  dedication: string;
  name: string;
  color: string;
  startedAt: string;
  publishLocation: boolean;
  countryCode?: string;
  cityName?: string;
}

@Injectable()
export class VelasService {
  private readonly logger = new Logger(VelasService.name);

  constructor(
    @InjectModel(Vela.name) private readonly velaModel: Model<Vela>,
    @InjectModel(VelaRateLimit.name)
    private readonly rateLimitModel: Model<VelaRateLimit>,
  ) {}

  countries() {
    return { countries: listVelaCountries() };
  }

  async cities(query: VelaCitiesQueryDto, ip: string) {
    await this.enforceRateLimit(ip, "search", CITY_SEARCH_LIMIT_PER_HOUR);
    try {
      return {
        cities: await findVelaCities(query.country, query.q),
      };
    } catch (error) {
      this.logger.error(
        "GeoNames city search failed.",
        error instanceof Error ? error.stack : undefined,
      );
      throw new ServiceUnavailableException(
        "No pudimos buscar ciudades en este momento.",
      );
    }
  }

  async create(dto: CreateVelaDto, ip: string) {
    await this.enforceRateLimit(ip, "create", CREATE_LIMIT_PER_HOUR);

    const countryCode = dto.countryCode?.toUpperCase();
    let cityId: string | undefined;
    let cityName: string | undefined;

    if (dto.cityId) {
      if (!countryCode) {
        throw new BadRequestException(
          "Selecciona un país antes de elegir una ciudad.",
        );
      }
      try {
        const selectedCity = await findVelaCity(dto.cityId);
        if (!selectedCity || selectedCity.countryCode !== countryCode) {
          throw new BadRequestException(
            "La ciudad seleccionada no pertenece al país elegido.",
          );
        }
        cityId = String(selectedCity.geonameId);
        cityName = selectedCity.name;
      } catch (error) {
        if (error instanceof BadRequestException) throw error;
        this.logger.error(
          "GeoNames city validation failed.",
          error instanceof Error ? error.stack : undefined,
        );
        throw new ServiceUnavailableException(
          "No pudimos validar la ciudad seleccionada.",
        );
      }
    } else if (dto.cityName) {
      throw new BadRequestException(
        "Selecciona una ciudad de la lista para poder guardarla.",
      );
    }

    if (dto.publishLocation && (!countryCode || !cityName)) {
      throw new BadRequestException(
        "Selecciona país y ciudad para publicar la ubicación.",
      );
    }
    const reference = `V-${randomBytes(12).toString("hex").toUpperCase()}`;
    const candle = await this.velaModel.create({
      reference,
      intention: dto.intention,
      dedication: dto.dedication?.trim() ?? "",
      name: dto.name?.trim() ?? "",
      color: dto.color,
      startedAt: new Date(),
      ...(countryCode ? { countryCode } : {}),
      ...(cityId ? { cityId } : {}),
      ...(cityName ? { cityName } : {}),
      publishLocation: dto.publishLocation,
    });

    return { candle: this.toPublicVela(candle) };
  }

  async list(query: VelaListQueryDto) {
    const limit = Number.isInteger(query.limit)
      ? Math.min(100, Math.max(1, query.limit))
      : 60;
    const skip = Number.isInteger(query.skip)
      ? Math.min(10_000, Math.max(0, query.skip))
      : 0;
    const candles = await this.velaModel
      .find()
      .sort({ startedAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();
    return { candles: candles.map((candle) => this.toPublicVela(candle)) };
  }

  private toPublicVela(candle: Vela): PublicVela {
    const value: PublicVela = {
      id: candle.reference,
      intention: candle.intention,
      dedication: candle.dedication ?? "",
      name: candle.name ?? "",
      color: candle.color,
      startedAt: candle.startedAt.toISOString(),
      publishLocation: candle.publishLocation,
    };
    if (candle.publishLocation && candle.countryCode && candle.cityName) {
      value.countryCode = candle.countryCode;
      value.cityName = candle.cityName;
    }
    return value;
  }

  private async enforceRateLimit(
    ip: string,
    action: "create" | "search",
    limit: number,
  ): Promise<void> {
    const windowStart = Math.floor(Date.now() / HOUR_MS) * HOUR_MS;
    const bucket = createHash("sha256")
      .update(`candle:${action}:${ip || "unknown"}`)
      .digest("hex");
    const filter = { bucket, windowStart: new Date(windowStart) };
    const update = {
      $inc: { hits: 1 },
      $setOnInsert: {
        expiresAt: new Date(windowStart + 2 * HOUR_MS),
      },
    };
    let hits: VelaRateLimit | null;
    try {
      hits = await this.rateLimitModel
        .findOneAndUpdate(
          filter,
          update,
          { upsert: true, new: true, setDefaultsOnInsert: true },
        )
        .exec();
    } catch (error) {
      if (
        typeof error !== "object" ||
        error === null ||
        !("code" in error) ||
        error.code !== 11000
      ) {
        throw error;
      }
      hits = await this.rateLimitModel
        .findOneAndUpdate(filter, { $inc: { hits: 1 } }, { new: true })
        .exec();
    }
    const count = hits?.hits ?? 0;
    if (count > limit) {
      throw new HttpException(
        "Se alcanzó el límite de solicitudes. Inténtalo más tarde.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }
}
