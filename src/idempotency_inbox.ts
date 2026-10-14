/**
 * Durable idempotency inbox for SDK tool invocations.
 *
 * Provides effectively-once execution semantics by recording incoming request_id
 * in a durable file-based ledger. Replayed requests for completed operations return
 * the cached response without re-invoking downstream handlers.
 * Concurrent invocations return a concurrent conflict status.
 * Abandoned executions exceeding the crash recovery window return UNCERTAIN_OUTCOME
 * to fail closed and prevent unsafe duplicate mutations.
 */

import {
    closeSync,
    existsSync,
    fsyncSync,
    mkdirSync,
    openSync,
    readdirSync,
    readFileSync,
    renameSync,
    statSync,
    unlinkSync,
    writeSync,
} from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { createHash } from 'crypto';

/** Default crash recovery threshold window (5 minutes). */
export const DEFAULT_CRASH_WINDOW_SECS = 300;

/** Default retention TTL (7 days). */
export const DEFAULT_RETENTION_TTL_DAYS = 7;

export type InboxStatus = 'executing' | 'completed' | 'failed_retryable' | 'uncertain_outcome';

export interface InboxRecord {
    request_id: string;
    tool: string;
    status: InboxStatus;
    created_at: string;
    updated_at: string;
    expires_at: string;
    response?: unknown;
}

export type ClaimResult =
    | { status: 'claimed' }
    | { status: 'cached'; response: unknown }
    | { status: 'concurrent_execution' }
    | { status: 'uncertain_crash'; record: InboxRecord };

/**
 * Explicit error thrown when failure definitely occurred before any mutation began.
 * Informs the idempotency inbox to record 'failed_retryable' instead of 'uncertain_outcome'.
 */
export class PreMutationError extends Error {
    readonly isPreMutation = true;
    constructor(message: string) {
        super(message);
        this.name = 'PreMutationError';
    }
}

export function isProductionEnv(): boolean {
    const env = (
        process.env.NODE_ENV ||
        process.env.QEFRO_ENV ||
        process.env.ENVIRONMENT ||
        ''
    ).toLowerCase();
    return env === 'production' || env === 'prod';
}

export function defaultInboxDir(signingSecret: string): string {
    const envDir = process.env.QEFRO_IDEMPOTENCY_DIR?.trim();
    if (envDir) {
        return envDir;
    }
    if (isProductionEnv()) {
        throw new Error(
            'Persistent idempotency directory required in production. ' +
            'Specify QEFRO_IDEMPOTENCY_DIR or config.idempotencyDir. ' +
            'Ephemeral temp storage is not permitted in production.'
        );
    }
    const shard = createHash('sha256').update(signingSecret).digest('hex').slice(0, 8);
    return join(tmpdir(), 'qefro-idempotency-inbox', shard);
}

function fileNameFor(tool: string, requestId: string): string {
    const safeTool = tool
        .split('')
        .map((c) => (/[a-zA-Z0-9_\-]/.test(c) ? c : '_'))
        .join('')
        .slice(0, 64);
    const safeReq = requestId
        .split('')
        .map((c) => (/[a-zA-Z0-9_\-\.]/.test(c) ? c : '_'))
        .join('')
        .slice(0, 128);
    return `${safeTool}__${safeReq}.json`;
}

function sanitizeTenant(tenantId?: string): string {
    if (!tenantId) return 'default';
    const safe = tenantId
        .split('')
        .filter((c) => /[a-zA-Z0-9_\-]/.test(c))
        .join('');
    return safe.length > 0 ? safe : 'default';
}

export class IdempotencyInbox {
    private readonly dir: string;
    private readonly crashWindowMs: number;
    private readonly retentionTtlMs: number;

    constructor(
        dir: string,
        options?: { crashWindowSecs?: number; retentionDays?: number },
    ) {
        this.dir = dir;
        this.crashWindowMs = (options?.crashWindowSecs ?? DEFAULT_CRASH_WINDOW_SECS) * 1000;
        this.retentionTtlMs = (options?.retentionDays ?? DEFAULT_RETENTION_TTL_DAYS) * 24 * 60 * 60 * 1000;
        mkdirSync(this.dir, { recursive: true });
    }

    getDir(): string {
        return this.dir;
    }

    recordPath(tenantId: string | undefined, tool: string, requestId: string): string {
        return join(this.dir, sanitizeTenant(tenantId), fileNameFor(tool, requestId));
    }

    claim(
        tenantId: string | undefined,
        tool: string,
        requestId: string,
    ): ClaimResult {
        const path = this.recordPath(tenantId, tool, requestId);
        mkdirSync(dirname(path), { recursive: true });

        const now = new Date();
        const nowIso = now.toISOString();
        const expiresIso = new Date(now.getTime() + this.retentionTtlMs).toISOString();

        const record: InboxRecord = {
            request_id: requestId,
            tool,
            status: 'executing',
            created_at: nowIso,
            updated_at: nowIso,
            expires_at: expiresIso,
        };

        const body = JSON.stringify(record, null, 2);

        try {
            const fd = openSync(path, 'wx');
            try {
                writeSync(fd, body);
                fsyncSync(fd);
            } finally {
                closeSync(fd);
            }
            return { status: 'claimed' };
        } catch (err: unknown) {
            const error = err as NodeJS.ErrnoException;
            if (error && error.code === 'EEXIST') {
                let existing: InboxRecord;
                try {
                    existing = JSON.parse(readFileSync(path, 'utf8'));
                } catch (readErr) {
                    throw new Error(`Corrupt idempotency record at ${path}: ${readErr}`);
                }

                if (existing.status === 'completed') {
                    return {
                        status: 'cached',
                        response: existing.response ?? { status: 'success' },
                    };
                }

                if (existing.status === 'executing') {
                    const ageMs = Date.now() - new Date(existing.created_at).getTime();
                    if (ageMs < this.crashWindowMs) {
                        return { status: 'concurrent_execution' };
                    } else {
                        this.updateStatus(tenantId, tool, requestId, 'uncertain_outcome');
                        return { status: 'uncertain_crash', record: existing };
                    }
                }

                if (existing.status === 'uncertain_outcome' || (existing.status as string) === 'uncertain_crash') {
                    return { status: 'uncertain_crash', record: existing };
                }

                if (existing.status === 'failed_retryable') {
                    this.updateStatus(tenantId, tool, requestId, 'executing');
                    return { status: 'claimed' };
                }
            }
            throw err;
        }
    }

    complete(
        tenantId: string | undefined,
        tool: string,
        requestId: string,
        response: unknown,
    ): void {
        this.updateStatus(tenantId, tool, requestId, 'completed', response);
    }

    fail_retryable(
        tenantId: string | undefined,
        tool: string,
        requestId: string,
    ): void {
        this.updateStatus(tenantId, tool, requestId, 'failed_retryable');
    }

    fail_uncertain(
        tenantId: string | undefined,
        tool: string,
        requestId: string,
    ): void {
        this.updateStatus(tenantId, tool, requestId, 'uncertain_outcome');
    }

    fail(
        tenantId: string | undefined,
        tool: string,
        requestId: string,
    ): void {
        this.fail_uncertain(tenantId, tool, requestId);
    }

    private updateStatus(
        tenantId: string | undefined,
        tool: string,
        requestId: string,
        status: InboxStatus,
        response?: unknown,
    ): void {
        const path = this.recordPath(tenantId, tool, requestId);
        mkdirSync(dirname(path), { recursive: true });

        let record: InboxRecord;
        if (existsSync(path)) {
            try {
                record = JSON.parse(readFileSync(path, 'utf8'));
            } catch {
                const now = new Date();
                record = {
                    request_id: requestId,
                    tool,
                    status,
                    created_at: now.toISOString(),
                    updated_at: now.toISOString(),
                    expires_at: new Date(now.getTime() + this.retentionTtlMs).toISOString(),
                };
            }
        } else {
            const now = new Date();
            record = {
                request_id: requestId,
                tool,
                status,
                created_at: now.toISOString(),
                updated_at: now.toISOString(),
                expires_at: new Date(now.getTime() + this.retentionTtlMs).toISOString(),
            };
        }

        record.status = status;
        record.updated_at = new Date().toISOString();
        if (response !== undefined) {
            record.response = response;
        }

        const tmp = `${path}.tmp`;
        const fd = openSync(tmp, 'w');
        try {
            writeSync(fd, JSON.stringify(record, null, 2));
            fsyncSync(fd);
        } finally {
            closeSync(fd);
        }
        renameSync(tmp, path);
    }

    prune(): void {
        const nowIso = new Date().toISOString();
        this.pruneDir(this.dir, nowIso);
    }

    private pruneDir(dir: string, nowIso: string): void {
        let entries: string[];
        try {
            entries = readdirSync(dir);
        } catch {
            return;
        }

        for (const entry of entries) {
            const fullPath = join(dir, entry);
            try {
                const stat = statSync(fullPath);
                if (stat.isDirectory()) {
                    this.pruneDir(fullPath, nowIso);
                } else if (entry.endsWith('.json')) {
                    const record = JSON.parse(readFileSync(fullPath, 'utf8')) as InboxRecord;
                    if (record && record.expires_at <= nowIso) {
                        unlinkSync(fullPath);
                    }
                }
            } catch {
                // ignore
            }
        }
    }
}
