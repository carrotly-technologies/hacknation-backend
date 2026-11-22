import { Public } from '@nestjs/authentication';
import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
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
@Public()
@Controller('ack')
export class AckController {
  constructor(private readonly ack: AckService) {}

  @Get(':token')
  read(@Param('token') token: string): AckPending | AckDone {
    return this.ack.read(token);
  }

  @Post(':token')
  @HttpCode(200)
  confirm(
    @Param('token') token: string,
    @Body({ schema: confirmAckSchema }) _body: ConfirmAckInput,
  ): AckDone {
    return this.ack.confirm(token);
  }

  /** The assessed person's objection (art. 83 ust. 1): once, within 7 days of the acknowledgement. */
  @Post(':token/objection')
  @HttpCode(200)
  object(
    @Param('token') token: string,
    @Body({ schema: objectionSchema }) body: ObjectionInput,
  ): AckDone {
    return this.ack.object(token, body.text);
  }
}
