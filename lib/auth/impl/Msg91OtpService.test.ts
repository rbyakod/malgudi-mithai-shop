import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import nock from 'nock';
import { Msg91OtpService } from './Msg91OtpService';

describe('Msg91OtpService', () => {
  beforeEach(() => nock.cleanAll());
  afterEach(() => nock.enableNetConnect());

  it('sends OTP and returns messageId', async () => {
    nock('https://api.msg91.com')
      .get(/\/api\/v5\/otp/)
      .query(true)
      .reply(200, { message: 'msg-123', type: 'success' });

    const svc = new Msg91OtpService({ authKey: 'k', senderId: 'MISHRN', templateId: 'tpl' });
    const result = await svc.send('+919999999999', '123456');
    expect(result.messageId).toBe('msg-123');
  });

  it('throws on non-200', async () => {
    nock('https://api.msg91.com').get(/.*/).query(true).reply(500, 'err');
    const svc = new Msg91OtpService({ authKey: 'k', senderId: 'MISHRN', templateId: 'tpl' });
    await expect(svc.send('+919999999999', '123456')).rejects.toThrow(/MSG91/);
  });
});
