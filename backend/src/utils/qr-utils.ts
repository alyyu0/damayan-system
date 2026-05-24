/** Generates a unique QR code ID.
 * @param prefix - e.g. 'DMY' for individual citizens, 'FAM' for family groups
 * Format: PREFIX-YYYYMMDD-XXXX  (4-digit random suffix)
 */
export function generateQrCodeId(prefix = 'DMY'): string {
  const now = new Date();
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const suffix = String(Math.floor(1000 + Math.random() * 9000));
  return `${prefix}-${date}-${suffix}`;
}
