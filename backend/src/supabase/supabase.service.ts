import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';

type SupabaseClientInstance = ReturnType<typeof createClient>;

@Injectable()
export class SupabaseService {
  private readonly client: SupabaseClientInstance;
  private readonly supabaseUrl: string;
  private readonly supabaseServiceRoleKey: string;

  constructor(@Inject(ConfigService) private readonly configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseServiceRoleKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error(
        'Missing Supabase environment variables. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
      );
    }

    this.supabaseUrl = supabaseUrl;
    this.supabaseServiceRoleKey = supabaseServiceRoleKey;

    this.client = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  getClient(): SupabaseClientInstance {
    return this.client;
  }

  // Returns a fresh isolated client for operations like signInWithPassword that mutate
  // in-memory auth state. Using the shared singleton for those calls would leak a user's
  // JWT into concurrent service-role DB operations, causing RLS failures.
  createIsolatedClient(): SupabaseClientInstance {
    return createClient(this.supabaseUrl, this.supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
}
