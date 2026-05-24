import { Module } from '@nestjs/common';
import { CheckInService } from './check-in.service.js';
import { SupabaseModule } from '../supabase/supabase.module.js';
import { FamilyGroupsModule } from '../family-groups/family-groups.module.js';

@Module({
  imports: [SupabaseModule, FamilyGroupsModule],
  providers: [CheckInService],
  exports: [CheckInService],
})
export class CheckInModule {}
