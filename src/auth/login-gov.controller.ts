import { Body, Controller, HttpCode, Ip, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public, TokenService } from '@nestjs/authentication';
import {
  ApiBadRequestResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AuditService } from '../audit/audit.service.js';
import { DEFAULT_FRONTEND_URL } from '../configure-app.js';
import type { LoginResponse } from './auth.controller.js';
import {
  type LoginGovAuthorizeInput,
  loginGovAuthorizeSchema,
  type LoginGovExchangeInput,
  loginGovExchangeSchema,
} from './auth.schemas.js';
import { LoginRateLimit } from '../security/rate-limit.decorator.js';
import { TOKEN_VERSION_CLAIM } from './jwt.auth.js';
import { LoginGovService } from './login-gov.service.js';
import { USER_VIEW_SCHEMA } from './user.openapi.js';
import { toUserView } from './user.types.js';

const TOO_MANY_LOGINS =
  'Zbyt wiele prób logowania. Spróbuj ponownie za minutę.';

/** Frontend page of the simulated identity provider. */
export const MOCK_LOGIN_GOV_PATH = '/mock-login-gov';

/**
 * Sign-in "through login.gov.pl": a mock that follows the Węzeł Krajowy flow
 * (redirect with state → one-time artifact → exchange). Not SAML; see README.
 */
@ApiTags('auth')
@Public()
@Controller('auth/login-gov')
export class LoginGovController {
  constructor(
    private readonly loginGov: LoginGovService,
    private readonly tokens: TokenService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  @Post('start')
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Symulacja login.gov.pl: start logowania (state ważny 5 min, adres makiety)',
  })
  @ApiOkResponse({
    description: 'Przejdź pod `redirectUrl`.',
    schema: {
      type: 'object',
      properties: {
        redirectUrl: { type: 'string' },
        state: { type: 'string' },
      },
      required: ['redirectUrl', 'state'],
    },
  })
  start(): { redirectUrl: string; state: string } {
    const { state } = this.loginGov.start();
    const frontend = this.config
      .get<string>('FRONTEND_URL', DEFAULT_FRONTEND_URL)
      .replace(/\/$/, '');
    const redirectUrl = `${frontend}${MOCK_LOGIN_GOV_PATH}?state=${encodeURIComponent(state)}`;
    return { redirectUrl, state };
  }

  /** The mock identity provider. A real one never runs in this app. */
  @Post('mock-authorize')
  @LoginRateLimit(TOO_MANY_LOGINS)
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Makieta dostawcy tożsamości: jednorazowy artefakt (60 s) dla osoby demo',
  })
  @ApiOkResponse({
    description: 'Artefakt do wymiany w POST /api/auth/login-gov.',
    schema: {
      type: 'object',
      properties: { artifact: { type: 'string' } },
      required: ['artifact'],
    },
  })
  @ApiBadRequestResponse({
    description: 'Zły lub wygasły state, niepoprawny PESEL lub metoda.',
  })
  mockAuthorize(
    @Body({ schema: loginGovAuthorizeSchema }) body: LoginGovAuthorizeInput,
  ): {
    artifact: string;
  } {
    return {
      artifact: this.loginGov.mockAuthorize(
        body.state,
        body.pesel,
        body.method,
      ),
    };
  }

  /** Same answer as POST /api/auth/login. */
  @Post()
  @LoginRateLimit(TOO_MANY_LOGINS)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Symulacja login.gov.pl: wymiana artefaktu na token Bearer',
  })
  @ApiOkResponse({
    description: 'Zalogowano (jak POST /api/auth/login).',
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
  @ApiBadRequestResponse({ description: 'Zły lub wygasły state.' })
  @ApiUnauthorizedResponse({
    description: 'Artefakt użyty lub wygasły albo brak konta dla tej osoby.',
  })
  async exchange(
    @Body({ schema: loginGovExchangeSchema }) body: LoginGovExchangeInput,
    @Ip() ip: string,
  ): Promise<LoginResponse> {
    let user;
    try {
      user = await this.loginGov.exchange(body.artifact, body.state);
    } catch (err) {
      // Never the PESEL, the artifact or the state: only that it failed.
      await this.audit.record({
        actorId: null,
        actorRole: null,
        action: 'LOGIN_GOV_FAILED',
        resourceType: 'USER',
        resourceId: null,
        changedFields: [],
        ip: ip ?? null,
        result: 'DENIED',
      });
      throw err;
    }
    const { accessToken, expiresIn } = await this.tokens.issue(user.id, {
      method: 'login.gov.pl',
      claims: { [TOKEN_VERSION_CLAIM]: user.tokenVersion },
    });
    await this.audit.record({
      actorId: user.id,
      actorRole: user.role,
      action: 'LOGIN_GOV',
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
}
