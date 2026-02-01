/**
 * Utils Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock storage
const localStorageMock = {
    store: {} as Record<string, string>,
    getItem: vi.fn((key: string) => localStorageMock.store[key] || null),
    setItem: vi.fn((key: string, value: string) => { localStorageMock.store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete localStorageMock.store[key]; }),
    clear: vi.fn(() => { localStorageMock.store = {}; }),
};

const sessionStorageMock = {
    store: {} as Record<string, string>,
    getItem: vi.fn((key: string) => sessionStorageMock.store[key] || null),
    setItem: vi.fn((key: string, value: string) => { sessionStorageMock.store[key] = value; }),
    removeItem: vi.fn((key: string) => { delete sessionStorageMock.store[key]; }),
    clear: vi.fn(() => { sessionStorageMock.store = {}; }),
};

vi.stubGlobal('localStorage', localStorageMock);
vi.stubGlobal('sessionStorage', sessionStorageMock);
vi.stubGlobal('crypto', {
    randomUUID: vi.fn(() => '12345678-1234-1234-1234-123456789abc'),
});

import {
    generateUUID,
    getLocalStorage,
    setLocalStorage,
    getSessionStorage,
    setSessionStorage,
    getElementText,
    isTrackableClickElement,
    getFilenameFromUrl,
    getFileExtension,
    isDownloadUrl,
} from '../../src/utils';

describe('Utils', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorageMock.clear();
        sessionStorageMock.clear();
    });

    describe('generateUUID()', () => {
        it('should generate a valid UUID', () => {
            const uuid = generateUUID();
            expect(uuid).toBe('12345678-1234-1234-1234-123456789abc');
        });
    });

    describe('localStorage utilities', () => {
        it('should get and set localStorage values', () => {
            const result = setLocalStorage('test-key', 'test-value');
            expect(result).toBe(true);
            expect(getLocalStorage('test-key')).toBe('test-value');
        });

        it('should return null for missing keys', () => {
            expect(getLocalStorage('non-existent')).toBeNull();
        });
    });

    describe('sessionStorage utilities', () => {
        it('should get and set sessionStorage values', () => {
            const result = setSessionStorage('test-key', 'test-value');
            expect(result).toBe(true);
            expect(getSessionStorage('test-key')).toBe('test-value');
        });
    });

    describe('getElementText()', () => {
        it('should extract text content', () => {
            const mockElement = {
                innerText: 'Hello World',
            } as HTMLElement;
            expect(getElementText(mockElement)).toBe('Hello World');
        });

        it('should truncate long text', () => {
            const longText = 'A'.repeat(200);
            const mockElement = {
                innerText: longText,
            } as HTMLElement;
            expect(getElementText(mockElement, 100)).toHaveLength(100);
        });
    });

    describe('isTrackableClickElement()', () => {
        it('should return true for buttons', () => {
            const mockButton = {
                tagName: 'BUTTON',
                hasAttribute: () => false,
                classList: { contains: () => false },
            } as unknown as Element;
            expect(isTrackableClickElement(mockButton)).toBe(true);
        });

        it('should return true for links', () => {
            const mockLink = {
                tagName: 'A',
                hasAttribute: () => false,
                classList: { contains: () => false },
            } as unknown as Element;
            expect(isTrackableClickElement(mockLink)).toBe(true);
        });

        it('should return true for elements with data-track-click', () => {
            const mockDiv = {
                tagName: 'DIV',
                hasAttribute: (attr: string) => attr === 'data-track-click',
                classList: { contains: () => false },
            } as unknown as Element;
            expect(isTrackableClickElement(mockDiv)).toBe(true);
        });

        it('should return false for regular divs', () => {
            const mockDiv = {
                tagName: 'DIV',
                hasAttribute: () => false,
                classList: { contains: () => false },
            } as unknown as Element;
            expect(isTrackableClickElement(mockDiv)).toBe(false);
        });
    });

    describe('URL utilities', () => {
        describe('getFilenameFromUrl()', () => {
            it('should extract filename from URL', () => {
                expect(getFilenameFromUrl('https://example.com/files/document.pdf')).toBe('document.pdf');
            });

            it('should handle URLs with query strings', () => {
                expect(getFilenameFromUrl('https://example.com/file.pdf?v=123')).toBe('file.pdf');
            });
        });

        describe('getFileExtension()', () => {
            it('should extract file extension', () => {
                expect(getFileExtension('https://example.com/file.pdf')).toBe('pdf');
            });

            it('should return unknown for no extension', () => {
                expect(getFileExtension('https://example.com/file')).toBe('unknown');
            });
        });

        describe('isDownloadUrl()', () => {
            it('should identify PDF as download', () => {
                expect(isDownloadUrl('https://example.com/file.pdf')).toBe(true);
            });

            it('should identify ZIP as download', () => {
                expect(isDownloadUrl('https://example.com/archive.zip')).toBe(true);
            });

            it('should not identify HTML as download', () => {
                expect(isDownloadUrl('https://example.com/page.html')).toBe(false);
            });
        });
    });
});
