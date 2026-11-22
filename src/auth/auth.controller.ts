import {
  Body,
  Controller,
  HttpCode,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { Public, TokenService } from '@nestjs/authentication';
import {
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { type LoginInput, loginSchema } from './auth.schemas.js';
import { CredentialsService } from './credentials.service.js';
import { USER_VIEW_SCHEMA } from './user.openapi.js';
import { toUserView, type UserView } from './user.types.js';

export interface LoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  /** Seconds until the token expires. */
  expiresIn: number;
  user: UserView;
}

@ApiTags('auth')
@Public()
@Controller('auth')
export class AuthController {
  constructor(
    private readonly credentials: CredentialsService,
    private readonly tokens: TokenService,
  ) {}

  @Post('login')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Logowanie loginem i hasłem: zwraca token Bearer (JWT, 8 h)',
  })
  @ApiOkResponse({
    description: 'Zalogowano. `accessToken` wklej w „Authorize”.',
    schema: {
      type: 'object',
      properties: {
        accessToken: { type: 'string' },
        tokenType: { type: 'string', enum: ['Bearer'] },
        expiresIn: { type: 'integer', description: 'Sekundy do wygaśnięcia.' },
        user: USER_VIEW_SCHEMA,
      },
      required: ['accessToken', 'tokenType', 'expiresIn', 'user'],
    },
  })
  @ApiUnauthorizedResponse({ description: 'Nieprawidłowy login lub hasło.' })
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
  @ApiOperation({
    summary: 'Wylogowanie (bez skutku po stronie serwera: klient usuwa token)',
  })
  @ApiNoContentResponse({ description: 'Wylogowano.' })
  logout(): void {}
}
