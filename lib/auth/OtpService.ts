export interface OtpService {
  send(phone: string, code: string): Promise<{ messageId: string }>;
  deliveryReport(messageId: string): Promise<'sent' | 'failed' | 'pending'>;
}
