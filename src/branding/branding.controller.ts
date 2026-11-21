import { Public } from '@nestjs/authentication';
import { Can } from '@nestjs/authorization';
import { Body, Controller, Get, Put } from '@nestjs/common';
import { type AcceptLogoInput, acceptLogoSchema } from './branding.schemas.js';
import { BrandingService } from './branding.service.js';
import type { LogoChoice } from './branding.types.js';

@Can.Anyone()
@Controller('branding')
export class BrandingController {
  constructor(private readonly branding: BrandingService) {}

  /** Public: the sign-in page shows the accepted logo too. */
  @Public()
  @Get('logo')
  getLogo(): Promise<LogoChoice> {
    return this.branding.getLogo();
  }

  /** Every signed-in role. */
  @Put('logo')
  acceptLogo(
    @Body({ schema: acceptLogoSchema }) body: AcceptLogoInput,
  ): Promise<LogoChoice> {
    return this.branding.acceptLogo(body.logoId);
  }
}
