import { Module } from '@nestjs/common';
import { FamilyGroupsService } from './family-groups.service.js';
import { SupabaseModule } from '../supabase/supabase.module.js';

@Module({
  imports: [SupabaseModule],
  providers: [FamilyGroupsService],
  exports: [FamilyGroupsService],
})
export class FamilyGroupsModule {}
