import { Public } from '@nestjs/authentication';
import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { MonitorTokenGuard } from './monitor-token.guard.js';
import { type SessionsQuery, sessionsQuerySchema } from './monitor.schemas.js';
import { MonitorService } from './monitor.service.js';
import type { SessionDetail, SessionPage } from './monitor.types.js';
import { idParam } from '../security/params.schemas.js';

/** Activity of the app's users for the team (page /aktywnosc of the frontend). */
@ApiTags('monitor')
@ApiHeader({
  name: 'X-Monitor-Token',
  required: true,
  description: 'Wartość zmiennej MONITOR_TOKEN serwera.',
})
@ApiNotFoundResponse({
  description:
    'Brak albo zły X-Monitor-Token, albo MONITOR_TOKEN nie jest ustawiony (trasa jest wtedy niewidoczna).',
})
@Public()
@UseGuards(MonitorTokenGuard)
@Controller('monitor')
export class MonitorController {
  constructor(private readonly monitor: MonitorService) {}

  @Get('sessions')
  @ApiOperation({
    summary:
      'Sesje użytkowników: konta, IP, przeglądarka, pierwsza i ostatnia aktywność, liczba akcji',
  })
  @ApiOkResponse({
    description:
      '`{ items, total, page, pageSize }`, sesje z najnowszą aktywnością na górze.',
  })
  sessions(
    @Query({ schema: sessionsQuerySchema }) query: SessionsQuery,
  ): Promise<SessionPage> {
    return this.monitor.sessions(query);
  }

  @Delete('sessions')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Usuwa cały dziennik aktywności (wszystkie sesje i wpisy)',
  })
  @ApiOkResponse({ description: '`{ removed }`: liczba usuniętych wpisów.' })
  clear(): Promise<{ removed: number }> {
    return this.monitor.clear();
  }

  @Get('sessions/:sessionId')
  @ApiOperation({ summary: 'Oś czasu sesji: odsłony stron i wywołania API' })
  @ApiParam({
    name: 'sessionId',
    description: 'X-Session-Id (UUID) albo klucz `anon-…` z listy sesji.',
  })
  @ApiOkResponse({
    description: '`{ session, entries }`, wpisy od najstarszego.',
  })
  session(
    @Param('sessionId', { schema: idParam }) sessionId: string,
  ): Promise<SessionDetail> {
    return this.monitor.session(sessionId);
  }
}
