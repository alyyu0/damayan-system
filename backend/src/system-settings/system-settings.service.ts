import { Inject, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import { SystemPhase } from './dto/update-phase.dto.js';

@Injectable()
export class SystemSettingsService {
  constructor(@Inject(SupabaseService) private readonly supabaseService: SupabaseService) {}

  async getPhase(
    regionId?: string,
    personaRole?: string,
  ): Promise<{ currentPhase: SystemPhase; updatedAt: string }> {
    // 1. If the caller supplies both regionId and personaRole, check for an active
    //    regional persona-phase override first.
    if (regionId && personaRole) {
      const { data: override } = await this.supabaseService
        .getClient()
        .from('region_persona_phase_controls')
        .select('phase, updated_at')
        .eq('region_id', regionId)
        .eq('persona_role', personaRole)
        .eq('visible_to_assigned_users', true)
        .maybeSingle();

      if (override?.phase) {
        return {
          currentPhase: override.phase as SystemPhase,
          updatedAt: override.updated_at as string,
        };
      }
    }

    // 1b. If only personaRole is known (e.g. citizens who have no assigned region),
    //     check for any active override for that persona across all regions.
    //     The most recently updated override wins, so the admin can set a single
    //     region's citizen override and it propagates to all citizens.
    if (personaRole && !regionId) {
      const { data: override } = await this.supabaseService
        .getClient()
        .from('region_persona_phase_controls')
        .select('phase, updated_at')
        .eq('persona_role', personaRole)
        .eq('visible_to_assigned_users', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (override?.phase) {
        return {
          currentPhase: override.phase as SystemPhase,
          updatedAt: override.updated_at as string,
        };
      }
    }

    // 2. Fall back to the global system-settings row.
    const { data, error } = await this.supabaseService
      .getClient()
      .from('system_settings')
      .select('current_phase, updated_at')
      .eq('id', 1)
      .single();

    if (error || !data) {
      throw new NotFoundException('System settings not found. Ensure the system_settings table has a row with id=1.');
    }

    return { currentPhase: data.current_phase as SystemPhase, updatedAt: data.updated_at };
  }

  async updatePhase(
    newPhase: SystemPhase,
    changedBy: string,
  ): Promise<{ message: string; previousPhase: SystemPhase; currentPhase: SystemPhase }> {
    const { data: current, error: fetchError } = await this.supabaseService
      .getClient()
      .from('system_settings')
      .select('current_phase')
      .eq('id', 1)
      .single();

    if (fetchError || !current) {
      throw new NotFoundException('System settings not found. Ensure the system_settings table has a row with id=1.');
    }

    const previousPhase = current.current_phase as SystemPhase;

    const { error: updateError } = await this.supabaseService
      .getClient()
      .from('system_settings')
      .update({ current_phase: newPhase, updated_at: new Date().toISOString() })
      .eq('id', 1);

    if (updateError) {
      throw new InternalServerErrorException(`Failed to update phase: ${updateError.message}`);
    }

    // Log the phase change for post-disaster audit trail
    await this.supabaseService
      .getClient()
      .from('phase_history_logs')
      .insert({
        previous_phase: previousPhase,
        new_phase: newPhase,
        changed_by: changedBy,
        changed_at: new Date().toISOString(),
      });

    return {
      message: `System phase successfully shifted from ${previousPhase} to ${newPhase}`,
      previousPhase,
      currentPhase: newPhase,
    };
  }
}
