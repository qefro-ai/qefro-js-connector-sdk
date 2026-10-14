import { randomUUID } from 'crypto';
import type { ToolContext, ToolDefinition } from './tools.js';

// ============================================================================
// WhatsApp Types & Definitions
// ============================================================================

export type WhatsAppDeliveryStatus =
    | 'accepted'
    | 'sent'
    | 'delivered'
    | 'read'
    | 'failed'
    | 'rejected'
    | 'unknown';

export type WhatsAppTemplateStatus =
    | 'APPROVED'
    | 'PENDING'
    | 'REJECTED'
    | 'PAUSED'
    | 'DISABLED'
    | 'UNKNOWN';

export type WhatsAppFlowStatus =
    | 'PUBLISHED'
    | 'DRAFT'
    | 'DEPRECATED'
    | 'BLOCKED'
    | 'THROTTLED'
    | 'UNKNOWN';

export type WhatsAppFlowMode = 'published' | 'draft';
export type WhatsAppFlowAction = 'navigate' | 'data_exchange';

export interface WhatsAppTemplateComponent {
    type: 'HEADER' | 'BODY' | 'FOOTER' | 'BUTTONS';
    format?: 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'VIDEO' | 'LOCATION';
    text?: string;
    variables?: string[];
    buttons?: Array<{
        type: 'QUICK_REPLY' | 'URL' | 'PHONE_NUMBER' | 'FLOW';
        text: string;
        url?: string;
        phoneNumber?: string;
        flowId?: string;
    }>;
}

export interface WhatsAppTemplateDefinition {
    name: string;
    language?: string;
    category?: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
    providerId?: string;
    status?: WhatsAppTemplateStatus;
    components?: WhatsAppTemplateComponent[];
    description?: string;
}

export interface WhatsAppFlowScreen {
    id: string;
    title?: string;
    terminal?: boolean;
    data?: Record<string, unknown>;
}

export interface WhatsAppFlowDefinition {
    id: string;
    name?: string;
    description?: string;
    providerFlowId?: string;
    categories?: string[];
    status?: WhatsAppFlowStatus;
    mode?: WhatsAppFlowMode;
    cta?: string;
    screens?: WhatsAppFlowScreen[];
    endpointUrl?: string;
}

export type FetchFunction = typeof fetch;

export interface WhatsAppProviderConfig {
    provider?: 'meta' | string;
    apiVersion?: string;
    phoneNumberId?: string;
    accessToken?: string;
    wabaId?: string;
    baseUrl?: string;
    fetchFn?: FetchFunction;
}

export interface WhatsAppDefinition {
    version?: number;
    provider?: WhatsAppProviderConfig;
    templates?: WhatsAppTemplateDefinition[];
    flows?: WhatsAppFlowDefinition[];
}

export interface WhatsAppRegistration {
    version: number;
    provider?: WhatsAppProviderConfig;
    templates: WhatsAppTemplateDefinition[];
    flows: WhatsAppFlowDefinition[];
}

export interface WhatsAppCapability {
    version: number;
    provider: string;
    templates: Array<{
        name: string;
        language: string;
        category?: string;
        provider_id?: string;
        status: string;
        components?: WhatsAppTemplateComponent[];
        description?: string;
    }>;
    flows: Array<{
        id: string;
        name?: string;
        provider_flow_id?: string;
        categories?: string[];
        status: string;
        mode: string;
        cta: string;
        screens_count: number;
        description?: string;
    }>;
}

// ============================================================================
// Tool Schemas & Identifiers
// ============================================================================

export const WHATSAPP_SEND_TEMPLATE_TOOL = 'whatsapp_send_template';
export const WHATSAPP_LAUNCH_FLOW_TOOL = 'whatsapp_launch_flow';
export const WHATSAPP_GET_TEMPLATE_STATUS_TOOL = 'whatsapp_get_template_status';
export const WHATSAPP_GET_FLOW_STATUS_TOOL = 'whatsapp_get_flow_status';

export const WHATSAPP_PERMISSIONS = ['whatsapp.send', 'whatsapp.read'];

export const SEND_TEMPLATE_INPUT_SCHEMA: Record<string, unknown> = {
    type: 'object',
    properties: {
        to: {
            type: 'string',
            description: 'Recipient phone number in E.164 format (e.g. +15551234567 or 15551234567)',
        },
        template: {
            type: 'string',
            description: 'Stable template reference identifier (e.g. order_update)',
        },
        language: {
            type: 'string',
            description: 'Language code (e.g. en_US; defaults to template definition or en_US)',
        },
        parameters: {
            type: 'object',
            description: 'Key-value map of named parameters to populate template variables',
        },
        components: {
            type: 'array',
            description: 'Optional direct Meta Graph API component parameters override',
        },
        correlation_id: {
            type: 'string',
            description: 'Optional caller-provided tracking/correlation identifier',
        },
    },
    required: ['to', 'template'],
};

export const LAUNCH_FLOW_INPUT_SCHEMA: Record<string, unknown> = {
    type: 'object',
    properties: {
        to: {
            type: 'string',
            description: 'Recipient phone number in E.164 format',
        },
        flow_id: {
            type: 'string',
            description: 'Stable flow identifier or provider Meta Flow ID',
        },
        flow_token: {
            type: 'string',
            description: 'Unique session token for the interactive flow session',
        },
        cta: {
            type: 'string',
            description: 'Call-to-action button text (max 20 characters)',
        },
        body: {
            type: 'string',
            description: 'Message body text describing the action (max 1024 characters)',
        },
        header: {
            type: 'string',
            description: 'Optional header text for the interactive message',
        },
        footer: {
            type: 'string',
            description: 'Optional footer text for the interactive message',
        },
        mode: {
            type: 'string',
            enum: ['published', 'draft'],
            description: 'Flow mode (default: published)',
        },
        flow_action: {
            type: 'string',
            enum: ['navigate', 'data_exchange'],
            description: 'Flow action mode (default: navigate)',
        },
        flow_action_payload: {
            type: 'object',
            description: 'Payload for flow navigation: target screen and optional initial data',
            properties: {
                screen: { type: 'string' },
                data: { type: 'object' },
            },
        },
        correlation_id: {
            type: 'string',
            description: 'Optional caller-provided tracking/correlation identifier',
        },
    },
    required: ['to', 'flow_id'],
};

export const GET_TEMPLATE_STATUS_INPUT_SCHEMA: Record<string, unknown> = {
    type: 'object',
    properties: {
        template: {
            type: 'string',
            description: 'Template name or provider ID to query',
        },
        waba_id: {
            type: 'string',
            description: 'Optional WhatsApp Business Account ID override',
        },
    },
    required: ['template'],
};

export const GET_FLOW_STATUS_INPUT_SCHEMA: Record<string, unknown> = {
    type: 'object',
    properties: {
        flow_id: {
            type: 'string',
            description: 'Flow identifier or Meta Flow ID to query',
        },
    },
    required: ['flow_id'],
};

// ============================================================================
// Validation Functions
// ============================================================================

export function validateWhatsAppTemplate(t: WhatsAppTemplateDefinition): WhatsAppTemplateDefinition {
    if (!t || typeof t !== 'object') {
        throw new Error('whatsapp template must be an object');
    }
    const name = typeof t.name === 'string' ? t.name.trim() : '';
    if (!name) {
        throw new Error('whatsapp template requires a non-empty name');
    }
    const language = typeof t.language === 'string' && t.language.trim() ? t.language.trim() : 'en_US';
    const status = t.status ?? 'APPROVED';
    const validStatuses: WhatsAppTemplateStatus[] = [
        'APPROVED',
        'PENDING',
        'REJECTED',
        'PAUSED',
        'DISABLED',
        'UNKNOWN',
    ];
    if (!validStatuses.includes(status)) {
        throw new Error(`invalid template status "${status}" for template "${name}"`);
    }

    return {
        ...t,
        name,
        language,
        status,
        components: Array.isArray(t.components) ? [...t.components] : [],
    };
}

export function validateWhatsAppFlow(f: WhatsAppFlowDefinition): WhatsAppFlowDefinition {
    if (!f || typeof f !== 'object') {
        throw new Error('whatsapp flow must be an object');
    }
    const id = typeof f.id === 'string' ? f.id.trim() : '';
    if (!id) {
        throw new Error('whatsapp flow requires a non-empty id');
    }
    const status = f.status ?? 'PUBLISHED';
    const validStatuses: WhatsAppFlowStatus[] = [
        'PUBLISHED',
        'DRAFT',
        'DEPRECATED',
        'BLOCKED',
        'THROTTLED',
        'UNKNOWN',
    ];
    if (!validStatuses.includes(status)) {
        throw new Error(`invalid flow status "${status}" for flow "${id}"`);
    }
    const mode = f.mode ?? (status === 'DRAFT' ? 'draft' : 'published');

    return {
        ...f,
        id,
        status,
        mode,
        cta: typeof f.cta === 'string' && f.cta.trim() ? f.cta.trim() : 'Continue',
        screens: Array.isArray(f.screens) ? [...f.screens] : [],
        categories: Array.isArray(f.categories) ? [...f.categories] : [],
    };
}

export function validateWhatsAppDefinition(def: WhatsAppDefinition): WhatsAppRegistration {
    if (!def || typeof def !== 'object') {
        throw new Error('whatsapp definition must be an object');
    }
    const version = typeof def.version === 'number' && Number.isInteger(def.version) && def.version > 0
        ? def.version
        : 1;

    const templateNames = new Set<string>();
    const templates: WhatsAppTemplateDefinition[] = [];
    for (const t of def.templates ?? []) {
        const validated = validateWhatsAppTemplate(t);
        if (templateNames.has(validated.name)) {
            throw new Error(`duplicate whatsapp template name "${validated.name}"`);
        }
        templateNames.add(validated.name);
        templates.push(validated);
    }

    const flowIds = new Set<string>();
    const flows: WhatsAppFlowDefinition[] = [];
    for (const f of def.flows ?? []) {
        const validated = validateWhatsAppFlow(f);
        if (flowIds.has(validated.id)) {
            throw new Error(`duplicate whatsapp flow id "${validated.id}"`);
        }
        flowIds.add(validated.id);
        flows.push(validated);
    }

    return {
        version,
        provider: def.provider,
        templates,
        flows,
    };
}

export function toWhatsAppCapability(reg?: WhatsAppRegistration): WhatsAppCapability | undefined {
    if (!reg) return undefined;
    return {
        version: reg.version,
        provider: reg.provider?.provider ?? 'meta',
        templates: reg.templates.map((t) => ({
            name: t.name,
            language: t.language ?? 'en_US',
            category: t.category,
            provider_id: t.providerId,
            status: t.status ?? 'APPROVED',
            components: t.components,
            description: t.description,
        })),
        flows: reg.flows.map((f) => ({
            id: f.id,
            name: f.name,
            provider_flow_id: f.providerFlowId,
            categories: f.categories,
            status: f.status ?? 'PUBLISHED',
            mode: f.mode ?? 'published',
            cta: f.cta ?? 'Continue',
            screens_count: f.screens?.length ?? 0,
            description: f.description,
        })),
    };
}

// ============================================================================
// Credentials, Normalization & Security
// ============================================================================

export interface ResolvedWhatsAppCredentials {
    accessToken: string;
    phoneNumberId: string;
    wabaId?: string;
    apiVersion: string;
    baseUrl: string;
    provider: string;
}

export function maskPhoneNumber(phone: string): string {
    const s = String(phone).trim();
    if (s.length <= 4) return '***';
    const head = s.slice(0, 3);
    const tail = s.slice(-2);
    return `${head}${'*'.repeat(Math.max(1, s.length - 5))}${tail}`;
}

export function cleanRecipientPhone(to: unknown): string {
    if (typeof to !== 'string') return '';
    const trimmed = to.trim();
    if (!trimmed) return '';
    // Retain only digits, optional leading +
    const hasPlus = trimmed.startsWith('+');
    const digits = trimmed.replace(/\D/g, '');
    if (!digits) return '';
    return hasPlus ? `+${digits}` : digits;
}

export function resolveWhatsAppCredentials(
    ctxSettings?: Record<string, unknown>,
    regProvider?: WhatsAppProviderConfig,
    env: Record<string, string | undefined> = process.env,
): ResolvedWhatsAppCredentials {
    const s = ctxSettings ?? {};
    const nested = (s.whatsapp && typeof s.whatsapp === 'object' ? s.whatsapp : {}) as Record<string, unknown>;

    // WhatsApp credentials originate from Qefro workspace channel settings (injected into ctx.settings.whatsapp)
    const accessToken =
        (typeof nested.access_token === 'string' && nested.access_token.trim()) ||
        (typeof nested.accessToken === 'string' && nested.accessToken.trim()) ||
        (typeof s.whatsapp_access_token === 'string' && s.whatsapp_access_token.trim()) ||
        (regProvider?.accessToken && regProvider.accessToken.trim()) ||
        (env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_ACCESS_TOKEN.trim()) ||
        '';

    const phoneNumberId =
        (typeof nested.phone_number_id === 'string' && nested.phone_number_id.trim()) ||
        (typeof nested.phoneNumberId === 'string' && nested.phoneNumberId.trim()) ||
        (typeof s.whatsapp_phone_number_id === 'string' && s.whatsapp_phone_number_id.trim()) ||
        (typeof s.phone_number_id === 'string' && s.phone_number_id.trim()) ||
        (regProvider?.phoneNumberId && regProvider.phoneNumberId.trim()) ||
        (env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_PHONE_NUMBER_ID.trim()) ||
        '';

    const wabaId =
        (typeof nested.waba_id === 'string' && nested.waba_id.trim()) ||
        (typeof nested.wabaId === 'string' && nested.wabaId.trim()) ||
        (typeof s.whatsapp_waba_id === 'string' && s.whatsapp_waba_id.trim()) ||
        (typeof s.waba_id === 'string' && s.waba_id.trim()) ||
        (regProvider?.wabaId && regProvider.wabaId.trim()) ||
        (env.WHATSAPP_WABA_ID && env.WHATSAPP_WABA_ID.trim()) ||
        (env.WHATSAPP_BUSINESS_ACCOUNT_ID && env.WHATSAPP_BUSINESS_ACCOUNT_ID.trim()) ||
        undefined;

    const apiVersion =
        (regProvider?.apiVersion && regProvider.apiVersion.trim()) ||
        (env.WHATSAPP_API_VERSION && env.WHATSAPP_API_VERSION.trim()) ||
        'v22.0';

    const baseUrl = (
        (regProvider?.baseUrl && regProvider.baseUrl.trim()) ||
        (env.WHATSAPP_GRAPH_BASE_URL && env.WHATSAPP_GRAPH_BASE_URL.trim()) ||
        'https://graph.facebook.com'
    ).replace(/\/+$/, '');

    const provider = regProvider?.provider ?? 'meta';

    return {
        accessToken,
        phoneNumberId,
        wabaId,
        apiVersion,
        baseUrl,
        provider,
    };
}

export function isRetryableMetaError(status: number, code?: number): boolean {
    if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504) {
        return true;
    }
    // Meta Cloud API rate limit error codes
    if (code === 80007 || code === 130429 || code === 131056) {
        return true;
    }
    return false;
}

// ============================================================================
// Tool Handlers & Execution
// ============================================================================

export async function executeSendTemplate(
    ctx: ToolContext<Record<string, unknown>>,
    registration: WhatsAppRegistration,
    fetchFn: FetchFunction = fetch,
): Promise<Record<string, unknown>> {
    const timestamp = new Date().toISOString();
    const params = ctx.parameters ?? {};
    const rawTo = params.to ?? ctx.identity?.phone ?? ctx.identity?.whatsapp_number;
    const recipient = cleanRecipientPhone(rawTo);
    const templateRef = typeof params.template === 'string' ? params.template.trim() : '';
    const correlationId = typeof params.correlation_id === 'string' && params.correlation_id.trim()
        ? params.correlation_id.trim()
        : randomUUID();

    if (!recipient) {
        return {
            status: 'failed',
            message_id: null,
            recipient: '',
            template: templateRef,
            correlation_id: correlationId,
            provider: 'meta',
            timestamp,
            error: {
                code: 'missing_parameter',
                message: 'Parameter "to" is required and must contain digits',
                retryable: false,
            },
        };
    }

    if (!templateRef) {
        return {
            status: 'failed',
            message_id: null,
            recipient,
            template: '',
            correlation_id: correlationId,
            provider: 'meta',
            timestamp,
            error: {
                code: 'missing_parameter',
                message: 'Parameter "template" is required',
                retryable: false,
            },
        };
    }

    // Resolve credentials
    const creds = resolveWhatsAppCredentials(ctx.settings ?? ctx.install_settings, registration.provider);
    if (!creds.accessToken || !creds.phoneNumberId) {
        return {
            status: 'failed',
            message_id: null,
            recipient,
            template: templateRef,
            correlation_id: correlationId,
            provider: creds.provider,
            timestamp,
            error: {
                code: 'missing_credentials',
                message: 'WhatsApp provider credentials (access token and phone number ID) not configured',
                retryable: false,
            },
        };
    }

    // Find registered template if known
    const registered = registration.templates.find((t) => t.name === templateRef);
    const language = typeof params.language === 'string' && params.language.trim()
        ? params.language.trim()
        : registered?.language ?? 'en_US';

    // Build components
    let components: unknown[] = [];
    if (Array.isArray(params.components)) {
        components = params.components;
    } else if (params.parameters && typeof params.parameters === 'object') {
        const bodyVars: Array<{ type: 'text'; text: string }> = [];
        const paramObj = params.parameters as Record<string, unknown>;

        if (registered?.components) {
            const bodyComp = registered.components.find((c) => c.type === 'BODY');
            if (bodyComp?.variables && bodyComp.variables.length > 0) {
                for (const vName of bodyComp.variables) {
                    const val = paramObj[vName] ?? '';
                    bodyVars.push({ type: 'text', text: String(val) });
                }
            }
        }

        if (bodyVars.length === 0) {
            // Positional or arbitrary values
            const keys = Object.keys(paramObj).sort();
            for (const k of keys) {
                bodyVars.push({ type: 'text', text: String(paramObj[k] ?? '') });
            }
        }

        if (bodyVars.length > 0) {
            components.push({ type: 'body', parameters: bodyVars });
        }
    }

    const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient,
        type: 'template',
        template: {
            name: registered?.providerId ?? templateRef,
            language: { code: language },
            ...(components.length > 0 ? { components } : {}),
        },
    };

    const url = `${creds.baseUrl}/${creds.apiVersion}/${creds.phoneNumberId}/messages`;

    try {
        ctx.logger.info?.(
            `[WhatsApp] Sending template "${templateRef}" to ${maskPhoneNumber(recipient)} (correlation: ${correlationId})`,
        );

        const resp = await fetchFn(url, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                authorization: `Bearer ${creds.accessToken}`,
            },
            body: JSON.stringify(payload),
        });

        const status = resp.status;
        const text = await resp.text();
        let body: any = {};
        try {
            body = JSON.parse(text);
        } catch {
            body = { raw: text };
        }

        if (status >= 200 && status < 300) {
            const messageId = body?.messages?.[0]?.id ?? null;
            return {
                status: 'accepted',
                message_id: messageId,
                recipient,
                template: templateRef,
                language,
                provider_id: registered?.providerId ?? null,
                correlation_id: correlationId,
                provider: creds.provider,
                timestamp,
                error: null,
            };
        }

        const metaError = body?.error;
        const code = metaError?.code ?? status;
        const isRetryable = isRetryableMetaError(status, typeof code === 'number' ? code : undefined);

        return {
            status: isRetryable ? 'failed' : 'rejected',
            message_id: null,
            recipient,
            template: templateRef,
            language,
            provider_id: registered?.providerId ?? null,
            correlation_id: correlationId,
            provider: creds.provider,
            timestamp,
            error: {
                code: String(code),
                message: metaError?.message || text || 'WhatsApp API rejection',
                subcode: metaError?.error_subcode ?? null,
                retryable: isRetryable,
            },
        };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        ctx.logger.error?.(
            `[WhatsApp] Network error sending template to ${maskPhoneNumber(recipient)}: ${message}`,
        );
        return {
            status: 'unknown',
            message_id: null,
            recipient,
            template: templateRef,
            correlation_id: correlationId,
            provider: creds.provider,
            timestamp,
            error: {
                code: 'timeout_or_network_error',
                message: `Request failed; outcome ambiguous: ${message}`,
                retryable: true,
            },
        };
    }
}

export async function executeLaunchFlow(
    ctx: ToolContext<Record<string, unknown>>,
    registration: WhatsAppRegistration,
    fetchFn: FetchFunction = fetch,
): Promise<Record<string, unknown>> {
    const timestamp = new Date().toISOString();
    const params = ctx.parameters ?? {};
    const rawTo = params.to ?? ctx.identity?.phone ?? ctx.identity?.whatsapp_number;
    const recipient = cleanRecipientPhone(rawTo);
    const flowRef = typeof params.flow_id === 'string' ? params.flow_id.trim() : '';
    const correlationId = typeof params.correlation_id === 'string' && params.correlation_id.trim()
        ? params.correlation_id.trim()
        : randomUUID();

    if (!recipient) {
        return {
            status: 'failed',
            message_id: null,
            recipient: '',
            flow_id: flowRef,
            correlation_id: correlationId,
            provider: 'meta',
            timestamp,
            error: {
                code: 'missing_parameter',
                message: 'Parameter "to" is required and must contain digits',
                retryable: false,
            },
        };
    }

    if (!flowRef) {
        return {
            status: 'failed',
            message_id: null,
            recipient,
            flow_id: '',
            correlation_id: correlationId,
            provider: 'meta',
            timestamp,
            error: {
                code: 'missing_parameter',
                message: 'Parameter "flow_id" is required',
                retryable: false,
            },
        };
    }

    // Resolve credentials
    const creds = resolveWhatsAppCredentials(ctx.settings ?? ctx.install_settings, registration.provider);
    if (!creds.accessToken || !creds.phoneNumberId) {
        return {
            status: 'failed',
            message_id: null,
            recipient,
            flow_id: flowRef,
            correlation_id: correlationId,
            provider: creds.provider,
            timestamp,
            error: {
                code: 'missing_credentials',
                message: 'WhatsApp provider credentials (access token and phone number ID) not configured',
                retryable: false,
            },
        };
    }

    // Resolve registered flow
    const registered = registration.flows.find((f) => f.id === flowRef || f.providerFlowId === flowRef);
    const providerFlowId = registered?.providerFlowId ?? flowRef;

    const requestedMode = typeof params.mode === 'string' ? params.mode.trim().toLowerCase() : undefined;
    const mode = requestedMode === 'draft' || registered?.mode === 'draft' ? 'draft' : 'published';

    // Reject blocked/deprecated registered flows
    if (registered?.status === 'BLOCKED' || registered?.status === 'DEPRECATED') {
        return {
            status: 'rejected',
            message_id: null,
            recipient,
            flow_id: flowRef,
            provider_flow_id: providerFlowId,
            correlation_id: correlationId,
            provider: creds.provider,
            timestamp,
            error: {
                code: 'flow_status_blocked',
                message: `Flow "${flowRef}" is ${registered.status} and cannot be launched`,
                retryable: false,
            },
        };
    }

    const flowToken = typeof params.flow_token === 'string' && params.flow_token.trim()
        ? params.flow_token.trim()
        : randomUUID();

    const cta = (typeof params.cta === 'string' && params.cta.trim()) ||
        registered?.cta ||
        'Continue';

    const bodyText = (typeof params.body === 'string' && params.body.trim()) ||
        registered?.description ||
        registered?.name ||
        'Please complete this flow';

    const flowAction = params.flow_action === 'data_exchange' ? 'data_exchange' : 'navigate';

    const flowParameters: Record<string, unknown> = {
        flow_message_version: '3',
        flow_token: flowToken,
        flow_id: providerFlowId,
        flow_cta: cta.slice(0, 20),
        flow_action: flowAction,
        mode,
    };

    if (flowAction === 'navigate') {
        const actionPayload: Record<string, unknown> = {};
        const payloadInput = (params.flow_action_payload && typeof params.flow_action_payload === 'object'
            ? params.flow_action_payload
            : {}) as Record<string, unknown>;

        const screen = typeof payloadInput.screen === 'string' && payloadInput.screen.trim()
            ? payloadInput.screen.trim()
            : registered?.screens?.[0]?.id;

        if (screen) actionPayload.screen = screen;
        if (payloadInput.data && typeof payloadInput.data === 'object') {
            actionPayload.data = payloadInput.data;
        }

        if (Object.keys(actionPayload).length > 0) {
            flowParameters.flow_action_payload = actionPayload;
        }
    }

    const interactive: Record<string, unknown> = {
        type: 'flow',
        body: { text: bodyText.slice(0, 1024) },
        action: {
            name: 'flow',
            parameters: flowParameters,
        },
    };

    if (typeof params.header === 'string' && params.header.trim()) {
        interactive.header = { type: 'text', text: params.header.trim() };
    }
    if (typeof params.footer === 'string' && params.footer.trim()) {
        interactive.footer = { text: params.footer.trim() };
    }

    const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient,
        type: 'interactive',
        interactive,
    };

    const url = `${creds.baseUrl}/${creds.apiVersion}/${creds.phoneNumberId}/messages`;

    try {
        ctx.logger.info?.(
            `[WhatsApp] Launching Flow "${flowRef}" (${providerFlowId}) to ${maskPhoneNumber(recipient)} (correlation: ${correlationId})`,
        );

        const resp = await fetchFn(url, {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                authorization: `Bearer ${creds.accessToken}`,
            },
            body: JSON.stringify(payload),
        });

        const status = resp.status;
        const text = await resp.text();
        let body: any = {};
        try {
            body = JSON.parse(text);
        } catch {
            body = { raw: text };
        }

        if (status >= 200 && status < 300) {
            const messageId = body?.messages?.[0]?.id ?? null;
            return {
                status: 'accepted',
                message_id: messageId,
                recipient,
                flow_id: flowRef,
                provider_flow_id: providerFlowId,
                flow_token: flowToken,
                correlation_id: correlationId,
                provider: creds.provider,
                timestamp,
                error: null,
            };
        }

        const metaError = body?.error;
        const code = metaError?.code ?? status;
        const isRetryable = isRetryableMetaError(status, typeof code === 'number' ? code : undefined);

        return {
            status: isRetryable ? 'failed' : 'rejected',
            message_id: null,
            recipient,
            flow_id: flowRef,
            provider_flow_id: providerFlowId,
            flow_token: flowToken,
            correlation_id: correlationId,
            provider: creds.provider,
            timestamp,
            error: {
                code: String(code),
                message: metaError?.message || text || 'WhatsApp Flow launch rejected',
                subcode: metaError?.error_subcode ?? null,
                retryable: isRetryable,
            },
        };
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        ctx.logger.error?.(
            `[WhatsApp] Network error launching Flow to ${maskPhoneNumber(recipient)}: ${message}`,
        );
        return {
            status: 'unknown',
            message_id: null,
            recipient,
            flow_id: flowRef,
            provider_flow_id: providerFlowId,
            flow_token: flowToken,
            correlation_id: correlationId,
            provider: creds.provider,
            timestamp,
            error: {
                code: 'timeout_or_network_error',
                message: `Request failed; outcome ambiguous: ${message}`,
                retryable: true,
            },
        };
    }
}

export async function executeGetTemplateStatus(
    ctx: ToolContext<Record<string, unknown>>,
    registration: WhatsAppRegistration,
    fetchFn: FetchFunction = fetch,
): Promise<Record<string, unknown>> {
    const timestamp = new Date().toISOString();
    const params = ctx.parameters ?? {};
    const templateRef = typeof params.template === 'string' ? params.template.trim() : '';

    if (!templateRef) {
        return {
            status: 'UNKNOWN',
            template: '',
            provider: 'meta',
            timestamp,
            error: { code: 'missing_parameter', message: 'Parameter "template" is required' },
        };
    }

    const creds = resolveWhatsAppCredentials(ctx.settings ?? ctx.install_settings, registration.provider);
    const registered = registration.templates.find((t) => t.name === templateRef);

    // If no network credentials configured, return registered template status if present
    if (!creds.accessToken || (!creds.wabaId && !registered?.providerId)) {
        if (registered) {
            return {
                status: registered.status ?? 'APPROVED',
                template: registered.name,
                language: registered.language ?? 'en_US',
                category: registered.category ?? null,
                provider_id: registered.providerId ?? null,
                provider: creds.provider,
                timestamp,
                error: null,
            };
        }
        return {
            status: 'UNKNOWN',
            template: templateRef,
            provider: creds.provider,
            timestamp,
            error: { code: 'missing_credentials', message: 'WhatsApp access token and WABA ID not configured' },
        };
    }

    const targetId = registered?.providerId || templateRef;
    const url = `${creds.baseUrl}/${creds.apiVersion}/${targetId}?fields=name,status,language,category,id`;

    try {
        const resp = await fetchFn(url, {
            headers: { authorization: `Bearer ${creds.accessToken}` },
        });
        const text = await resp.text();
        let body: any = {};
        try {
            body = JSON.parse(text);
        } catch {
            body = {};
        }

        if (resp.status >= 200 && resp.status < 300 && body.status) {
            return {
                status: body.status,
                template: body.name || templateRef,
                provider_id: body.id || targetId,
                language: body.language || registered?.language || 'en_US',
                category: body.category || registered?.category || null,
                provider: creds.provider,
                timestamp,
                error: null,
            };
        }

        return {
            status: registered?.status ?? 'UNKNOWN',
            template: templateRef,
            provider_id: registered?.providerId ?? null,
            provider: creds.provider,
            timestamp,
            error: body.error ? { code: String(body.error.code), message: body.error.message } : null,
        };
    } catch (err) {
        return {
            status: registered?.status ?? 'UNKNOWN',
            template: templateRef,
            provider_id: registered?.providerId ?? null,
            provider: creds.provider,
            timestamp,
            error: { code: 'network_error', message: err instanceof Error ? err.message : String(err) },
        };
    }
}

export async function executeGetFlowStatus(
    ctx: ToolContext<Record<string, unknown>>,
    registration: WhatsAppRegistration,
    fetchFn: FetchFunction = fetch,
): Promise<Record<string, unknown>> {
    const timestamp = new Date().toISOString();
    const params = ctx.parameters ?? {};
    const flowRef = typeof params.flow_id === 'string' ? params.flow_id.trim() : '';

    if (!flowRef) {
        return {
            status: 'UNKNOWN',
            flow_id: '',
            provider: 'meta',
            timestamp,
            error: { code: 'missing_parameter', message: 'Parameter "flow_id" is required' },
        };
    }

    const creds = resolveWhatsAppCredentials(ctx.settings ?? ctx.install_settings, registration.provider);
    const registered = registration.flows.find((f) => f.id === flowRef || f.providerFlowId === flowRef);
    const targetFlowId = registered?.providerFlowId || flowRef;

    if (!creds.accessToken) {
        if (registered) {
            return {
                status: registered.status ?? 'PUBLISHED',
                flow_id: registered.id,
                provider_flow_id: registered.providerFlowId ?? null,
                name: registered.name ?? null,
                categories: registered.categories ?? [],
                validation_errors: [],
                provider: creds.provider,
                timestamp,
                error: null,
            };
        }
        return {
            status: 'UNKNOWN',
            flow_id: flowRef,
            provider: creds.provider,
            timestamp,
            error: { code: 'missing_credentials', message: 'WhatsApp access token not configured' },
        };
    }

    const url = `${creds.baseUrl}/${creds.apiVersion}/${targetFlowId}?fields=id,name,status,categories,validation_errors`;

    try {
        const resp = await fetchFn(url, {
            headers: { authorization: `Bearer ${creds.accessToken}` },
        });
        const text = await resp.text();
        let body: any = {};
        try {
            body = JSON.parse(text);
        } catch {
            body = {};
        }

        if (resp.status >= 200 && resp.status < 300 && body.status) {
            return {
                status: body.status,
                flow_id: flowRef,
                provider_flow_id: body.id || targetFlowId,
                name: body.name || registered?.name || null,
                categories: Array.isArray(body.categories) ? body.categories : (registered?.categories ?? []),
                validation_errors: Array.isArray(body.validation_errors) ? body.validation_errors : [],
                provider: creds.provider,
                timestamp,
                error: null,
            };
        }

        return {
            status: registered?.status ?? 'UNKNOWN',
            flow_id: flowRef,
            provider_flow_id: registered?.providerFlowId ?? null,
            categories: registered?.categories ?? [],
            validation_errors: [],
            provider: creds.provider,
            timestamp,
            error: body.error ? { code: String(body.error.code), message: body.error.message } : null,
        };
    } catch (err) {
        return {
            status: registered?.status ?? 'UNKNOWN',
            flow_id: flowRef,
            provider_flow_id: registered?.providerFlowId ?? null,
            provider: creds.provider,
            timestamp,
            error: { code: 'network_error', message: err instanceof Error ? err.message : String(err) },
        };
    }
}

// ============================================================================
// Tool Generator for Qefro Integration
// ============================================================================

export function buildWhatsAppTools(
    registration: WhatsAppRegistration,
    customFetch?: FetchFunction,
): Array<{ definition: ToolDefinition; handler: (ctx: ToolContext) => Promise<unknown> }> {
    const fetchFn = customFetch ?? registration.provider?.fetchFn ?? fetch;

    return [
        {
            definition: {
                name: WHATSAPP_SEND_TEMPLATE_TOOL,
                description: 'Send an approved WhatsApp message template to a recipient phone number',
                input_schema: SEND_TEMPLATE_INPUT_SCHEMA,
                permissions: WHATSAPP_PERMISSIONS,
                auth: 'none',
            },
            handler: (ctx: ToolContext) => executeSendTemplate(ctx, registration, fetchFn),
        },
        {
            definition: {
                name: WHATSAPP_LAUNCH_FLOW_TOOL,
                description: 'Launch a published WhatsApp Flow interactive message to a recipient phone number',
                input_schema: LAUNCH_FLOW_INPUT_SCHEMA,
                permissions: WHATSAPP_PERMISSIONS,
                auth: 'none',
            },
            handler: (ctx: ToolContext) => executeLaunchFlow(ctx, registration, fetchFn),
        },
        {
            definition: {
                name: WHATSAPP_GET_TEMPLATE_STATUS_TOOL,
                description: 'Read WhatsApp message template status from the provider',
                input_schema: GET_TEMPLATE_STATUS_INPUT_SCHEMA,
                permissions: WHATSAPP_PERMISSIONS,
                auth: 'none',
            },
            handler: (ctx: ToolContext) => executeGetTemplateStatus(ctx, registration, fetchFn),
        },
        {
            definition: {
                name: WHATSAPP_GET_FLOW_STATUS_TOOL,
                description: 'Read WhatsApp Flow status and validation errors from the provider',
                input_schema: GET_FLOW_STATUS_INPUT_SCHEMA,
                permissions: WHATSAPP_PERMISSIONS,
                auth: 'none',
            },
            handler: (ctx: ToolContext) => executeGetFlowStatus(ctx, registration, fetchFn),
        },
    ];
}
