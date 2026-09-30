import "dotenv/config";
import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { randomUUID } from "node:crypto";
import { Logger } from "@nestjs/common";
import { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";

function requireConfiguration(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta configurar ${name}.`);
  return value;
}

async function bootstrap() {
  const sessionSecret = requireConfiguration("SESSION_SECRET");
  if (sessionSecret.length < 32) throw new Error("SESSION_SECRET debe tener al menos 32 caracteres.");
  if (requireConfiguration("ADMIN_PASSWORD").length < 8) {
    throw new Error("ADMIN_PASSWORD debe tener al menos 8 caracteres.");
  }
  requireConfiguration("MONGODB_URI");
  if (!process.env.EMAIL_SERVICE_API_URL?.trim() && !process.env.EMAIL_SERVICE_URL?.trim()) {
    throw new Error("Falta configurar EMAIL_SERVICE_API_URL.");
  }
  requireConfiguration("EMAIL_SERVICE_API_KEY");
  requireConfiguration("PUBLIC_SITE_URL");
  const origins = requireConfiguration("WEB_ORIGINS").split(",").map((origin) => origin.trim()).filter(Boolean);

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const requestLogger = new Logger("HTTP");
  app.use((request: any, response: any, next: () => void) => {
    const requestId = randomUUID().slice(0, 8);
    const startedAt = Date.now();
    response.setHeader("X-Request-Id", requestId);
    requestLogger.log(`[${requestId}] -> ${request.method} ${request.path}`);
    response.on("finish", () => {
      requestLogger.log(`[${requestId}] <- ${request.method} ${request.path} ${response.statusCode} ${Date.now() - startedAt}ms`);
    });
    next();
  });
  app.setGlobalPrefix("api");
  app.enableCors({ origin: origins, credentials: true });
  app.useBodyParser("json", { limit: "12kb" });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.getHttpAdapter().getInstance().set("trust proxy", process.env.TRUST_PROXY === "true");

  const port = Number(process.env.PORT || 3001);
  await app.listen(port, "0.0.0.0");
  console.log(`Amonra petitions API listening on port ${port}`);
}

void bootstrap();
