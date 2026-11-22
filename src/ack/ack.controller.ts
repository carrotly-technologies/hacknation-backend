import { Public } from '@nestjs/authentication';
import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import {
  type ConfirmAckInput,
  confirmAckSchema,
  type ObjectionInput,
  objectionSchema,
} from './ack.schemas.js';
import { AckService } from './ack.service.js';
import type { AckDone, AckPending } from './ack.types.js';

/**
 * Public page of the assessed person: the link the evaluator generates with
 * SEND_FOR_ACK. No sign-in; the unguessable token is the only key.
 */
@ApiTags('ack')
@ApiParam({ name: 'token', description: 'Token z linku dla ocenianego.' })
@ApiNotFoundResponse({
  description: 'Nieznany, zastąpiony albo wygasły link.',
})
@Public()
@Controller('ack')
export class AckController {
  constructor(private readonly ack: AckService) {}

  @Get(':token')
  @ApiOperation({
    summary:
      'Arkusz do zapoznania się (bez logowania) albo stan po potwierdzeniu',
  })
  @ApiOkResponse({
    description: 'Arkusz albo data zapoznania się i termin sprzeciwu.',
  })
  read(@Param('token') token: string): AckPending | AckDone {
    return this.ack.read(token);
  }

  @Post(':token')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Potwierdzenie zapoznania się z oceną przez ocenianego',
  })
  @ApiOkResponse({
    description:
      'Data zapoznania się i termin sprzeciwu (ponowne potwierdzenie zwraca pierwszą datę).',
  })
  confirm(
    @Param('token') token: string,
    @Body({ schema: confirmAckSchema }) _body: ConfirmAckInput,
  ): AckDone {
    return this.ack.confirm(token);
  }

  /** The assessed person's objection (art. 83 ust. 1): once, within 7 days of the acknowledgement. */
  @Post(':token/objection')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Sprzeciw od oceny okresowej (art. 83 ust. 1, raz, w ciągu 7 dni)',
  })
  @ApiOkResponse({ description: 'Sprzeciw zapisany; treść jak w GET.' })
  @ApiConflictResponse({
    description:
      'Przed zapoznaniem się, po terminie, przy ocenie pierwszej albo ponownie.',
  })
  object(
    @Param('token') token: string,
    @Body({ schema: objectionSchema }) body: ObjectionInput,
  ): AckDone {
    return this.ack.object(token, body.text);
  }
}
