import {
  Body,
  ConflictException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
} from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { Roles } from '../auth/roles.decorator.js';
import { toUserView, type User, type UserView } from '../auth/user.types.js';
import { UsersRepository } from '../auth/users.repository.js';
import { type UpdateUserInput, updateUserSchema } from './admin.schemas.js';

@Controller('admin/users')
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly users: UsersRepository) {}

  @Get()
  async list(): Promise<UserView[]> {
    return (await this.users.list()).map(toUserView);
  }

  /** A new role applies to that user's next request (the token holds no role). */
  @Patch(':id')
  async update(
    @CurrentUser() me: User,
    @Param('id') id: string,
    @Body({ schema: updateUserSchema }) body: UpdateUserInput,
  ): Promise<UserView> {
    if (id === me.id && body.role !== 'ADMIN') {
      throw new ConflictException(
        'Nie możesz odebrać sobie roli administratora.',
      );
    }
    const user = await this.users.updateRole(id, body.role);
    if (!user) throw new NotFoundException(`Nie ma użytkownika „${id}”.`);
    return toUserView(user);
  }
}
