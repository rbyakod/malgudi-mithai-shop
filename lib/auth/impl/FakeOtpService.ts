import type { OtpService } from '../OtpService';

export class FakeOtpService implements OtpService {
  async send() { return { messageId: 'fake-msg-1' }; }
  async deliveryReport() { return 'sent' as const; }
}
