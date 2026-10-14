import test from 'node:test';
import assert from 'node:assert/strict';
import {
    Qefro,
    WHATSAPP_SEND_TEMPLATE_TOOL,
    WHATSAPP_LAUNCH_FLOW_TOOL,
    WHATSAPP_GET_TEMPLATE_STATUS_TOOL,
    WHATSAPP_GET_FLOW_STATUS_TOOL,
    validateWhatsAppDefinition,
    validateWhatsAppTemplate,
    validateWhatsAppFlow,
    cleanRecipientPhone,
    maskPhoneNumber,
    isRetryableMetaError,
    resolveWhatsAppCredentials,
    signBody,
} from '../dist/index.mjs';

function signRequest(body, secret = 'test-secret') {
    const { signature, timestamp } = signBody(secret, body);
    return {
        'x-qefro-signature': signature,
        'x-qefro-timestamp': timestamp,
    };
}

function createMockFetch(status, body, capture = {}) {
    return async (url, options) => {
        capture.url = url;
        capture.options = options;
        capture.headers = options?.headers;
        capture.body = options?.body ? JSON.parse(options.body) : null;
        return {
            status,
            ok: status >= 200 && status < 300,
            text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
        };
    };
}

function createTimeoutFetch() {
    return async () => {
        throw new Error('fetch failed: network timeout');
    };
}

async function invokeHelper(app, tool, parameters, settings = {}, secret = 'test-secret') {
    const body = JSON.stringify({
        protocol_version: '1',
        request_id: `req-${Date.now()}`,
        type: 'tool.invoke',
        tool,
        parameters,
        settings,
    });
    return app.handleRaw(body, signRequest(body, secret));
}

test('WhatsApp Definition & Schema Validation', async (t) => {
    await t.test('validates valid templates and flows', () => {
        const reg = validateWhatsAppDefinition({
            version: 1,
            templates: [
                {
                    name: 'order_update',
                    language: 'en_US',
                    category: 'UTILITY',
                    components: [
                        {
                            type: 'BODY',
                            variables: ['order_id', 'status'],
                        },
                    ],
                },
            ],
            flows: [
                {
                    id: 'book_viewing',
                    providerFlowId: 'flow_12345',
                    mode: 'published',
                    status: 'PUBLISHED',
                    cta: 'Book Viewing',
                    screens: [{ id: 'SCREEN_1' }],
                },
            ],
        });

        assert.equal(reg.version, 1);
        assert.equal(reg.templates.length, 1);
        assert.equal(reg.flows.length, 1);
        assert.equal(reg.templates[0].name, 'order_update');
        assert.equal(reg.flows[0].id, 'book_viewing');
        assert.equal(reg.flows[0].providerFlowId, 'flow_12345');
    });

    await t.test('rejects empty template name and duplicate templates', () => {
        assert.throws(() => validateWhatsAppTemplate({ name: '' }), /non-empty name/);
        assert.throws(
            () =>
                validateWhatsAppDefinition({
                    templates: [{ name: 'dup' }, { name: 'dup' }],
                }),
            /duplicate whatsapp template name "dup"/,
        );
    });

    await t.test('rejects empty flow id and duplicate flows', () => {
        assert.throws(() => validateWhatsAppFlow({ id: '' }), /non-empty id/);
        assert.throws(
            () =>
                validateWhatsAppDefinition({
                    flows: [{ id: 'flow1' }, { id: 'flow1' }],
                }),
            /duplicate whatsapp flow id "flow1"/,
        );
    });

    await t.test('normalizes recipient phone and masks logs', () => {
        assert.equal(cleanRecipientPhone('+1 (555) 123-4567'), '+15551234567');
        assert.equal(cleanRecipientPhone('919080272573'), '919080272573');
        assert.equal(cleanRecipientPhone(''), '');
        assert.equal(maskPhoneNumber('+15551234567'), '+15*******67');
        assert.equal(maskPhoneNumber('123'), '***');
    });
});

test('Capability Discovery and Registration via capabilities.list', async (t) => {
    await t.test('omits whatsapp capability when not registered', async () => {
        const app = new Qefro({ signingSecret: 'test-secret' });
        const body = JSON.stringify({ protocol_version: '1', request_id: 'r0', type: 'capabilities.list' });
        const res = await app.handleRaw(body, signRequest(body));

        assert.equal(res.type, 'capabilities.list');
        assert.equal(res.whatsapp, undefined);
    });

    await t.test('advertises whatsapp capability and 4 typed tools when registered', async () => {
        const app = new Qefro({ signingSecret: 'test-secret' });
        app.whatsapp({
            version: 1,
            templates: [
                {
                    name: 'booking_confirmed',
                    language: 'en_US',
                    category: 'UTILITY',
                },
            ],
            flows: [
                {
                    id: 'feedback_flow',
                    providerFlowId: '123456',
                    status: 'PUBLISHED',
                    cta: 'Give Feedback',
                },
            ],
        });

        const body = JSON.stringify({
            protocol_version: '1',
            request_id: 'r1',
            type: 'capabilities.list',
        });
        const res = await app.handleRaw(body, signRequest(body));

        assert.equal(res.type, 'capabilities.list');
        assert.ok(res.whatsapp, 'whatsapp capability should be present');
        assert.equal(res.whatsapp.version, 1);
        assert.equal(res.whatsapp.templates.length, 1);
        assert.equal(res.whatsapp.templates[0].name, 'booking_confirmed');
        assert.equal(res.whatsapp.flows.length, 1);
        assert.equal(res.whatsapp.flows[0].id, 'feedback_flow');

        // Check registered tools
        const toolNames = res.tools.map((t) => t.name);
        assert.ok(toolNames.includes(WHATSAPP_SEND_TEMPLATE_TOOL));
        assert.ok(toolNames.includes(WHATSAPP_LAUNCH_FLOW_TOOL));
        assert.ok(toolNames.includes(WHATSAPP_GET_TEMPLATE_STATUS_TOOL));
        assert.ok(toolNames.includes(WHATSAPP_GET_FLOW_STATUS_TOOL));

        // Check tool schemas
        const sendTplTool = res.tools.find((t) => t.name === WHATSAPP_SEND_TEMPLATE_TOOL);
        assert.ok(sendTplTool.input_schema);
        assert.deepEqual(sendTplTool.input_schema.required, ['to', 'template']);
        assert.deepEqual(sendTplTool.permissions, ['whatsapp.send', 'whatsapp.read']);
    });

    await t.test('supports individual registration via app.whatsappTemplate and app.whatsappFlow', async () => {
        const app = new Qefro({ signingSecret: 'test-secret' });
        app.whatsappTemplate({ name: 'tpl_alpha', language: 'en_GB' });
        app.whatsappFlow({ id: 'flow_beta', providerFlowId: 'meta_flow_1' });

        const body = JSON.stringify({
            protocol_version: '1',
            request_id: 'r2',
            type: 'capabilities.list',
        });
        const res = await app.handleRaw(body, signRequest(body));

        assert.ok(res.whatsapp);
        assert.equal(res.whatsapp.templates[0].name, 'tpl_alpha');
        assert.equal(res.whatsapp.flows[0].id, 'flow_beta');
    });
});

test('WhatsApp Message Template Invocation (Unit & Mock Provider)', async (t) => {
    await t.test('rejects missing recipient or template parameter', async () => {
        const app = new Qefro({ signingSecret: 'test-secret' });
        app.whatsapp({
            templates: [{ name: 'order_receipt' }],
        });

        const resNoTo = await invokeHelper(app, WHATSAPP_SEND_TEMPLATE_TOOL, { template: 'order_receipt' });
        assert.equal(resNoTo.type, 'result');
        assert.equal(resNoTo.output.status, 'failed');
        assert.equal(resNoTo.output.error.code, 'missing_parameter');

        const resNoTpl = await invokeHelper(app, WHATSAPP_SEND_TEMPLATE_TOOL, { to: '+15551234567' });
        assert.equal(resNoTpl.type, 'result');
        assert.equal(resNoTpl.output.status, 'failed');
        assert.equal(resNoTpl.output.error.code, 'missing_parameter');
    });

    await t.test('rejects missing credentials when not configured in settings, provider, or env', async () => {
        const app = new Qefro({ signingSecret: 'test-secret' });
        app.whatsapp({
            templates: [{ name: 'order_receipt' }],
        });

        const oldEnvToken = process.env.WHATSAPP_ACCESS_TOKEN;
        const oldEnvPhone = process.env.WHATSAPP_PHONE_NUMBER_ID;
        delete process.env.WHATSAPP_ACCESS_TOKEN;
        delete process.env.WHATSAPP_PHONE_NUMBER_ID;

        try {
            const res = await invokeHelper(app, WHATSAPP_SEND_TEMPLATE_TOOL, {
                to: '+15551234567',
                template: 'order_receipt',
            });
            assert.equal(res.type, 'result');
            assert.equal(res.output.status, 'failed');
            assert.equal(res.output.error.code, 'missing_credentials');
        } finally {
            if (oldEnvToken) process.env.WHATSAPP_ACCESS_TOKEN = oldEnvToken;
            if (oldEnvPhone) process.env.WHATSAPP_PHONE_NUMBER_ID = oldEnvPhone;
        }
    });

    await t.test('successfully sends template with 200 OK and returns status: accepted', async () => {
        const capture = {};
        const mockFetch = createMockFetch(200, {
            messaging_product: 'whatsapp',
            contacts: [{ input: '15551234567', wa_id: '15551234567' }],
            messages: [{ id: 'wamid.HBgLMTE3OTkwMjExODU0ODY5NQ==' }],
        }, capture);

        const app = new Qefro({ signingSecret: 'test-secret' });
        app.whatsapp({
            provider: {
                phoneNumberId: 'phone_123',
                accessToken: 'meta_secret_token_123',
                fetchFn: mockFetch,
            },
            templates: [
                {
                    name: 'order_receipt',
                    language: 'en_US',
                    components: [
                        {
                            type: 'BODY',
                            variables: ['order_id', 'total'],
                        },
                    ],
                },
            ],
        });

        const res = await invokeHelper(app, WHATSAPP_SEND_TEMPLATE_TOOL, {
            to: '+15551234567',
            template: 'order_receipt',
            parameters: { order_id: 'ORD-999', total: '$49.00' },
            correlation_id: 'corr-test-1',
        });

        assert.equal(res.type, 'result');
        const output = res.output;
        // MUST be "accepted" (not delivered)
        assert.equal(output.status, 'accepted');
        assert.equal(output.message_id, 'wamid.HBgLMTE3OTkwMjExODU0ODY5NQ==');
        assert.equal(output.recipient, '+15551234567');
        assert.equal(output.template, 'order_receipt');
        assert.equal(output.correlation_id, 'corr-test-1');
        assert.equal(output.provider, 'meta');
        assert.ok(output.timestamp);
        assert.equal(output.error, null);

        // Verify outgoing request payload
        assert.ok(capture.url.includes('/phone_123/messages'));
        assert.equal(capture.headers.authorization, 'Bearer meta_secret_token_123');
        assert.equal(capture.body.messaging_product, 'whatsapp');
        assert.equal(capture.body.to, '+15551234567');
        assert.equal(capture.body.type, 'template');
        assert.equal(capture.body.template.name, 'order_receipt');
        assert.deepEqual(capture.body.template.components[0].parameters, [
            { type: 'text', text: 'ORD-999' },
            { type: 'text', text: '$49.00' },
        ]);
    });

    await t.test('resolves provider-specific template ID if configured on template', async () => {
        const capture = {};
        const mockFetch = createMockFetch(200, {
            messages: [{ id: 'wamid.TPL123' }],
        }, capture);

        const app = new Qefro({ signingSecret: 'test-secret' });
        app.whatsapp({
            provider: {
                phoneNumberId: 'phone_123',
                accessToken: 'meta_secret_token_123',
                fetchFn: mockFetch,
            },
            templates: [
                {
                    name: 'user_welcome',
                    providerId: 'meta_welcome_v2_approved',
                },
            ],
        });

        const res = await invokeHelper(app, WHATSAPP_SEND_TEMPLATE_TOOL, {
            to: '+15551234567',
            template: 'user_welcome',
        });

        assert.equal(res.output.status, 'accepted');
        assert.equal(res.output.provider_id, 'meta_welcome_v2_approved');
        assert.equal(capture.body.template.name, 'meta_welcome_v2_approved');
    });

    await t.test('normalizes provider rejection with status: rejected and retryable: false', async () => {
        const capture = {};
        const mockFetch = createMockFetch(400, {
            error: {
                message: 'Template does not exist',
                type: 'OAuthException',
                code: 132000,
                error_subcode: 2388040,
                fbtrace_id: 'Axyz123',
            },
        }, capture);

        const app = new Qefro({ signingSecret: 'test-secret' });
        app.whatsapp({
            provider: {
                phoneNumberId: 'phone_123',
                accessToken: 'meta_secret_token_123',
                fetchFn: mockFetch,
            },
            templates: [{ name: 'unknown_tpl' }],
        });

        const res = await invokeHelper(app, WHATSAPP_SEND_TEMPLATE_TOOL, {
            to: '+15551234567',
            template: 'unknown_tpl',
        });

        assert.equal(res.type, 'result');
        const output = res.output;
        assert.equal(output.status, 'rejected');
        assert.equal(output.message_id, null);
        assert.equal(output.error.code, '132000');
        assert.equal(output.error.retryable, false);
        assert.ok(output.error.message.includes('Template does not exist'));
    });

    await t.test('normalizes rate limit error with status: failed and retryable: true', async () => {
        const mockFetch = createMockFetch(429, {
            error: {
                message: 'Rate limit hit',
                code: 130429,
            },
        });

        const app = new Qefro({ signingSecret: 'test-secret' });
        app.whatsapp({
            provider: {
                phoneNumberId: 'phone_123',
                accessToken: 'meta_secret_token_123',
                fetchFn: mockFetch,
            },
            templates: [{ name: 'blast' }],
        });

        const res = await invokeHelper(app, WHATSAPP_SEND_TEMPLATE_TOOL, {
            to: '+15551234567',
            template: 'blast',
        });

        assert.equal(res.output.status, 'failed');
        assert.equal(res.output.error.code, '130429');
        assert.equal(res.output.error.retryable, true);
    });

    await t.test('normalizes network timeout with status: unknown and retryable: true', async () => {
        const app = new Qefro({ signingSecret: 'test-secret' });
        app.whatsapp({
            provider: {
                phoneNumberId: 'phone_123',
                accessToken: 'meta_secret_token_123',
                fetchFn: createTimeoutFetch(),
            },
            templates: [{ name: 'blast' }],
        });

        const res = await invokeHelper(app, WHATSAPP_SEND_TEMPLATE_TOOL, {
            to: '+15551234567',
            template: 'blast',
        });

        assert.equal(res.output.status, 'unknown');
        assert.equal(res.output.error.code, 'timeout_or_network_error');
        assert.equal(res.output.error.retryable, true);
    });
});

test('WhatsApp Flow Launch Invocation (Unit & Mock Provider)', async (t) => {
    await t.test('successfully launches published Flow interactive message', async () => {
        const capture = {};
        const mockFetch = createMockFetch(200, {
            messaging_product: 'whatsapp',
            messages: [{ id: 'wamid.FLOW_SENT_1' }],
        }, capture);

        const app = new Qefro({ signingSecret: 'test-secret' });
        app.whatsapp({
            provider: {
                phoneNumberId: 'phone_123',
                accessToken: 'meta_secret_token_123',
                fetchFn: mockFetch,
            },
            flows: [
                {
                    id: 'book_appointment',
                    providerFlowId: 'meta_flow_777',
                    name: 'Book Appointment',
                    description: 'Select your preferred appointment time',
                    cta: 'Book Now',
                    mode: 'published',
                    status: 'PUBLISHED',
                    screens: [{ id: 'SELECT_TIME' }],
                },
            ],
        });

        const res = await invokeHelper(app, WHATSAPP_LAUNCH_FLOW_TOOL, {
            to: '+15551234567',
            flow_id: 'book_appointment',
            flow_token: 'session-wa-token-123',
            correlation_id: 'corr-flow-1',
        });

        assert.equal(res.type, 'result');
        const output = res.output;
        assert.equal(output.status, 'accepted');
        assert.equal(output.message_id, 'wamid.FLOW_SENT_1');
        assert.equal(output.flow_id, 'book_appointment');
        assert.equal(output.provider_flow_id, 'meta_flow_777');
        assert.equal(output.flow_token, 'session-wa-token-123');
        assert.equal(output.correlation_id, 'corr-flow-1');

        // Verify request payload sent to Meta
        assert.equal(capture.body.type, 'interactive');
        const interactive = capture.body.interactive;
        assert.equal(interactive.type, 'flow');
        assert.equal(interactive.body.text, 'Select your preferred appointment time');
        assert.equal(interactive.action.name, 'flow');
        assert.equal(interactive.action.parameters.flow_id, 'meta_flow_777');
        assert.equal(interactive.action.parameters.flow_cta, 'Book Now');
        assert.equal(interactive.action.parameters.mode, 'published');
        assert.equal(interactive.action.parameters.flow_action, 'navigate');
        assert.equal(interactive.action.parameters.flow_action_payload.screen, 'SELECT_TIME');
    });

    await t.test('rejects launch if flow is registered as BLOCKED or DEPRECATED', async () => {
        const app = new Qefro({ signingSecret: 'test-secret' });
        app.whatsapp({
            provider: {
                phoneNumberId: 'phone_123',
                accessToken: 'meta_secret_token_123',
                fetchFn: createMockFetch(200, {}),
            },
            flows: [
                {
                    id: 'retired_flow',
                    status: 'DEPRECATED',
                },
            ],
        });

        const res = await invokeHelper(app, WHATSAPP_LAUNCH_FLOW_TOOL, {
            to: '+15551234567',
            flow_id: 'retired_flow',
        });

        assert.equal(res.output.status, 'rejected');
        assert.equal(res.output.error.code, 'flow_status_blocked');
    });

    await t.test('supports data_exchange mode for dynamic Flows', async () => {
        const capture = {};
        const mockFetch = createMockFetch(200, {
            messages: [{ id: 'wamid.FLOW_DYN' }],
        }, capture);

        const app = new Qefro({ signingSecret: 'test-secret' });
        app.whatsapp({
            provider: {
                phoneNumberId: 'phone_123',
                accessToken: 'meta_secret_token_123',
                fetchFn: mockFetch,
            },
            flows: [
                {
                    id: 'dynamic_cart',
                    providerFlowId: 'flow_dynamic_1',
                    status: 'PUBLISHED',
                },
            ],
        });

        const res = await invokeHelper(app, WHATSAPP_LAUNCH_FLOW_TOOL, {
            to: '+15551234567',
            flow_id: 'dynamic_cart',
            flow_action: 'data_exchange',
        });

        assert.equal(res.output.status, 'accepted');
        assert.equal(capture.body.interactive.action.parameters.flow_action, 'data_exchange');
        assert.equal(capture.body.interactive.action.parameters.flow_action_payload, undefined);
    });
});

test('WhatsApp Provider Status Operations', async (t) => {
    await t.test('reads template status from provider', async () => {
        const mockFetch = createMockFetch(200, {
            name: 'order_update',
            status: 'APPROVED',
            language: 'en_US',
            category: 'UTILITY',
            id: 'meta_tpl_id_999',
        });

        const app = new Qefro({ signingSecret: 'test-secret' });
        app.whatsapp({
            provider: {
                accessToken: 'meta_secret',
                wabaId: 'waba_123',
                fetchFn: mockFetch,
            },
            templates: [{ name: 'order_update', providerId: 'meta_tpl_id_999' }],
        });

        const res = await invokeHelper(app, WHATSAPP_GET_TEMPLATE_STATUS_TOOL, {
            template: 'order_update',
        });

        assert.equal(res.output.status, 'APPROVED');
        assert.equal(res.output.provider_id, 'meta_tpl_id_999');
        assert.equal(res.output.category, 'UTILITY');
    });

    await t.test('reads flow status from provider', async () => {
        const mockFetch = createMockFetch(200, {
            id: 'flow_meta_888',
            name: 'Book Room',
            status: 'PUBLISHED',
            categories: ['APPOINTMENT_BOOKING'],
            validation_errors: [],
        });

        const app = new Qefro({ signingSecret: 'test-secret' });
        app.whatsapp({
            provider: {
                accessToken: 'meta_secret',
                fetchFn: mockFetch,
            },
            flows: [{ id: 'book_room', providerFlowId: 'flow_meta_888' }],
        });

        const res = await invokeHelper(app, WHATSAPP_GET_FLOW_STATUS_TOOL, {
            flow_id: 'book_room',
        });

        assert.equal(res.output.status, 'PUBLISHED');
        assert.equal(res.output.provider_flow_id, 'flow_meta_888');
        assert.equal(res.output.name, 'Book Room');
        assert.deepEqual(res.output.validation_errors, []);
    });
});

test('Tenant & Workspace Credential Isolation and Redaction', async (t) => {
    await t.test('prioritizes per-install ctx.settings over SDK instance defaults and env', async () => {
        const capture = {};
        const mockFetch = createMockFetch(200, {
            messages: [{ id: 'wamid.TENANT_A' }],
        }, capture);

        const app = new Qefro({ signingSecret: 'test-secret' });
        app.whatsapp({
            provider: {
                phoneNumberId: 'default_instance_phone',
                accessToken: 'default_instance_token',
                fetchFn: mockFetch,
            },
            templates: [{ name: 'hello' }],
        });

        const res = await invokeHelper(
            app,
            WHATSAPP_SEND_TEMPLATE_TOOL,
            { to: '+15551234567', template: 'hello' },
            {
                whatsapp_access_token: 'tenant_custom_token_999',
                whatsapp_phone_number_id: 'tenant_phone_999',
            },
        );

        assert.equal(res.output.status, 'accepted');
        assert.ok(capture.url.includes('/tenant_phone_999/messages'), 'Must use tenant phone ID from settings');
        assert.equal(capture.headers.authorization, 'Bearer tenant_custom_token_999', 'Must use tenant token from settings');
    });

    await t.test('ignores tenant override attempt passed in parameters', async () => {
        const capture = {};
        const mockFetch = createMockFetch(200, {
            messages: [{ id: 'wamid.SECURE' }],
        }, capture);

        const app = new Qefro({ signingSecret: 'test-secret' });
        app.whatsapp({
            provider: {
                phoneNumberId: 'legit_phone',
                accessToken: 'legit_token',
                fetchFn: mockFetch,
            },
            templates: [{ name: 'hello' }],
        });

        await invokeHelper(
            app,
            WHATSAPP_SEND_TEMPLATE_TOOL,
            {
                to: '+15551234567',
                template: 'hello',
                phone_number_id: 'hijacked_phone',
                access_token: 'hijacked_token',
            },
        );

        assert.ok(capture.url.includes('/legit_phone/messages'), 'Must NOT use attacker parameter override');
        assert.equal(capture.headers.authorization, 'Bearer legit_token');
    });
});
