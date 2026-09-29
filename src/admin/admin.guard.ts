import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { AdminAuthService } from "./admin-auth.service";

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly auth: AdminAuthService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers: { cookie?: string } }>();
    if (!this.auth.isAuthenticated(request.headers.cookie)) {
      throw new UnauthorizedException("Inicia sesión para continuar.");
    }
    return true;
  }
}
