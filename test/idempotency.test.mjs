import { createHmac, randomUUID } from 'crypto';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
    Qefro,
    IdempotencyInbox,
    defaultInboxDir,
} from '../dist/index.mjs';

function sign(secret, body, ts = Math.floor(Date.now() / 1000)) {
    const payload = `v1:${ts}:${body}`;
    const signature = `v1=${createHmac('sha256', secret).update(payload).digest('hex')}`;
    return { signature, timestamp: String(ts) };
}

describe('IdempotencyInbox unit tests', () => {
    it('claim, complete, and cached replay', () => {
        const testDir = join(tmpdir(), `qefro-test-inbox-${randomUUID()}`);
        const inbox = new IdempotencyInbox(testDir);
        const reqId = 'req-101';

        // 1. First claim succeeds
        const c1 = inbox.claim('tenant-1', 'order_cancel', reqId);
        assert.equal(c1.status, 'claimed');

        // 2. Concurrent claim while executing
        const c2 = inbox.claim('tenant-1', 'order_cancel', reqId);
        assert.equal(c2.status, 'concurrent_execution');

        // 3. Complete
        const resp = { order_id: 'ORD-1', canceled: true };
        inbox.complete('tenant-1', 'order_cancel', reqId, resp);

        // 4. Cached replay returns cached response without executing
        const c3 = inbox.claim('tenant-1', 'order_cancel', reqId);
        assert.equal(c3.status, 'cached');
        assert.deepEqual(c3.response, resp);

        rmSync(testDir, { recursive: true, force: true });
    });

    it('crash window triggers uncertain_crash', async () => {
        const testDir = join(tmpdir(), `qefro-test-inbox-${randomUUID()}`);
        // 0-second crash window so it immediately expires
        const inbox = new IdempotencyInbox(testDir, { crashWindowSecs: 0 });
        const reqId = 'req-crashed';

        const c1 = inbox.claim('tenant-1', 'charge_card', reqId);
        assert.equal(c1.status, 'claimed');

        // Sleep 15ms so age > 0s
        await new Promise((r) => setTimeout(r, 15));

        const c2 = inbox.claim('tenant-1', 'charge_card', reqId);
        assert.equal(c2.status, 'uncertain_crash');
        assert.equal(c2.record.request_id, reqId);
        assert.equal(c2.record.tool, 'charge_card');

        rmSync(testDir, { recursive: true, force: true });
    });

    it('tenant sharding isolation', () => {
        const testDir = join(tmpdir(), `qefro-test-inbox-${randomUUID()}`);
        const inbox = new IdempotencyInbox(testDir);
        const reqId = 'req-shared-id';

        // Tenant A claims and completes
        inbox.claim('tenant-a', 'action_a', reqId);
        inbox.complete('tenant-a', 'action_a', reqId, { tenant: 'a' });

        // Tenant B with same request_id does NOT collide
        const cB = inbox.claim('tenant-b', 'action_b', reqId);
        assert.equal(cB.status, 'claimed');

        rmSync(testDir, { recursive: true, force: true });
    });

    it('tool scoping isolation for identical request_id', () => {
        const testDir = join(tmpdir(), `qefro-test-inbox-${randomUUID()}`);
        const inbox = new IdempotencyInbox(testDir);
        const reqId = 'fixed-req-id';

        // Tool A claims and completes
        inbox.claim('tenant-1', 'tool_a', reqId);
        inbox.complete('tenant-1', 'tool_a', reqId, { result: 'from_a' });

        // Tool B with same request_id can claim and does NOT see tool A's cache
        const cB = inbox.claim('tenant-1', 'tool_b', reqId);
        assert.equal(cB.status, 'claimed');

        rmSync(testDir, { recursive: true, force: true });
    });

    it('fail_retryable allows re-claim whereas fail_uncertain blocks re-claim', () => {
        const testDir = join(tmpdir(), `qefro-test-inbox-${randomUUID()}`);
        const inbox = new IdempotencyInbox(testDir);

        // 1. fail_retryable test
        const reqRetry = 'req-retry-1';
        inbox.claim('tenant-1', 'order_cancel', reqRetry);
        inbox.fail_retryable('tenant-1', 'order_cancel', reqRetry);
        const claimAfterRetryable = inbox.claim('tenant-1', 'order_cancel', reqRetry);
        assert.equal(claimAfterRetryable.status, 'claimed', 'fail_retryable must allow re-claim');

        // 2. fail_uncertain test
        const reqUncertain = 'req-uncertain-1';
        inbox.claim('tenant-1', 'order_cancel', reqUncertain);
        inbox.fail_uncertain('tenant-1', 'order_cancel', reqUncertain);
        const claimAfterUncertain = inbox.claim('tenant-1', 'order_cancel', reqUncertain);
        assert.equal(claimAfterUncertain.status, 'uncertain_crash', 'fail_uncertain must block re-claim');

        rmSync(testDir, { recursive: true, force: true });
    });

    it('production environment requires persistent directory', () => {
        const prev = process.env.NODE_ENV;
        const prevDir = process.env.QEFRO_IDEMPOTENCY_DIR;
        try {
            process.env.NODE_ENV = 'production';
            delete process.env.QEFRO_IDEMPOTENCY_DIR;
            assert.throws(() => {
                defaultInboxDir('secret');
            }, /Persistent idempotency directory required in production/);
        } finally {
            if (prev !== undefined) process.env.NODE_ENV = prev;
            else delete process.env.NODE_ENV;
            if (prevDir !== undefined) process.env.QEFRO_IDEMPOTENCY_DIR = prevDir;
            else delete process.env.QEFRO_IDEMPOTENCY_DIR;
        }
    });
});

describe('Qefro App Tool Idempotency Integration', () => {
    it('caches replay and advertises idempotency_supported in capabilities.list when declared', async () => {
        const secret = 'test-secret';
        const testDir = join(tmpdir(), `qefro-test-app-inbox-${randomUUID()}`);
        const app = new Qefro({
            signingSecret: secret,
            idempotencyDir: testDir,
        });

        let callCount = 0;
        app.tool('charge_customer', { idempotency_supported: true }, async (ctx) => {
            callCount++;
            return {
                status: 'charged',
                amount: ctx.parameters.amount,
                request_id: ctx.request_id,
            };
        });

        // Also register a default tool without idempotency_supported
        app.tool('default_tool', async () => ({ ok: true }));

        // 1. Verify capabilities.list
        const capBody = JSON.stringify({
            protocol_version: '1',
            request_id: 'req-cap',
            type: 'capabilities.list',
        });
        const capSig = sign(secret, capBody);
        const capResp = await app.handleRaw(capBody, {
            'x-qefro-signature': capSig.signature,
            'x-qefro-timestamp': capSig.timestamp,
        });
        const chargeMeta = capResp.tools.find((t) => t.name === 'charge_customer');
        assert.ok(chargeMeta, 'charge_customer found in capabilities.list');
        assert.equal(chargeMeta.idempotency_supported, true);

        const defaultMeta = capResp.tools.find((t) => t.name === 'default_tool');
        assert.ok(defaultMeta, 'default_tool found in capabilities.list');
        assert.equal(defaultMeta.idempotency_supported, false, 'idempotency_supported MUST default to false');

        // 2. First invocation executes handler
        const invokeBody1 = JSON.stringify({
            protocol_version: '1',
            request_id: 'tx-req-999',
            type: 'tool.invoke',
            tool: 'charge_customer',
            parameters: { amount: 50 },
        });
        const sig1 = sign(secret, invokeBody1);
        const resp1 = await app.handleRaw(invokeBody1, {
            'x-qefro-signature': sig1.signature,
            'x-qefro-timestamp': sig1.timestamp,
        });

        assert.equal(resp1.type, 'result');
        assert.equal(resp1.output.status, 'charged');
        assert.equal(resp1.output.amount, 50);
        assert.equal(resp1.output.request_id, 'tx-req-999');
        assert.equal(callCount, 1);

        // 3. Second invocation with same request_id returns cached result WITHOUT re-invoking handler
        const invokeBody2 = JSON.stringify({
            protocol_version: '1',
            request_id: 'tx-req-999',
            type: 'tool.invoke',
            tool: 'charge_customer',
            parameters: { amount: 50 },
        });
        const sig2 = sign(secret, invokeBody2);
        const resp2 = await app.handleRaw(invokeBody2, {
            'x-qefro-signature': sig2.signature,
            'x-qefro-timestamp': sig2.timestamp,
        });

        assert.equal(resp2.type, 'result');
        assert.equal(resp2.output.status, 'charged');
        assert.equal(resp2.output.amount, 50);
        assert.equal(callCount, 1, 'handler must NOT be called a second time');

        rmSync(testDir, { recursive: true, force: true });
    });

    it('handler failure records uncertain_outcome and blocks duplicate invocation on retry', async () => {
        const secret = 'test-secret';
        const testDir = join(tmpdir(), `qefro-test-app-inbox-${randomUUID()}`);
        const app = new Qefro({
            signingSecret: secret,
            idempotencyDir: testDir,
        });

        let executions = 0;
        app.tool('pay_invoice', { idempotency_supported: true }, async () => {
            executions++;
            throw new Error('timeout contacting bank API after sending payment');
        });

        const reqBody = JSON.stringify({
            protocol_version: '1',
            request_id: 'req-invoice-1',
            type: 'tool.invoke',
            tool: 'pay_invoice',
            parameters: { invoice_id: 'INV-1' },
        });
        const s1 = sign(secret, reqBody);
        const r1 = await app.handleRaw(reqBody, {
            'x-qefro-signature': s1.signature,
            'x-qefro-timestamp': s1.timestamp,
        });
        assert.equal(r1.type, 'error');
        assert.equal(executions, 1);

        // Second attempt with SAME request_id: blocked fail-closed with UNCERTAIN_OUTCOME!
        const s2 = sign(secret, reqBody);
        const r2 = await app.handleRaw(reqBody, {
            'x-qefro-signature': s2.signature,
            'x-qefro-timestamp': s2.timestamp,
        });
        assert.equal(r2.type, 'error');
        assert.equal(r2.code, 'UNCERTAIN_OUTCOME');
        assert.equal(executions, 1, 'handler must NOT be called a second time after uncertain failure');

        rmSync(testDir, { recursive: true, force: true });
    });
});
