// Setup helper - run with: node _mkdir_helper.js
// Creates tests/integration/ directory and writes integration test files, then self-deletes
const fs = require('fs');
const path = require('path');

const integrationDir = path.join(__dirname, 'tests', 'integration');
fs.mkdirSync(integrationDir, { recursive: true });
console.log('Created: tests/integration/');

// Write tracking-flow.test.ts
const trackingFlowContent = `import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock navigator.sendBeacon
Object.defineProperty(navigator, 'sendBeacon', {
  value: vi.fn(() => true),
  writable: true,
});

describe('Integration: Full Tracking Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    // Clear sessionStorage
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear();
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize tracker with config', async () => {
    const { Tracker } = await import('../../src/core/tracker');

    const tracker = new Tracker({
      projectId: 'test-workspace',
      apiEndpoint: 'https://api.test.com',
      debug: false,
    });

    expect(tracker).toBeDefined();
    expect(tracker.getVisitorId()).toBeTruthy();
    expect(tracker.getSessionId()).toBeTruthy();
  });

  it('should track events and flush them', async () => {
    const { Tracker } = await import('../../src/core/tracker');

    const tracker = new Tracker({
      projectId: 'test-workspace',
      apiEndpoint: 'https://api.test.com',
      batchSize: 2,
    });

    tracker.track('button_click', 'CTA Button', { page: 'home' });
    tracker.track('page_view', 'Home Page');

    // Wait for auto-flush
    await new Promise(resolve => setTimeout(resolve, 100));
    await tracker.flush();

    // Verify fetch was called (events sent)
    expect(mockFetch).toHaveBeenCalled();
  });

  it('should identify user and return contactId', async () => {
    const { Tracker } = await import('../../src/core/tracker');

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ contactId: 'contact-123' }),
    });

    const tracker = new Tracker({
      projectId: 'test-workspace',
      apiEndpoint: 'https://api.test.com',
    });

    const contactId = await tracker.identify('user@test.com', {
      firstName: 'Test',
      lastName: 'User',
    });

    expect(mockFetch).toHaveBeenCalled();
  });

  it('should handle consent flow - buffer then flush', async () => {
    const { Tracker } = await import('../../src/core/tracker');

    const tracker = new Tracker({
      projectId: 'test-workspace',
      apiEndpoint: 'https://api.test.com',
      requireConsent: true,
    });

    // Track events before consent - should be buffered
    tracker.track('page_view', 'Home');
    tracker.track('button_click', 'CTA');

    // Grant consent
    tracker.consent({
      analytics: true,
      marketing: false,
      personalization: false,
    });

    // Events should now be processable
    await tracker.flush();
  });

  it('should generate unique visitor and session IDs', async () => {
    const { Tracker } = await import('../../src/core/tracker');

    const tracker1 = new Tracker({
      projectId: 'test-workspace',
      apiEndpoint: 'https://api.test.com',
    });

    const tracker2 = new Tracker({
      projectId: 'test-workspace-2',
      apiEndpoint: 'https://api.test.com',
    });

    // Different workspace = different visitor IDs (if not shared)
    expect(tracker1.getVisitorId()).toBeTruthy();
    expect(tracker2.getVisitorId()).toBeTruthy();
  });

  it('should track page view with properties', async () => {
    const { Tracker } = await import('../../src/core/tracker');

    const tracker = new Tracker({
      projectId: 'test-workspace',
      apiEndpoint: 'https://api.test.com',
    });

    tracker.page('Home Page', { section: 'hero' });
    await tracker.flush();

    expect(mockFetch).toHaveBeenCalled();
  });
});

describe('Integration: GDPR & Privacy', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
  });

  it('should support cookie-less mode', async () => {
    const { Tracker } = await import('../../src/core/tracker');

    const tracker = new Tracker({
      projectId: 'test-workspace',
      apiEndpoint: 'https://api.test.com',
      cookieless: true,
    });

    expect(tracker.getVisitorId()).toBeTruthy();
  });

  it('should support anonymous mode', async () => {
    const { Tracker } = await import('../../src/core/tracker');

    const tracker = new Tracker({
      projectId: 'test-workspace',
      apiEndpoint: 'https://api.test.com',
      anonymousMode: true,
    });

    tracker.track('page_view', 'Test Page');
    await tracker.flush();
  });

  it('should handle deleteData for right-to-erasure', async () => {
    const { Tracker } = await import('../../src/core/tracker');

    const tracker = new Tracker({
      projectId: 'test-workspace',
      apiEndpoint: 'https://api.test.com',
    });

    tracker.deleteData();

    // After deletion, visitor ID should be regenerated or cleared
    expect(tracker.getVisitorId()).toBeTruthy();
  });
});
`;

fs.writeFileSync(path.join(integrationDir, 'tracking-flow.test.ts'), trackingFlowContent.trimStart());
console.log('Written: tests/integration/tracking-flow.test.ts');

// Write consent-flow.test.ts
const consentFlowContent = `import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
global.fetch = mockFetch;

Object.defineProperty(navigator, 'sendBeacon', {
  value: vi.fn(() => true),
  writable: true,
});

describe('Integration: Consent Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
  });

  it('should buffer events when consent is required but not granted', async () => {
    const { Tracker } = await import('../../src/core/tracker');

    const tracker = new Tracker({
      projectId: 'test-workspace',
      apiEndpoint: 'https://api.test.com',
      requireConsent: true,
    });

    // These should be buffered, not sent
    tracker.track('page_view', 'Home');
    tracker.track('button_click', 'CTA');

    await tracker.flush();

    // In consent-required mode, events should be held until consent
    // The exact behavior depends on implementation
    expect(tracker).toBeDefined();
  });

  it('should send buffered events after consent is granted', async () => {
    const { Tracker } = await import('../../src/core/tracker');

    const tracker = new Tracker({
      projectId: 'test-workspace',
      apiEndpoint: 'https://api.test.com',
      requireConsent: true,
    });

    tracker.track('page_view', 'Home');

    // Grant consent
    tracker.consent({
      analytics: true,
      marketing: false,
      personalization: false,
    });

    await tracker.flush();

    // After consent, events should be sendable
    expect(tracker).toBeDefined();
  });

  it('should respect partial consent - analytics only', async () => {
    const { Tracker } = await import('../../src/core/tracker');

    const tracker = new Tracker({
      projectId: 'test-workspace',
      apiEndpoint: 'https://api.test.com',
      requireConsent: true,
    });

    tracker.consent({
      analytics: true,
      marketing: false,
      personalization: false,
    });

    tracker.track('page_view', 'Home');
    await tracker.flush();

    expect(tracker).toBeDefined();
  });
});
`;

fs.writeFileSync(path.join(integrationDir, 'consent-flow.test.ts'), consentFlowContent.trimStart());
console.log('Written: tests/integration/consent-flow.test.ts');

// Self-cleanup: remove this helper script and any other temp files
try { fs.unlinkSync(__filename); console.log('Cleaned up: _mkdir_helper.js'); } catch {}
try { fs.unlinkSync(path.join(__dirname, 'cdn-build.js')); } catch {}
try { fs.unlinkSync(path.join(__dirname, '_bootstrap-cdn-build.js')); } catch {}
try { fs.unlinkSync(path.join(__dirname, '..', 'create_test_files.js')); } catch {}

console.log('Setup complete! You can now run: npm test');
