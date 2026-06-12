import { Body, Controller, Get, Inject, Patch, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard.js';
import { RolesGuard } from '../common/auth/roles.guard.js';
import { Roles } from '../common/auth/roles.decorator.js';
import { AppRole } from '../../libs/contracts/src/roles.js';
import { SystemSettingsService } from './system-settings.service.js';
import { UpdatePhaseDto } from './dto/update-phase.dto.js';

interface RequestWithUser extends Request {
  user: { sub: string; email: string; role: AppRole };
}

@Controller('system-settings')
export class SystemSettingsController {
  constructor(@Inject(SystemSettingsService) private readonly systemSettingsService: SystemSettingsService) {}

  @Get('phase')
  getPhase(
    @Query('regionId') regionId?: string,
    @Query('personaRole') personaRole?: string,
  ) {
    return this.systemSettingsService.getPhase(regionId, personaRole);
  }

  @Patch('phase')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AppRole.ADMIN)
  updatePhase(@Body() dto: UpdatePhaseDto, @Req() req: RequestWithUser) {
    const changedBy = req.user.email;
    return this.systemSettingsService.updatePhase(dto.newPhase, changedBy);
  }
}
