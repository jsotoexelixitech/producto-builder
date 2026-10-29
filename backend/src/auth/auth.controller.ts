import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthService, AuthUserPayload } from './auth.service';
import { LoginDto, SignupDto } from './dto/auth.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Sin registro abierto: el sitio escribe en Sis2000 y está publicado en cierrelmds.
  @Roles(UserRole.ADMIN)
  @Post('signup')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crear usuario (solo ADMIN)' })
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Iniciar sesión' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Usuario autenticado actual' })
  me(@CurrentUser() user: AuthUserPayload) {
    return this.authService.me(user.sub);
  }
}
