/**
 * @qefro-ai/connector — public API surface.
 * Modules live under src/*.ts; this file re-exports for backward compatibility.
 */

export { Qefro } from './app.js';
export { default } from './app.js';

export type { QefroConfig } from './protocol.js';
export { SDK_NAME, SDK_VERSION } from './protocol.js';

export type { ListenOptions, QefroServerHandle } from './server.js';
export { signBody, verifySignature } from './transport.js';

export type {
    ToolLookup,
    ToolDefinition,
    ToolRouting,
    RoutingIntent,
    RegisteredTool,
    ToolHandler,
    ToolContext,
} from './tools.js';
export { normalizeLookup } from './tools.js';

export type {
    PlatformStorageContext,
    PlatformCustomerContext,
    PlatformMarketingContext,
    PlatformMarketingBinding,
    PlatformOrganizationContext,
    PlatformOrganizationBinding,
    PlatformCapabilities,
    StorageContext,
} from './storage.js';

export type {
    FlowTrigger,
    BusinessFlowMetadata,
    FlowStepType,
    AskStepConfig,
    ToolStepConfig,
    ChallengeStepConfig,
    UploadStepConfig,
    ConditionStepConfig,
    DelayStepConfig,
    ApprovalStepConfig,
    CompleteStepConfig,
    MessageStepConfig,
    TagStepConfig,
    ActivityStepConfig,
    AssignStepConfig,
    FlowStep,
    BusinessFlow,
} from './flow.js';
export { FlowBuilder, normalizeFlowTrigger } from './flow.js';

export type {
    EventHandlerDefinition,
    EventHandler,
    EventContext,
} from './events.js';
export type {
    BusinessEventDefinition,
    BusinessEventField,
    EmittedBusinessEvent,
} from './business_events.js';
export { isBusinessEventType, stableEventId, normalizeEmittedEvent } from './business_events.js';

export type {
    ChallengePayload,
    AuthenticationContextPayload,
    AuthBuilder,
} from './auth.js';

export type {
    CustomerLookupContext,
    CustomerAuthorizeContext,
    CustomerProvider,
    CustomerAuthorizeOptions,
    CustomerContext,
    CustomerIdentityInput,
    CustomerUpdateInput,
    CustomerNoteOptions,
    CustomerTagOptions,
    HubCustomer,
    TimelineAppendInput,
    TimelineContext,
    MembershipAttachInput,
    MembershipContext,
    ConsentInput,
    ConsentContext,
} from './customer.js';
export {
    readIdentityPhone,
    envFlagTrue,
    isCustomerHubEnabled,
    isCustomerHubOptional,
    hubCustomerFromPerson,
    buildHubCustomerContext,
    buildTimelineContext,
    buildMembershipContext,
    buildConsentContext,
} from './customer.js';

export type {
    PersonRecord,
    PersonMutation,
    PersonContext,
    PersonEventName,
} from './person.js';
export {
    PersonEvents,
    personEventTrigger,
    onPersonCreated,
    onPersonUpdated,
    onPersonStatusChanged,
    onPersonMerged,
} from './person.js';

export type { Middleware, BeforeHook, AfterHook } from './middleware.js';

export type {
    MarketingAudienceSource,
    MarketingVariableType,
    MarketingVariableSource,
    MarketingActionKind,
    MarketingLandingHost,
    MarketingChannelId,
    MarketingAudienceCustomerHub,
    MarketingAudienceAppQuery,
    MarketingAudience,
    MarketingVariable,
    MarketingAction,
    MarketingLandingPage,
    MarketingChannel,
    MarketingDefinition,
    MarketingRegistration,
    MarketingCapability,
    MarketingContext,
} from './marketing.js';
export {
    validateMarketingDefinition,
    toMarketingCapability,
    isMarketingEnabled,
    buildMarketingContext,
} from './marketing.js';
export type {
    OrganizationTaskPriority,
    OrganizationEvent,
    OrganizationAction,
    OrganizationTaskType,
    OrganizationDefinition,
    OrganizationCapabilities,
    OrganizationCapability,
    OrganizationContext,
} from './organization.js';
export {
    validateOrganizationDefinition,
    toOrganizationCapability,
    isOrganizationEnabled,
    buildOrganizationContext,
} from './organization.js';
export type {
    ConversationSlotKind,
    ChipValueMode,
    ConversationSlotIdentity,
    ConversationSlot,
    OpaqueReference,
    CapabilityResult,
} from './conversation.js';
export { validateConversationSlots } from './conversation.js';

export type {
    WhatsAppDeliveryStatus,
    WhatsAppTemplateStatus,
    WhatsAppFlowStatus,
    WhatsAppFlowMode,
    WhatsAppFlowAction,
    WhatsAppTemplateComponent,
    WhatsAppTemplateDefinition,
    WhatsAppFlowScreen,
    WhatsAppFlowDefinition,
    WhatsAppProviderConfig,
    WhatsAppDefinition,
    WhatsAppRegistration,
    WhatsAppCapability,
    ResolvedWhatsAppCredentials,
} from './whatsapp.js';
export {
    WHATSAPP_SEND_TEMPLATE_TOOL,
    WHATSAPP_LAUNCH_FLOW_TOOL,
    WHATSAPP_GET_TEMPLATE_STATUS_TOOL,
    WHATSAPP_GET_FLOW_STATUS_TOOL,
    WHATSAPP_PERMISSIONS,
    SEND_TEMPLATE_INPUT_SCHEMA,
    LAUNCH_FLOW_INPUT_SCHEMA,
    GET_TEMPLATE_STATUS_INPUT_SCHEMA,
    GET_FLOW_STATUS_INPUT_SCHEMA,
    validateWhatsAppTemplate,
    validateWhatsAppFlow,
    validateWhatsAppDefinition,
    toWhatsAppCapability,
    resolveWhatsAppCredentials,
    maskPhoneNumber,
    cleanRecipientPhone,
    isRetryableMetaError,
    executeSendTemplate,
    executeLaunchFlow,
    executeGetTemplateStatus,
    executeGetFlowStatus,
    buildWhatsAppTools,
} from './whatsapp.js';

export type { InboxStatus, InboxRecord, ClaimResult } from './idempotency_inbox.js';
export {
    IdempotencyInbox,
    defaultInboxDir,
    PreMutationError,
    isProductionEnv,
    DEFAULT_CRASH_WINDOW_SECS,
    DEFAULT_RETENTION_TTL_DAYS,
} from './idempotency_inbox.js';


