import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from '../supabase/supabase.module.js';
import { VerificationClientService } from './verification-client.service.js';

@Module({
  imports: [ConfigModule, SupabaseModule],
  providers: [VerificationClientService],
  exports: [VerificationClientService],
})
export class VerificationClientModule {}
