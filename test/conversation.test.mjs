import { createHmac } from 'crypto';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Qefro, validateConversationSlots } from '../dist/index.mjs';

function sign(secret, body, ts = Math.floor(Date.now() / 1000)) {
    const payload = `v1:${ts}:${body}`;
    const signature = `v1=${createHmac('sha256', secret).update(payload).digest('hex')}`;
    return { signature, timestamp: String(ts) };
}

const hostileSlots = [
    {
        id: 'spaceship_registration_code',
        labels: ['spaceship registration code', 'registration code'],
        kind: 'document_id',
        chip_prefix: 'ship',
    },
    {
        id: 'quantum_fuel_quantity',
        labels: ['quantum fuel', 'fuel quantity'],
        kind: 'integer',
        quantity_suffixes: ['units'],
    },
];

describe('conversation_slots schema validation', () => {
    it('accepts the existing manifest schema (id, not name)', () => {
        const out = validateConversationSlots(hostileSlots);
        assert.equal(out.length, 2);
        assert.equal(out[0].id, 'spaceship_registration_code');
        assert.equal(out[0].chip_prefix, 'ship');
        assert.equal(out[1].kind, 'integer');
        assert.deepEqual(out[1].quantity_suffixes, ['units']);
    });

    it('rejects missing id and duplicate ids', () => {
        assert.throws(() => validateConversationSlots([{ labels: ['x'] }]), /non-empty string/);
        assert.throws(
            () =>
                validateConversationSlots([
                    { id: 'same' },
                    { id: 'same' },
                ]),
            /duplicate id/,
        );
    });

    it('rejects calling conversationSlots() twice', () => {
        const app = new Qefro({ signingSecret: 'test-secret' });
        app.conversationSlots([{ id: 'a' }]);
        assert.throws(() => app.conversationSlots([{ id: 'b' }]), /only be called once/);
    });
});

describe('capabilities.list.conversation_slots', () => {
    it('advertises hostile-domain slots without Runtime vocabulary', async () => {
        const secret = 'test-secret';
        const app = new Qefro({ signingSecret: secret });
        app.conversationSlots(hostileSlots);

        const body = JSON.stringify({
            protocol_version: '1',
            request_id: 'r1',
            type: 'capabilities.list',
        });
        const { signature, timestamp } = sign(secret, body);
        const caps = await app.handleRaw(body, {
            'x-qefro-signature': signature,
            'x-qefro-timestamp': timestamp,
        });
        assert.equal(caps.type, 'capabilities.list');
        assert.ok(caps.conversation_slots);
        assert.equal(caps.conversation_slots.length, 2);
        assert.equal(caps.conversation_slots[0].id, 'spaceship_registration_code');
        assert.equal(caps.conversation_slots[1].id, 'quantum_fuel_quantity');
        assert.equal(caps.conversation_slots[0].name, undefined);
        assert.equal(caps.conversation_slots[0].chipPrefix, undefined);
    });

    it('omits conversation_slots when not registered', async () => {
        const secret = 'test-secret';
        const app = new Qefro({ signingSecret: secret });
        const body = JSON.stringify({
            protocol_version: '1',
            request_id: 'r2',
            type: 'capabilities.list',
        });
        const { signature, timestamp } = sign(secret, body);
        const caps = await app.handleRaw(body, {
            'x-qefro-signature': signature,
            'x-qefro-timestamp': timestamp,
        });
        assert.equal(caps.type, 'capabilities.list');
        assert.equal(caps.conversation_slots, undefined);
    });
});
