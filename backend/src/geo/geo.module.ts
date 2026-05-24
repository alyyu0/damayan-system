import { Module } from '@nestjs/common';
import { GeoService } from './geo.service.js';
import { GeoController } from './geo.controller.js';

@Module({
  controllers: [GeoController],
  providers: [GeoService],
  exports: [GeoService],
})
export class GeoModule {}
