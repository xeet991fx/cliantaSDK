/**
 * MorrisB Tracking SDK - Plugins Index
 * @version 3.0.0
 */

export { BasePlugin } from './base';
export { PageViewPlugin } from './pageView';
export { ScrollPlugin } from './scroll';
export { FormsPlugin } from './forms';
export { ClicksPlugin } from './clicks';
export { EngagementPlugin } from './engagement';
export { DownloadsPlugin } from './downloads';
export { ExitIntentPlugin } from './exitIntent';
export { ErrorsPlugin } from './errors';
export { PerformancePlugin } from './performance';

import type { Plugin, PluginName } from '../types';
import { PageViewPlugin } from './pageView';
import { ScrollPlugin } from './scroll';
import { FormsPlugin } from './forms';
import { ClicksPlugin } from './clicks';
import { EngagementPlugin } from './engagement';
import { DownloadsPlugin } from './downloads';
import { ExitIntentPlugin } from './exitIntent';
import { ErrorsPlugin } from './errors';
import { PerformancePlugin } from './performance';

/**
 * Get plugin instance by name
 */
export function getPlugin(name: PluginName): Plugin {
    switch (name) {
        case 'pageView':
            return new PageViewPlugin();
        case 'scroll':
            return new ScrollPlugin();
        case 'forms':
            return new FormsPlugin();
        case 'clicks':
            return new ClicksPlugin();
        case 'engagement':
            return new EngagementPlugin();
        case 'downloads':
            return new DownloadsPlugin();
        case 'exitIntent':
            return new ExitIntentPlugin();
        case 'errors':
            return new ErrorsPlugin();
        case 'performance':
            return new PerformancePlugin();
        default:
            throw new Error(`Unknown plugin: ${name}`);
    }
}
