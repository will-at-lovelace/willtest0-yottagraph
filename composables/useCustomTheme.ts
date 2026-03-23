/**
 * Thin adapter around useNewsTheme (Brand R2).
 *
 * All branding logic lives in useNewsTheme.ts (copied wholesale from the
 * canonical branding repo).  This file re-exports it under the legacy
 * `useCustomTheme` name so existing Aether components keep working.
 *
 * Do NOT add theme logic here -- update the branding source instead.
 */
import { useNewsTheme, themeColors } from './useNewsTheme';
import type { NewsTheme } from './useNewsTheme';

export { themeColors };
export type AppTheme = NewsTheme;

export const useCustomTheme = () => {
    const result = useNewsTheme();
    return {
        ...result,
        theme: result.newsTheme,
        availableThemes: result.availableThemes,
    };
};
