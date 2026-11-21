import {
  Body,
  Controller,
  HttpCode,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { Public, TokenService } from '@nestjs/authentication';
import { type LoginInput, loginSchema } from './auth.schemas.js';
import { CredentialsService } from './credentials.service.js';
import { toUserView, type UserView } from './user.types.js';

export interface LoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  /** Seconds until the token expires. */
  expiresIn: number;
  user: UserView;
}

@Public()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly credentials: CredentialsService,
    private readonly tokens: TokenService,
  ) {}

  @Post('login')
  @HttpCode(200)
  async login(
    @Body({ schema: loginSchema }) body: LoginInput,
  ): Promise<LoginResponse> {
    const user = await this.credentials.verify(body.login, body.password);
    if (!user)
      throw new UnauthorizedException('Nieprawidłowy login lub hasło.');
    const { accessToken, expiresIn } = await this.tokens.issue(user.id, {
      method: 'password',
    });
    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn,
      user: toUserView(user),
    };
  }

  /** Tokens are stateless: the client drops its token. Kept for symmetry. */
  @Post('logout')
  @HttpCode(204)
  logout(): void {}
}
