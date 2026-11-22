import { Can } from '@nestjs/authorization';
import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { OspDoc } from '../cases/case.types.js';
import { OSP_DOCS, toOspDoc } from './osp.data.js';

@ApiTags('osp')
@Can.Anyone()
@Controller('osp')
export class OspController {
  @Get()
  @ApiOperation({ summary: 'Opisy stanowisk pracy z materiałów' })
  @ApiOkResponse({ description: 'Dokumenty OSP.' })
  findAll(): OspDoc[] {
    return OSP_DOCS.map(toOspDoc);
  }
}
