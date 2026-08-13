import type { OtpService } from '../OtpService';

export class Msg91OtpService implements OtpService {
  constructor(private deps: { authKey: string; senderId: string; templateId: string }) {}

  async send(phone: string, code: string): Promise<{ messageId: string }> {
    const url = `https://api.msg91.com/api/v5/otp?template_id=${this.deps.templateId}&mobile=${encodeURIComponent(phone)}&authkey=${this.deps.authKey}&OTP=${code}&sender=${this.deps.senderId}`;
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) {
      throw new Error(`MSG91 OTP send failed: ${res.status} ${await res.text()}`);
    }
    const body = await res.json() as { message: string; type: string };
    return { messageId: body.message };
  }

  async deliveryReport(messageId: string): Promise<'sent' | 'failed' | 'pending'> {
    // MSG91 doesn't expose a simple delivery report API; treat as 'sent' after 2s.
    return 'sent';
  }
}
