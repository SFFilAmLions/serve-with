// Server-only registration eligibility foundation for SDDW-004.
// This module must be imported by the Worker only; never by client entry points.
// The allowlist is a private Worker environment variable, not admins.yaml.
export interface RegistrationEligibilityEnv {
  ENVIRONMENT?: string;
  STAGING_REGISTRATION_EMAILS?: string;
}
const email = (value: string) => value.trim().toLowerCase();
export function isStagingRegistrationEligible(
  value: string,
  env: RegistrationEligibilityEnv,
  enabledAdminEmails: ReadonlySet<string>,
): boolean {
  const candidate = email(value);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(candidate) || candidate.length > 254) return false;
  if (env.ENVIRONMENT !== 'staging') return false;
  if (enabledAdminEmails.has(candidate)) return true;
  return (env.STAGING_REGISTRATION_EMAILS || '').split(/[\s,;]+/)
    .some(entry => entry.length > 0 && email(entry) === candidate);
}
