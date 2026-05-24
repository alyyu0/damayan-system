export class TribeClient {
  constructor(config) {
    this.config = config;
  }
  async authenticate() {
    return Promise.resolve();
  }
  async listTribeServices() {
    return [];
  }
  async listSharedServices() {
    return [];
  }
  async emailSend(payload) {
    return { success: true };
  }
  async smsSend(payload) {
    return { success: true };
  }
  async geoGeocodeAddress(payload) {
    const address = payload?.address ?? '';
    const countrycodes = payload?.region === 'PH' ? '&countrycodes=ph' : '';
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(address)}${countrycodes}`;
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'DAMAYAN-DisasterResponseSystem/1.0' } });
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return {
          latitude: Number.parseFloat(data[0].lat),
          longitude: Number.parseFloat(data[0].lon),
          formattedAddress: data[0].display_name,
          provider: 'nominatim',
        };
      }
    } catch {}
    return { latitude: null, longitude: null, formattedAddress: address, provider: 'nominatim' };
  }
}
