import { describe, expect, it } from 'vitest';
import {
  EmailProvider,
  PushProvider,
  SmsProvider,
  WhatsAppProvider,
} from '../src/modules/notifications/notification.providers';
import { renderTemplate } from '../src/modules/notifications/template.renderer';

describe('notification templates', () => {
  it('renders nested values and removes missing placeholders', () => {
    expect(
      renderTemplate('Hello {{customer.name}} {{missing}}', { customer: { name: 'Sam' } }),
    ).toBe('Hello Sam ');
  });

  it('supports one mixed-order confirmation with both sections and Challenge 25', () => {
    const body = renderTemplate(
      'GROCERY ITEMS\n{{grocerySection}}\nALCOHOL ITEMS (18+)\n{{alcoholSection}}\n{{challenge25Notice}}',
      {
        grocerySection: '1 × Milk',
        alcoholSection: '1 × Wine',
        challenge25Notice: 'Challenge 25: valid photo ID will be required on delivery.',
      },
    );
    expect(body).toContain('1 × Milk');
    expect(body).toContain('1 × Wine');
    expect(body).toContain('Challenge 25');
  });
});

describe('notification provider contract', () => {
  it.each([new EmailProvider(), new SmsProvider(), new PushProvider(), new WhatsAppProvider()])(
    '$channel provider returns a message identifier',
    async (provider) => {
      const result = await provider.send({ recipient: 'recipient', body: 'body', data: {} });
      expect(result.messageId).toBeTruthy();
    },
  );

  it('keeps WhatsApp disabled as a harmless no-op', async () => {
    const previous = process.env.WHATSAPP_ENABLED;
    process.env.WHATSAPP_ENABLED = 'false';
    await expect(
      new WhatsAppProvider().send({ recipient: 'recipient', body: 'body', data: {} }),
    ).resolves.toEqual({ messageId: 'whatsapp-disabled-noop' });
    process.env.WHATSAPP_ENABLED = previous;
  });
});
