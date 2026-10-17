import { Controller, Get } from "@nestjs/common";

@Controller()
export class HealthController {
  @Get()
  root() {
    return this.response();
  }

  @Get("health")
  check() {
    return this.response();
  }

  private response() {
    return { status: "ok", message: "Hola mundo", service: "amonra-petitions-api" };
  }
}
