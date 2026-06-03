import { Injectable, Inject, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service.js';

export interface VerificationStatus {
  status: string;
  flags: string[];
  approvalSignals: string[];
}

const VERIFICATION_STATUS_PRIORITY = [
  'completed',
  'approved',
  'done',
  'passed',
  'processing',
  'queued',
  'pending',
  'running',
  'unknown',
] as const;

function normalizeVerificationStatus(value: unknown): string {
  const status = typeof value === 'string' ? value.trim().toLowerCase() : '';

  if (!status) return 'unknown';
  if (['completed', 'approved', 'done', 'passed', 'success', 'verified'].includes(status)) {
    return 'completed';
  }
  if (['processing', 'queued', 'pending', 'running', 'in_progress', 'in-progress'].includes(status)) {
    return 'processing';
  }
  if (['failed', 'rejected', 'error', 'cancelled', 'canceled'].includes(status)) {
    return 'failed';
  }

  return status;
}

@Injectable()
export class VerificationClientService {
  private readonly logger = new Logger(VerificationClientService.name);

  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(SupabaseService) private readonly supabaseService: SupabaseService,
  ) {}

  private get apiUrl(): string | null {
    return this.configService.get<string>('VERIFY_API_URL') ?? null;
  }

  private get apiKey(): string | null {
    return this.configService.get<string>('VERIFY_API_KEY') ?? null;
  }

  /**
   * Download the government ID from Supabase Storage, submit to the
   * verification API, and store the returned job ID on the user profile.
   * Called fire-and-forget after signup — never throws.
   */
  async submitGovernmentId(
    authUserId: string,
    fullName: string,
    governmentIdKey: string,
  ): Promise<void> {
    if (!this.apiUrl || !this.apiKey) return;

    try {
      const supabase = this.supabaseService.getClient() as any;
      const bucket =
        this.configService.get<string>('SUPABASE_GOVERNMENT_IDS_BUCKET') ??
        'government-ids';

      // Strip leading "bucket/" prefix — legacy signups stored key as "bucket/objectPath"
      const normalizedKey = governmentIdKey.startsWith(`${bucket}/`)
        ? governmentIdKey.slice(bucket.length + 1)
        : governmentIdKey;

      const { data: blob, error: downloadError } = await supabase.storage
        .from(bucket)
        .download(normalizedKey);

      if (downloadError || !blob) {
        this.logger.warn(
          `[VerificationClient] Could not download government ID for ${authUserId}: ${downloadError?.message}`,
        );
        return;
      }

      const fileName = normalizedKey.split('/').pop() ?? 'government_id.jpg';
      const contentType = this.detectContentType(fileName);

      const form = new FormData();
      form.append('file', new File([blob as Blob], fileName, { type: contentType }));
      form.append('user_id', authUserId);
      form.append('document_type', 'government_id');
      form.append('expected_name', fullName);
      form.append('system_id', 'system3');

      const response = await fetch(`${this.apiUrl}/api/v1/verify`, {
        method: 'POST',
        headers: { 'X-API-Key': this.apiKey },
        body: form,
      });

      if (!response.ok) {
        this.logger.warn(
          `[VerificationClient] Verification API returned ${response.status} for ${authUserId}`,
        );
        return;
      }

      const result = (await response.json()) as { job_id?: string };
      if (!result.job_id) return;

      await supabase
        .from('user_profiles')
        .update({ verification_job_id: result.job_id })
        .eq('auth_user_id', authUserId);

      this.logger.log(
        `[VerificationClient] Job ${result.job_id} created for user ${authUserId}`,
      );
    } catch (err: any) {
      // Never block signup — log and swallow
      this.logger.warn(
        `[VerificationClient] Non-fatal error for ${authUserId}: ${err?.message}`,
      );
    }
  }

  /**
   * Fetch flags and approval signals for a given verification job ID.
   * Returns null if verification API is not configured or the request fails.
   */
  async getJobStatus(jobId: string): Promise<VerificationStatus | null> {
    if (!this.apiUrl || !this.apiKey) return null;

    try {
      const response = await fetch(`${this.apiUrl}/api/v1/status/${jobId}`, {
        headers: { 'X-API-Key': this.apiKey },
        signal: AbortSignal.timeout(4000),
      });

      if (!response.ok) return null;

      const data = (await response.json()) as any;
      this.logger.log(`[VerificationClient] Status response for ${jobId}: ${JSON.stringify(data)}`);

      // Normalise — different API versions may nest flags differently
      const result = data.result ?? data;
      const statusCandidates = [
        data.status,
        result.status,
        data.job_status,
        data.jobStatus,
        data.state,
        data.verification_status,
        result.job_status,
        result.jobStatus,
        result.state,
        result.verification_status,
      ]
        .map(normalizeVerificationStatus)
        .filter(Boolean);

      const resolvedStatus =
        VERIFICATION_STATUS_PRIORITY.find((candidate) => statusCandidates.includes(candidate)) ??
        statusCandidates[0] ??
        'unknown';

      const flags: string[] =
        result.flags ?? result.issues ?? result.red_flags ?? data.flags ?? [];
      const approvalSignals: string[] =
        result.approval_signals ?? result.signals ?? result.green_flags ??
        result.approvals ?? data.approval_signals ?? [];

      return {
        status: resolvedStatus,
        flags: Array.isArray(flags) ? flags : [],
        approvalSignals: Array.isArray(approvalSignals) ? approvalSignals : [],
      };
    } catch (err: any) {
      this.logger.warn(`[VerificationClient] getJobStatus error for ${jobId}: ${err?.message}`);
      return null;
    }
  }

  private detectContentType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'png') return 'image/png';
    if (ext === 'gif') return 'image/gif';
    if (ext === 'webp') return 'image/webp';
    return 'image/jpeg';
  }
}
