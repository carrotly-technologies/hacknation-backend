import { type ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';

/** Polish answers for the errors of reading a request body (body-parser `type`). */
const MESSAGES: Record<string, (limit: string) => string> = {
  'entity.too.large': (limit) =>
    `Przesłane dane są zbyt duże (limit: ${limit}).`,
  'parameters.too.many': () => 'Przesłano zbyt wiele pól formularza.',
  'entity.parse.failed': () =>
    'Nieprawidłowy format danych: treść żądania musi być poprawnym JSON-em.',
  'charset.unsupported': () =>
    'Nieobsługiwane kodowanie znaków. Wyślij dane w UTF-8.',
  'encoding.unsupported': () => 'Nieobsługiwana kompresja treści żądania.',
};

/**
 * Body-parser errors (over the size limit, broken JSON) with a plain Polish
 * message instead of the library's English one. Every other error goes to
 * Nest's built-in handling unchanged.
 */
@Catch(HttpException)
export class BodyErrorsFilter extends BaseExceptionFilter {
  constructor(
    applicationRef: ConstructorParameters<typeof BaseExceptionFilter>[0],
    private readonly limit: string,
  ) {
    super(applicationRef);
  }

  catch(exception: HttpException, host: ArgumentsHost): void {
    const type = (exception.cause as { type?: unknown } | undefined)?.type;
    const message = typeof type === 'string' ? MESSAGES[type] : undefined;
    if (!message) return super.catch(exception, host);
    const statusCode = exception.getStatus();
    super.catch(
      new HttpException(
        { statusCode, message: message(this.limit) },
        statusCode,
        { cause: exception },
      ),
      host,
    );
  }
}
