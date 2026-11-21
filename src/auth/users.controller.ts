import { Controller, Get } from '@nestjs/common';
import { Public } from '@nestjs/authentication';
import { toUserView, type UserView } from './user.types.js';
import { UsersRepository } from './users.repository.js';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersRepository) {}

  /** The demo accounts for the account switcher (public: works with any header). */
  @Public()
  @Get('demo')
  async demo(): Promise<UserView[]> {
    return (await this.users.list()).map(toUserView);
  }
}
