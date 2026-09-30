import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  HttpException,
  HttpStatus,
  ServiceUnavailableException,
} from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { Model } from "mongoose";
import { CreatePetitionDto, PetitionStatusDto, ResendConfirmationDto } from "./petition.dto";
import { Petition, PetitionStatus } from "./petition.schema";
import { RateLimit } from "./rate-limit.schema";
import { EmailSenderService } from "./email-sender.service";

const DAY_MS = 24 * 60 * 60 * 1000;

function token(): string {
  return randomBytes(32).toString("base64url");
}

const TRACKING_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function trackingToken(): string {
  return Array.from(randomBytes(10), (byte) => TRACKING_ALPHABET[byte & 31]).join("");
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

function matchesTrackingToken(provided: string, storedHash: string): boolean {
  return safeEqual(hash(provided), storedHash) || safeEqual(hash(provided.toUpperCase()), storedHash);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => {
    const values: Record<string, string> = {
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    };
    return values[character];
  });
}

@Injectable()
export class PetitionsService {
  private readonly logger = new Logger(PetitionsService.name);

  constructor(
    @InjectModel(Petition.name) private readonly petitions: Model<Petition>,
    @InjectModel(RateLimit.name) private readonly rateLimits: Model<RateLimit>,
    private readonly emails: EmailSenderService,
  ) {}

  private async enforceLimit(ip: string, scope: string, maximum: number, windowMs: number) {
    const secret = process.env.SESSION_SECRET || "";
    const bucket = hash(`${secret}:${scope}:${ip}`);
    const startMs = Math.floor(Date.now() / windowMs) * windowMs;
    const windowStart = new Date(startMs);
    try {
      const record = await this.rateLimits.findOneAndUpdate(
        { bucket, windowStart },
        { $inc: { hits: 1 }, $setOnInsert: { expiresAt: new Date(startMs + 48 * 60 * 60 * 1000) } },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
      if ((record?.hits || 0) > maximum) {
        throw new HttpException("Demasiados intentos. Inténtalo más tarde.", HttpStatus.TOO_MANY_REQUESTS);
      }
    } catch (error) {
      if (error instanceof HttpException && error.getStatus() === HttpStatus.TOO_MANY_REQUESTS) throw error;
      this.logger.error("Rate limit storage failed.");
      throw new ServiceUnavailableException("No pudimos procesar la solicitud. Inténtalo más tarde.");
    }
  }

  async create(dto: CreatePetitionDto, ip: string) {
    this.logger.log(`Petition creation started (kind=${dto.kind}).`);
    await this.enforceLimit(ip, "petition-submit", 5, 60 * 60 * 1000);
    if (dto.website?.trim()) return { message: "Petición recibida." };

    const reference = `AM-${randomBytes(6).toString("hex").toUpperCase()}`;
    const confirmationToken = token();
    const trackingTokenValue = trackingToken();
    const email = dto.email.trim().toLowerCase();
    const petition = await this.petitions.create({
      reference,
      kind: dto.kind,
      duration: dto.kind === "Cadena de oración" ? dto.duration : undefined,
      candleColor: dto.kind === "Encendido de vela" ? dto.candleColor : undefined,
      candleType: dto.kind === "Encendido de vela" ? dto.candleType : undefined,
      message: dto.message.trim(),
      name: dto.name?.trim() || undefined,
      email,
      share: dto.share,
      status: "pending_confirmation",
      confirmationTokenHash: hash(confirmationToken),
      confirmationExpiresAt: new Date(Date.now() + DAY_MS),
      trackingTokenHash: hash(trackingTokenValue),
    });

    this.logger.log(`Petition saved (reference=${reference}, status=pending_confirmation).`);
    const confirmationSent = await this.sendConfirmation(email, reference, confirmationToken, trackingTokenValue);
    this.logger.log(`Confirmation email ${confirmationSent ? "sent" : "not sent"} (reference=${reference}).`);
    return {
      reference: petition.reference,
      trackingToken: trackingTokenValue,
      confirmationSent,
      message: confirmationSent
        ? "Petición guardada. Revisa tu correo y confirma la dirección dentro de 24 horas."
        : "Petición guardada, pero no pudimos enviar el correo. Puedes solicitar otro desde esta página.",
    };
  }

  async confirm(confirmationToken: string) {
    this.logger.log("Confirmation attempt received.");
    const petition = await this.petitions.findOneAndUpdate(
      {
        confirmationTokenHash: hash(confirmationToken),
        status: "pending_confirmation",
        confirmationExpiresAt: { $gt: new Date() },
      },
      {
        $set: { status: "received", confirmedAt: new Date() },
        $unset: { confirmationTokenHash: 1, confirmationExpiresAt: 1 },
      },
      { new: true },
    );
    if (!petition) {
      this.logger.warn("Confirmation rejected (token invalid, expired, or already used).");
      throw new BadRequestException("El enlace venció o ya se usó. Si la petición sigue pendiente, solicita otro correo.");
    }
    this.logger.log(`Petition confirmed (reference=${petition.reference}, status=${petition.status}).`);
    return { reference: petition.reference, status: petition.status };
  }

  async resend(dto: ResendConfirmationDto, ip: string) {
    this.logger.log("Confirmation resend requested.");
    await this.enforceLimit(ip, "petition-resend", 4, 60 * 60 * 1000);
    const petition = await this.petitions.findOne({
      reference: dto.reference.toUpperCase(),
      email: dto.email.trim().toLowerCase(),
      status: "pending_confirmation",
    }).select("+trackingTokenHash");
    if (petition && matchesTrackingToken(dto.trackingToken, petition.trackingTokenHash)) {
      const confirmationToken = token();
      petition.confirmationTokenHash = hash(confirmationToken);
      petition.confirmationExpiresAt = new Date(Date.now() + DAY_MS);
      await petition.save();
      this.logger.log(`Confirmation token renewed (reference=${petition.reference}).`);
      const sent = await this.sendConfirmation(petition.email, petition.reference, confirmationToken, dto.trackingToken);
      this.logger.log(`Resend email ${sent ? "sent" : "not sent"} (reference=${petition.reference}).`);
    } else {
      this.logger.warn("Resend not matched to a pending petition.");
    }
    return { message: "Si la petición está pendiente y los datos coinciden, enviaremos un nuevo correo." };
  }

  async status(dto: PetitionStatusDto, ip: string) {
    this.logger.log("Petition status lookup requested.");
    await this.enforceLimit(ip, "petition-status", 20, 60 * 60 * 1000);
    const petition = await this.petitions.findOne({ reference: dto.reference.toUpperCase() })
      .select("+trackingTokenHash");
    if (!petition || !matchesTrackingToken(dto.trackingToken, petition.trackingTokenHash)) {
      throw new NotFoundException("No encontramos una petición con esos datos.");
    }
    this.logger.log(`Petition status returned (reference=${petition.reference}, status=${petition.status}).`);
    return {
      reference: petition.reference,
      status: petition.status,
      createdAt: petition.createdAt,
      updatedAt: petition.updatedAt,
    };
  }

  async list(status: string) {
    const statuses = ["all", "pending_confirmation", "received", "completed", "cancelled"];
    if (!statuses.includes(status)) throw new BadRequestException("Filtro de estado inválido.");
    const filter = status === "all" ? {} : { status };
    return this.petitions.find(filter)
      .select("reference kind duration candleColor candleType message name phone email share status createdAt confirmedAt updatedAt")
      .sort({ createdAt: -1 })
      .limit(250)
      .lean();
  }

  async updateStatus(reference: string, status: PetitionStatus) {
    if (status === "pending_confirmation") throw new BadRequestException("No se puede administrar una petición sin correo confirmado.");
    const petition = await this.petitions.findOneAndUpdate(
      { reference: reference.toUpperCase(), status: { $ne: "pending_confirmation" } },
      { $set: { status } },
      { new: true },
    ).select("reference status updatedAt");
    if (!petition) throw new NotFoundException("No encontramos una petición confirmada con esa referencia.");
    return petition;
  }

  async deletePetition(reference: string) {
    const petition = await this.petitions.findOneAndDelete({
      reference: reference.toUpperCase(),
    }).select("reference");
    if (!petition) throw new NotFoundException("No encontramos una petición con esa referencia.");
    this.logger.warn(`Petition permanently deleted (reference=${petition.reference}).`);
    return { deleted: true, reference: petition.reference };
  }

  private async sendConfirmation(email: string, reference: string, confirmationToken: string, trackingToken: string) {
    const siteUrl = process.env.PUBLIC_SITE_URL?.replace(/\/+$/u, "");
    if (!siteUrl) {
      this.logger.error("PUBLIC_SITE_URL is missing.");
      return false;
    }
    this.logger.log(`Preparing confirmation email (reference=${reference}).`);
    const confirmationUrl = `${siteUrl}/peticiones/confirmar/?token=${encodeURIComponent(confirmationToken)}`;
    const statusUrl = `${siteUrl}/peticiones/estado/`;
    const safeConfirmationUrl = escapeHtml(confirmationUrl);
    const safeStatusUrl = escapeHtml(statusUrl);
    const safeReference = escapeHtml(reference);
    const safeTrackingToken = escapeHtml(trackingToken);
    const text = `Confirma que esta petición fue enviada desde tu correo: ${confirmationUrl}\n\nReferencia: ${reference}\nCódigo de seguimiento (10 caracteres): ${trackingToken}\nConsulta: ${statusUrl}\n\nEl enlace de confirmación vence en 24 horas.`;
    const html = `<main style="font-family:Arial,sans-serif;line-height:1.6;color:#29251f"><h1>Confirma tu correo</h1><p>Para registrar tu petición en Amonra, confirma que tienes acceso a esta dirección:</p><p><a href="${safeConfirmationUrl}">Confirmar mi correo</a></p><p>Este enlace vence en 24 horas. Si no hiciste esta petición, ignora el mensaje.</p><hr><p><strong>Referencia:</strong> ${safeReference}</p><p><strong>Código de seguimiento:</strong> <code>${safeTrackingToken}</code></p><p>Guárdalo para consultar el estado en <a href="${safeStatusUrl}">${safeStatusUrl}</a>. No compartas esta clave.</p></main>`;
    return this.emails.send(email, "Confirma tu correo para registrar tu petición · Amonra", text, html);
  }
}
