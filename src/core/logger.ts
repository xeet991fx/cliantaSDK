/**
 * Clianta SDK - Debug Logger
 * @see SDK_VERSION in core/config.ts
 */

import type { Logger, LogLevel } from '../types';

const LOG_PREFIX = '[Clianta]';

const LOG_STYLES = {
    debug: 'color: #6b7280; font-weight: normal;',
    info: 'color: #3b82f6; font-weight: normal;',
    warn: 'color: #f59e0b; font-weight: bold;',
    error: 'color: #ef4444; font-weight: bold;',
};

const LOG_LEVELS: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

/**
 * Create a logger instance
 */
export function createLogger(enabled = false): Logger & { enabled: boolean } {
    let currentLevel: LogLevel = 'debug';
    let isEnabled = enabled;

    const shouldLog = (level: LogLevel): boolean => {
        if (!isEnabled) return false;
        return LOG_LEVELS[level] >= LOG_LEVELS[currentLevel];
    };

    const formatArgs = (level: LogLevel, args: unknown[]): unknown[] => {
        if (typeof console !== 'undefined' && typeof window !== 'undefined') {
            // Browser with styled console
            return [`%c${LOG_PREFIX}`, LOG_STYLES[level], ...args];
        }
        // Node.js or basic console
        return [`${LOG_PREFIX} [${level.toUpperCase()}]`, ...args];
    };

    return {
        get enabled() {
            return isEnabled;
        },
        set enabled(value: boolean) {
            isEnabled = value;
        },

        debug(...args: unknown[]) {
            if (shouldLog('debug') && typeof console !== 'undefined') {
                console.log(...formatArgs('debug', args));
            }
        },

        info(...args: unknown[]) {
            if (shouldLog('info') && typeof console !== 'undefined') {
                console.info(...formatArgs('info', args));
            }
        },

        warn(...args: unknown[]) {
            if (shouldLog('warn') && typeof console !== 'undefined') {
                console.warn(...formatArgs('warn', args));
            }
        },

        error(...args: unknown[]) {
            if (shouldLog('error') && typeof console !== 'undefined') {
                console.error(...formatArgs('error', args));
            }
        },

        setLevel(level: LogLevel) {
            currentLevel = level;
        },
    };
}

/** Global logger instance */
export const logger = createLogger(false);
