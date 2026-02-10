/**
 * Config Tests
 */

import { describe, it, expect } from 'vitest';
import {
    mergeConfig,
    DEFAULT_PLUGINS,
    DEFAULT_CONFIG,
    SDK_VERSION,
} from '../../src/core/config';

describe('Config', () => {
    describe('SDK_VERSION', () => {
        it('should be a valid semver string', () => {
            expect(SDK_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
        });
    });

    describe('DEFAULT_PLUGINS', () => {
        it('should include core plugins', () => {
            expect(DEFAULT_PLUGINS).toContain('pageView');
            expect(DEFAULT_PLUGINS).toContain('forms');
            expect(DEFAULT_PLUGINS).toContain('scroll');
            expect(DEFAULT_PLUGINS).toContain('clicks');
            expect(DEFAULT_PLUGINS).toContain('engagement');
            expect(DEFAULT_PLUGINS).toContain('downloads');
            expect(DEFAULT_PLUGINS).toContain('exitIntent');
        });

        it('should NOT include popupForms by default (opt-in)', () => {
            expect(DEFAULT_PLUGINS).not.toContain('popupForms');
        });
    });

    describe('DEFAULT_CONFIG', () => {
        it('should have correct default values', () => {
            expect(DEFAULT_CONFIG.debug).toBe(false);
            expect(DEFAULT_CONFIG.autoPageView).toBe(true);
            expect(DEFAULT_CONFIG.sessionTimeout).toBe(30 * 60 * 1000);
            expect(DEFAULT_CONFIG.batchSize).toBe(10);
            expect(DEFAULT_CONFIG.flushInterval).toBe(5000);
            expect(DEFAULT_CONFIG.useCookies).toBe(false);
            expect(DEFAULT_CONFIG.cookielessMode).toBe(false);
        });

        it('should have consent defaults', () => {
            expect(DEFAULT_CONFIG.consent.waitForConsent).toBe(false);
            expect(DEFAULT_CONFIG.consent.anonymousMode).toBe(false);
            expect(DEFAULT_CONFIG.consent.defaultConsent.analytics).toBe(true);
        });
    });

    describe('mergeConfig()', () => {
        it('should return defaults for empty config', () => {
            const result = mergeConfig({});
            expect(result.debug).toBe(DEFAULT_CONFIG.debug);
            expect(result.batchSize).toBe(DEFAULT_CONFIG.batchSize);
        });

        it('should override defaults with user config', () => {
            const result = mergeConfig({ debug: true, batchSize: 20 });
            expect(result.debug).toBe(true);
            expect(result.batchSize).toBe(20);
        });

        it('should merge nested consent config', () => {
            const result = mergeConfig({
                consent: { waitForConsent: true },
            });
            expect(result.consent.waitForConsent).toBe(true);
            expect(result.consent.anonymousMode).toBe(false); // Preserved from default
        });

        it('should handle undefined config', () => {
            const result = mergeConfig();
            expect(result).toEqual(DEFAULT_CONFIG);
        });

        it('should preserve user plugins', () => {
            const userPlugins = ['pageView', 'forms', 'popupForms'] as const;
            const result = mergeConfig({ plugins: [...userPlugins] });
            expect(result.plugins).toContain('popupForms');
        });
    });
});
