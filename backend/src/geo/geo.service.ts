import {
  Injectable,
  OnModuleInit,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { TribeClient } from '@implementsprint/sdk';

// Extended interface covering the geo methods the real SDK exposes.
// The local stub at libs/implementsprint-sdk is a placeholder; the full
// package from npm.pkg.github.com includes these methods.
interface GeoCapableTribeClient extends TribeClient {
  geoFenceCheck(payload: {
    latitude: number;
    longitude: number;
    fenceId: string;
  }): Promise<boolean | { inside: boolean } | Record<string, unknown>>;
  geoReverseGeocode(payload: {
    latitude: number;
    longitude: number;
  }): Promise<{ formattedAddress?: string; address?: string } | Record<string, unknown>>;
}

@Injectable()
export class GeoService implements OnModuleInit {
  private client: GeoCapableTribeClient;
  private readonly logger = new Logger(GeoService.name);
  private readonly gatewayUrl: string;
  private readonly secret: string;

  constructor() {
    this.gatewayUrl = process.env.APICENTER_URL ?? 'http://localhost:3000';
    this.secret = process.env.APICENTER_TRIBE_SECRET ?? '';

    this.client = new TribeClient({
      gatewayUrl: this.gatewayUrl,
      tribeId: process.env.APICENTER_TRIBE_ID ?? 'drrrm-tribe',
      secret: this.secret,
    }) as GeoCapableTribeClient;
  }

  async onModuleInit(): Promise<void> {
    try {
      this.logger.log('Initializing TribeClient Geofencing SDK…');
      await this.client.authenticate();
      this.logger.log('TribeClient SDK authenticated successfully.');
    } catch (error) {
      this.logger.error(
        'Failed to authenticate TribeClient SDK:',
        (error as Error).stack,
      );
      throw error;
    }
  }

  async checkFence(
    latitude: number,
    longitude: number,
    fenceId: string,
  ): Promise<boolean> {
    try {
      if (typeof this.client.geoFenceCheck === 'function') {
        const result = await this.client.geoFenceCheck({ latitude, longitude, fenceId });
        if (typeof result === 'boolean') return result;
        if (result && typeof result === 'object' && 'inside' in result) {
          return !!(result as { inside: boolean }).inside;
        }
        return !!result;
      }
      // Fallback: direct HTTP call when the local SDK stub lacks the method
      const res = await this.apicenterPost<{ inside: boolean }>(
        '/geo/fence-check',
        { latitude, longitude, fenceId },
      );
      return !!res?.inside;
    } catch (error) {
      this.logger.error(
        `Geofence check failed for fence "${fenceId}":`,
        (error as Error).message,
      );
      throw new InternalServerErrorException(
        'Geofencing validation service unavailable',
      );
    }
  }

  async getAddressFromCoords(
    latitude: number,
    longitude: number,
  ): Promise<string> {
    const fallback = `${latitude}, ${longitude}`;
    try {
      if (typeof this.client.geoReverseGeocode === 'function') {
        const response = await this.client.geoReverseGeocode({ latitude, longitude });
        const r = response as { formattedAddress?: string; address?: string };
        return r?.formattedAddress ?? r?.address ?? fallback;
      }
      // Fallback: direct HTTP call
      const res = await this.apicenterPost<{
        formattedAddress?: string;
        address?: string;
      }>('/geo/reverse-geocode', { latitude, longitude });
      return res?.formattedAddress ?? res?.address ?? fallback;
    } catch (error) {
      this.logger.warn(
        `Reverse geocoding failed for [${latitude}, ${longitude}]:`,
        (error as Error).message,
      );
      return fallback;
    }
  }

  private async apicenterPost<T>(path: string, body: unknown): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    try {
      const res = await fetch(`${this.gatewayUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tribe-Secret': this.secret,
          'X-Service-Id': process.env.APICENTER_SERVICE_ID ?? 'drrrm-operations',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`APICenter responded with HTTP ${res.status}`);
      }
      return res.json() as Promise<T>;
    } finally {
      clearTimeout(timeout);
    }
  }
}
