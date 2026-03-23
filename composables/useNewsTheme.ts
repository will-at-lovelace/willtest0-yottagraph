import { computed, reactive, onMounted } from 'vue';
import { useTheme } from 'vuetify';

// Single brand theme -- Brand R2
export type NewsTheme = 'brand';

// Create a global reactive state that's shared across all component instances
const globalThemeState = reactive({
    newsTheme: 'brand' as NewsTheme,
    initialized: true,
});

// Brand R2 color palette
export const themeColors = {
    brand: {
        primary: '#3FEA00', // Cyber Green
        secondary: '#FF5C00', // Blaze Orange
        accent: '#003BFF', // Electric Blue
        background: '#0A0A0A', // Jet Black
        surface: '#141414',
        cardBackground: '#1E1E1E',
        panelBackground: '#111111',
        textPrimary: '#FFFFFF',
        textSecondary: '#A0AEC0',
        textMuted: '#757575', // Sonic Silver
        hover: '#1E1E1E',
        border: '#2A2A2A',
        success: '#3FEA00', // Cyber Green
        warning: '#FF9F0A', // Amber
        error: '#EF4444',
        headerGradientStart: '#0A0A0A',
        headerGradientEnd: '#141414',
    },
};

// This composable manages the theme for the news section
export const useNewsTheme = () => {
    const theme = useTheme();

    // Single theme -- always "brand"
    const newsTheme = computed({
        get: () => globalThemeState.newsTheme,
        set: (_value: NewsTheme) => {
            // no-op: single theme
        },
    });

    // Always dark mode
    const isDarkMode = computed(() => true);

    // Get the current theme colors
    const currentThemeColors = computed(() => themeColors.brand);

    // Kept for API compatibility -- these are now no-ops
    const toggleTheme = () => {};
    const setTheme = (_newTheme: string) => {};

    // Function to apply CSS variables to the root element
    const applyThemeCssVariables = () => {
        if (typeof window === 'undefined') return;
        const colors = themeColors.brand;
        const root = document.documentElement;

        root.style.setProperty('--dynamic-primary', colors.primary);
        root.style.setProperty('--dynamic-secondary', colors.secondary);
        root.style.setProperty('--dynamic-accent', colors.accent);
        root.style.setProperty('--dynamic-background', colors.background);
        root.style.setProperty('--dynamic-surface', colors.surface);
        root.style.setProperty('--dynamic-card-background', colors.cardBackground);
        root.style.setProperty('--dynamic-panel-background', colors.panelBackground);
        root.style.setProperty('--dynamic-text-primary', colors.textPrimary);
        root.style.setProperty('--dynamic-text-secondary', colors.textSecondary);
        root.style.setProperty('--dynamic-text-muted', colors.textMuted);
        root.style.setProperty('--dynamic-hover', colors.hover);
        root.style.setProperty('--dynamic-border', colors.border);
        root.style.setProperty('--dynamic-success', colors.success);
        root.style.setProperty('--dynamic-warning', colors.warning);
        root.style.setProperty('--dynamic-error', colors.error);
        root.style.setProperty('--dynamic-header-gradient-start', colors.headerGradientStart);
        root.style.setProperty('--dynamic-header-gradient-end', colors.headerGradientEnd);
    };

    // Apply theme CSS variables on initial load
    onMounted(() => {
        applyThemeCssVariables();
        theme.change('lovelaceDark');
    });

    // Also apply immediately when the composable is called
    if (typeof window !== 'undefined') {
        applyThemeCssVariables();
        theme.change('lovelaceDark');
    }

    // Helper function to get theme-specific colors
    const getThemeColor = (colorKey: keyof (typeof themeColors)['brand']) => {
        return currentThemeColors.value[colorKey];
    };

    // Get CSS variables for current theme
    const getCssVariables = () => {
        const colors = currentThemeColors.value;
        return {
            '--color-primary': colors.primary,
            '--color-secondary': colors.secondary,
            '--color-accent': colors.accent,
            '--color-background': colors.background,
            '--color-surface': colors.surface,
            '--color-card-background': colors.cardBackground,
            '--color-panel-background': colors.panelBackground,
            '--color-text-primary': colors.textPrimary,
            '--color-text-secondary': colors.textSecondary,
            '--color-text-muted': colors.textMuted,
            '--color-hover': colors.hover,
            '--color-border': colors.border,
            '--color-success': colors.success,
            '--color-warning': colors.warning,
            '--color-error': colors.error,
            '--color-header-gradient-start': colors.headerGradientStart,
            '--color-header-gradient-end': colors.headerGradientEnd,
        };
    };

    // Helper for backwards compatibility
    const getThemeColors = () => {
        const colors = currentThemeColors.value;
        return {
            background: colors.background,
            surface: colors.surface,
            surfaceVariant: colors.cardBackground,
            onBackground: colors.textPrimary,
            onSurface: colors.textPrimary,
            onSurfaceVariant: colors.textSecondary,
            divider: colors.border,
        };
    };

    // Single theme -- availableThemes is just ["brand"]
    const availableThemes = ['brand'] as NewsTheme[];

    // No-op: theme is fixed
    const refreshThemeFromStorage = () => {};

    return {
        newsTheme,
        isDarkMode,
        toggleTheme,
        setTheme,
        getThemeColor,
        currentThemeColors,
        getCssVariables,
        getThemeColors,
        availableThemes,
        refreshThemeFromStorage,
    };
};
