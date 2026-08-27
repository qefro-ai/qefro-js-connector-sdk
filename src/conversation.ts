/**
 * Conversation slot metadata (ADR-006).
 *
 * Apps declare harvest fields; Runtime treats `id` as opaque. Metadata only —
 * advertised through `capabilities.list.conversation_slots`.
 */

export type ConversationSlotKind =
    | 'string'
    | 'integer'
    | 'date'
    | 'time'
    | 'phone'
    | 'email'
    | 'document_id'
    | 'person_name'
    | 'choice';

export type ChipValueMode = 'remainder' | 'last_segment';

export type ConversationSlotIdentity = 'person_name' | 'email' | 'phone';

/** One field the app wants harvested from customer chat. */
export interface ConversationSlot {
    /** App field name — opaque to Runtime. */
    id: string;
    labels?: string[];
    kind?: ConversationSlotKind;
    aliases?: string[];
    chip_prefix?: string;
    chip_value?: ChipValueMode;
    chip_label_slot?: string;
    choices?: Record<string, string[]>;
    quantity_suffixes?: string[];
    identity?: ConversationSlotIdentity;
}

/** Generic capability / tool output reference. Runtime displays `value` only. */
export interface OpaqueReference {
    type: 'opaque' | (string & {});
    value: string;
}

export interface CapabilityResult {
    /** e.g. "confirmed" */
    status?: string;
    reference?: OpaqueReference;
}

const SLOT_KINDS = new Set<ConversationSlotKind>([
    'string',
    'integer',
    'date',
    'time',
    'phone',
    'email',
    'document_id',
    'person_name',
    'choice',
]);
const CHIP_VALUE_MODES = new Set<ChipValueMode>(['remainder', 'last_segment']);
const IDENTITIES = new Set<ConversationSlotIdentity>(['person_name', 'email', 'phone']);

function requireNonEmptyString(value: unknown, path: string): string {
    if (typeof value !== 'string' || !value.trim()) {
        throw new Error(`conversation_slots: ${path} must be a non-empty string`);
    }
    return value.trim();
}

function optionalString(value: unknown, path: string): string | undefined {
    if (value == null) return undefined;
    if (typeof value !== 'string') {
        throw new Error(`conversation_slots: ${path} must be a string`);
    }
    const trimmed = value.trim();
    return trimmed || undefined;
}

function optionalStringArray(value: unknown, path: string): string[] | undefined {
    if (value == null) return undefined;
    if (!Array.isArray(value)) {
        throw new Error(`conversation_slots: ${path} must be an array of strings`);
    }
    const out: string[] = [];
    for (let i = 0; i < value.length; i++) {
        const item = value[i];
        if (typeof item !== 'string' || !item.trim()) {
            throw new Error(`conversation_slots: ${path}[${i}] must be a non-empty string`);
        }
        out.push(item.trim());
    }
    return out;
}

function validateSlot(raw: unknown, index: number): ConversationSlot {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        throw new Error(`conversation_slots: [${index}] must be an object`);
    }
    const s = raw as Record<string, unknown>;
    const slot: ConversationSlot = { id: requireNonEmptyString(s.id, `[${index}].id`) };
    const labels = optionalStringArray(s.labels, `[${index}].labels`);
    if (labels) slot.labels = labels;
    if (s.kind != null) {
        const kind = requireNonEmptyString(s.kind, `[${index}].kind`);
        if (!SLOT_KINDS.has(kind as ConversationSlotKind)) {
            throw new Error(`conversation_slots: [${index}].kind is not a known kind`);
        }
        slot.kind = kind as ConversationSlotKind;
    }
    const aliases = optionalStringArray(s.aliases, `[${index}].aliases`);
    if (aliases) slot.aliases = aliases;
    const chipPrefix = optionalString(s.chip_prefix, `[${index}].chip_prefix`);
    if (chipPrefix) slot.chip_prefix = chipPrefix;
    if (s.chip_value != null) {
        const mode = requireNonEmptyString(s.chip_value, `[${index}].chip_value`);
        if (!CHIP_VALUE_MODES.has(mode as ChipValueMode)) {
            throw new Error(`conversation_slots: [${index}].chip_value must be remainder|last_segment`);
        }
        slot.chip_value = mode as ChipValueMode;
    }
    const chipLabelSlot = optionalString(s.chip_label_slot, `[${index}].chip_label_slot`);
    if (chipLabelSlot) slot.chip_label_slot = chipLabelSlot;
    if (s.choices != null) {
        if (typeof s.choices !== 'object' || Array.isArray(s.choices)) {
            throw new Error(`conversation_slots: [${index}].choices must be an object`);
        }
        const choices: Record<string, string[]> = {};
        for (const [value, synonyms] of Object.entries(s.choices as Record<string, unknown>)) {
            const list = optionalStringArray(synonyms, `[${index}].choices.${value}`);
            choices[value] = list ?? [];
        }
        slot.choices = choices;
    }
    const suffixes = optionalStringArray(s.quantity_suffixes, `[${index}].quantity_suffixes`);
    if (suffixes) slot.quantity_suffixes = suffixes;
    if (s.identity != null) {
        const identity = requireNonEmptyString(s.identity, `[${index}].identity`);
        if (!IDENTITIES.has(identity as ConversationSlotIdentity)) {
            throw new Error(`conversation_slots: [${index}].identity must be person_name|email|phone`);
        }
        slot.identity = identity as ConversationSlotIdentity;
    }
    return slot;
}

/** Validate and normalize conversation slot declarations. */
export function validateConversationSlots(slots: ConversationSlot[]): ConversationSlot[] {
    if (!Array.isArray(slots)) {
        throw new Error('conversation_slots: must be an array');
    }
    const out = slots.map(validateSlot);
    const seen = new Set<string>();
    for (const slot of out) {
        if (seen.has(slot.id)) {
            throw new Error(`conversation_slots: duplicate id "${slot.id}"`);
        }
        seen.add(slot.id);
    }
    return out;
}
