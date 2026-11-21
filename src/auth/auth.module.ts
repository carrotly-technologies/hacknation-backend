import { Global, Module } from '@nestjs/common';
import { AuthenticationModule } from '@nestjs/authentication';
import { CasePolicy } from './case.policy.js';
import { DemoUserAuth } from './demo-user.auth.js';
import { RolePolicy } from './role.policy.js';
import { UsersController } from './users.controller.js';
import { InMemoryUsersRepository } from './users.in-memory.repository.js';
import { UsersRepository } from './users.repository.js';

/**
 * The global guard with no sign-in: DemoUserAuth reads `X-User-Id`. No tokens,
 * sessions or stores. Import before AuthorizationModule (guard order).
 */
export const AuthenticationRoot = AuthenticationModule.forRoot({
  refreshToken: false,
});

@Global()
@Module({
  controllers: [UsersController],
  providers: [
    // Swap for a database implementation here; nothing else depends on it.
    { provide: UsersRepository, useClass: InMemoryUsersRepository },
    DemoUserAuth,
    RolePolicy,
    CasePolicy,
  ],
  exports: [UsersRepository],
})
export class AuthModule {}
