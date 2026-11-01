/**
 * Type surface for the optional dev plugin in `.vite-source-tags.js`.
 * Lets Vite config import it without an untyped `@ts-ignore`.
 */
import type { Plugin } from 'vite';

export declare function sourceTags(): Plugin;
export declare const agonSourceTags: typeof sourceTags;
