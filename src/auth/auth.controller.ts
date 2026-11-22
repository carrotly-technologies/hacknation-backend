import {
  Body,
  Controller,
  HttpCode,
  Ip,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import {
  Authenticate,
  CurrentSession,
  type JwtClaims,
  Public,
  TokenService,
} from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import {
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuditService } from '../audit/audit.service.js';
import { LoginRateLimit } from '../security/rate-limit.decorator.js';
import { type LoginInput, loginSchema } from './auth.schemas.js';
import { CredentialsService } from './credentials.service.js';
import { TOKEN_VERSION_CLAIM } from './jwt.auth.js';
import { RevokedTokens } from './revoked-tokens.service.js';
import { USER_VIEW_SCHEMA } from './user.openapi.js';
import { toUserView, type UserView } from './user.types.js';
import { UsersRepository } from './users.repository.js';

export interface LoginResponse {
  accessToken: string;
  tokenType: 'Bearer';
  /** Seconds until the token expires. */
  expiresIn: number;
  user: UserView;
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly credentials: CredentialsService,
    private readonly tokens: TokenService,
    private readonly users: UsersRepository,
    private readonly audit: AuditService,
    private readonly revoked: RevokedTokens,
  ) {}

  /**
   * Every attempt goes to the event log (LOGIN / LOGIN_FAILED): the account
   * id, never the login typed or the password.
   */
  @Post('login')
  @Public()
  @LoginRateLimit('Zbyt wiele prób logowania. Spróbuj ponownie za minutę.')
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
  @ApiTooManyRequestsResponse({
    description:
      'Zbyt wiele prób logowania z jednego adresu IP w ciągu minuty.',
  })
  async login(
    @Body({ schema: loginSchema }) body: LoginInput,
    @Ip() ip: string,
  ): Promise<LoginResponse> {
    const user = await this.credentials.verify(body.login, body.password);
    if (!user) {
      // The account the attempt targeted, when the login exists.
      const target = await this.users.findCredentials(body.login);
      await this.audit.record({
        actorId: null,
        actorRole: null,
        action: 'LOGIN_FAILED',
        resourceType: 'USER',
        resourceId: target?.user.id ?? null,
        changedFields: [],
        ip: ip ?? null,
        result: 'DENIED',
      });
      throw new UnauthorizedException('Nieprawidłowy login lub hasło.');
    }
    const { accessToken, expiresIn } = await this.tokens.issue(user.id, {
      method: 'password',
      claims: { [TOKEN_VERSION_CLAIM]: user.tokenVersion },
    });
    await this.audit.record({
      actorId: user.id,
      actorRole: user.role,
      action: 'LOGIN',
      resourceType: 'USER',
      resourceId: user.id,
      changedFields: [],
      ip: ip ?? null,
      result: 'OK',
    });
    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn,
      user: toUserView(user),
    };
  }

  /**
   * Ends the session of the token sent with it: the token is refused from now
   * on, even before it expires. Without a token it does nothing (204).
   */
  @Post('logout')
  @Authenticate({ optional: true })
  @Can.Anyone()
  @HttpCode(204)
  @ApiOperation({
    summary:
      'Wylogowanie: wysłany token przestaje działać (bez tokenu nic nie robi)',
  })
  @ApiNoContentResponse({ description: 'Wylogowano.' })
  logout(@CurrentSession() session: JwtClaims | null): void {
    if (session?.jti && session.exp) {
      this.revoked.revoke(session.jti, session.exp);
    }
  }
}
