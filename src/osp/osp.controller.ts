import { Can } from '@nestjs/authorization';
import { Controller, Get } from '@nestjs/common';
import type { OspDoc } from '../cases/case.types.js';
import { OSP_DOCS, toOspDoc } from './osp.data.js';

@Can.Anyone()
@Controller('osp')
export class OspController {
  @Get()
  findAll(): OspDoc[] {
    return OSP_DOCS.map(toOspDoc);
  }
}
