import type { OtpService } from '../OtpService';

export class FakeOtpService implements OtpService {
  async send(_phone: string, _code: string) { return { messageId: 'fake-msg-1' }; }
  async deliveryReport(_messageId: string) { return 'sent' as const; }
}
