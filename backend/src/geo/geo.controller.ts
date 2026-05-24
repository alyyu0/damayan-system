import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { GeoService } from './geo.service.js';
import { JwtAuthGuard } from '../common/auth/jwt-auth.guard.js';
import { RolesGuard } from '../common/auth/roles.guard.js';
import { Roles } from '../common/auth/roles.decorator.js';
import { AppRole } from '../../libs/contracts/src/roles.js';

class GeofenceCheckDto {
  latitude!: number;
  longitude!: number;
  fenceId!: string;
}

class ResolvePinDto {
  latitude!: number;
  longitude!: number;
}

@Controller('geo')
export class GeoController {
  constructor(private readonly geoService: GeoService) {}

  @Post('admin/geofence-check')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AppRole.ADMIN, AppRole.DISPATCHER)
  async verifyGeofence(
    @Body() body: GeofenceCheckDto,
  ): Promise<{ success: boolean; inside: boolean }> {
    const inside = await this.geoService.checkFence(
      body.latitude,
      body.longitude,
      body.fenceId,
    );
    return { success: true, inside };
  }

  @Post('citizen/resolve-pin')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async resolvePinLocation(@Body() body: ResolvePinDto): Promise<{
    success: boolean;
    data: {
      latitude: number;
      longitude: number;
      resolved_address: string;
    };
  }> {
    const resolved_address = await this.geoService.getAddressFromCoords(
      body.latitude,
      body.longitude,
    );
    return {
      success: true,
      data: {
        latitude: body.latitude,
        longitude: body.longitude,
        resolved_address,
      },
    };
  }
}
