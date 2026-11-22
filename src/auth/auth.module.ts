import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthenticationModule } from '@nestjs/authentication';
import { AuthController } from './auth.controller.js';
import { CasePolicy } from './case.policy.js';
import { CredentialsService } from './credentials.service.js';
import { readJwtSecret } from './jwt-secret.js';
import { JwtAuth } from './jwt.auth.js';
import { LoginGovController } from './login-gov.controller.js';
import { LoginGovService } from './login-gov.service.js';
import { RolePolicy } from './role.policy.js';
import { InMemoryUsersRepository } from './users.in-memory.repository.js';
import { UsersRepository } from './users.repository.js';

/** Bearer JWT (HS256, 8 h). Import before AuthorizationModule (guard order). */
export const AuthenticationRoot = AuthenticationModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) => {
    const key = readJwtSecret(config);
    return {
      accessToken: {
        key,
        ttl: '8h',
        // An operator's shorter JWT_SECRET still works (the package warns).
        allowShortSecret: Buffer.byteLength(key) < 32,
      },
      refreshToken: false,
    };
  },
});

@Global()
@Module({
  controllers: [AuthController, LoginGovController],
  providers: [
    // Swap for a database implementation here; nothing else depends on it.
    { provide: UsersRepository, useClass: InMemoryUsersRepository },
    CredentialsService,
    LoginGovService,
    JwtAuth,
    RolePolicy,
    CasePolicy,
  ],
  exports: [UsersRepository],
})
export class AuthModule {}
