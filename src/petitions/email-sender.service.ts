import { Injectable, Logger } from "@nestjs/common";

@Injectable()
export class EmailSenderService {
  private readonly logger = new Logger(EmailSenderService.name);

  async send(to: string, subject: string, text: string, html: string): Promise<boolean> {
    const serviceUrl = process.env.EMAIL_SERVICE_API_URL || process.env.EMAIL_SERVICE_URL;
    const apiKey = process.env.EMAIL_SERVICE_API_KEY;
    if (!serviceUrl || !apiKey) {
      this.logger.error("Email service configuration is missing.");
      return false;
    }
    try {
      const endpoint = new URL(serviceUrl);
      const path = endpoint.pathname.replace(/\/+$/u, "");
      if (!path.endsWith("/send")) {
        endpoint.pathname = path.endsWith("/email") ? `${path}/send` : `${path}/email/send`;
      }
      this.logger.log(`Sending email via ${endpoint.origin}${endpoint.pathname}.`);
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Internal-API-Key": apiKey },
        body: JSON.stringify({ to, subject, text, html, fromName: "Amonra" }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        this.logger.error(`Email microservice returned HTTP ${response.status}.`);
        return false;
      }
      this.logger.log(`Email microservice accepted the message (HTTP ${response.status}).`);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      this.logger.error(`Could not reach the email microservice: ${message}`);
      return false;
    }
  }
}
