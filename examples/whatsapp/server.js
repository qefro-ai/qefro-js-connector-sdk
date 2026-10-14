import 'dotenv/config';
import { Qefro } from '@qefro-ai/connector';

const port = Number(process.env.PORT || 8088);
const app = new Qefro({ signingSecret: process.env.QEFRO_SIGNING_SECRET || 'dev-secret' });

function getArgs(ctx) {
  return ctx?.args || ctx?.input?.args || ctx?.request?.args || {};
}

function asString(value, fallback = '') {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;
}

app.customer({
  async lookup(ctx) {
    return {
      id: asString(ctx?.identity?.phone, asString(ctx?.identity?.customer_id, 'wa-user-1')),
      channel: 'whatsapp',
    };
  },
  async authorize(ctx) {
    return {
      kind: 'success',
      customer: ctx.customer,
      auth: { type: 'bearer_token', access_token: `wa-${ctx.customer.id}`, expires_in: 900 },
    };
  },
});

// ---------------------------------------------------------------------------
// WhatsApp Capability: Message Templates and Interactive Flows
// ---------------------------------------------------------------------------

app.whatsapp({
  version: 1,
  templates: [
    {
      name: 'order_update',
      language: 'en_US',
      category: 'UTILITY',
      providerId: 'order_update_v1',
      description: 'Notify customer of an update to their active order',
      components: [
        {
          type: 'BODY',
          text: 'Hello {{1}}, here is an update on your purchase. Your order {{2}} is currently {{3}}. Thank you for shopping with us!',
          variables: ['customer_name', 'order_id', 'status'],
        },
      ],
    },
    {
      name: 'appointment_confirmation',
      language: 'en_US',
      category: 'UTILITY',
      description: 'Confirm booked appointment date and time',
      components: [
        {
          type: 'BODY',
          text: 'Hello, your appointment has been successfully scheduled for {{1}} at {{2}}. Please reach out if you need to reschedule.',
          variables: ['date', 'time'],
        },
      ],
    },
  ],
  flows: [
    {
      id: 'book_viewing',
      name: 'Property Viewing Booking',
      providerFlowId: '1179902118548695_flow_viewing',
      description: 'Interactive WhatsApp Flow to select property and schedule a viewing',
      cta: 'Book Viewing',
      mode: 'published',
      status: 'PUBLISHED',
      screens: [
        { id: 'SELECT_DATE', title: 'Choose Viewing Date' },
        { id: 'CONTACT_INFO', title: 'Confirm Details', terminal: true },
      ],
    },
    {
      id: 'customer_feedback',
      name: 'Order Feedback Flow',
      providerFlowId: 'flow_feedback_001',
      description: 'Interactive ratings and comments',
      cta: 'Rate Order',
      mode: 'published',
      status: 'PUBLISHED',
      screens: [
        { id: 'RATING_SCREEN', title: 'Rate Your Experience', terminal: true },
      ],
    },
  ],
});

// ---------------------------------------------------------------------------
// Existing Tools (retained for backward compatibility)
// ---------------------------------------------------------------------------

app.tool(
  {
    name: 'wa_template_preview',
    auth: 'required',
    description: 'Render a WhatsApp message template preview before dispatch.',
  },
  async (ctx) => {
    const args = getArgs(ctx);
    const template = asString(args.template, 'order_update');
    return {
      template,
      preview: `Template ${template} for ${ctx.customer.id}`,
      approved: true,
    };
  },
);

app.tool(
  {
    name: 'wa_message_send',
    auth: 'required',
    description: 'Simulate WhatsApp send and return provider tracking metadata.',
  },
  async (ctx) => {
    const args = getArgs(ctx);
    const to = asString(args.to, ctx.customer.id);
    const text = asString(args.text);
    return {
      queued: text.length > 0,
      providerMessageId: text.length > 0 ? `wam-${Date.now()}` : null,
      to,
      error: text.length > 0 ? null : 'text_required',
    };
  },
);

await app.listen({ port });
console.log('Qefro whatsapp endpoint listening on port', port);
