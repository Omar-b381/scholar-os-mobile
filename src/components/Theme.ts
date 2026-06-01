import { StyleSheet, Dimensions } from 'react-native';

export const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Custom harmonious HSL-tailored Color Palette
export const COLORS = {
  background: '#09090e',
  surface: '#12121c',
  surfaceGlass: 'rgba(18, 18, 28, 0.85)',
  surfaceGlassLess: 'rgba(28, 28, 44, 0.95)',
  border: 'rgba(255, 255, 255, 0.08)',
  borderActive: 'rgba(124, 58, 237, 0.4)',
  primary: '#7c3aed',      // Vibrant academic purple
  primaryGlow: 'rgba(124, 58, 237, 0.15)',
  success: '#10b981',      // Emerald green
  warning: '#f59e0b',      // Amber yellow
  danger: '#ef4444',       // Soft crimson red
  textPrimary: '#ffffff',
  textSecondary: '#a1a1aa',
  textMuted: '#52525b',
  cardGlow: 'rgba(255, 255, 255, 0.02)',
};

// Structural Design Styles (Premium Glassmorphism & Layouts)
export const GLOBAL_STYLES = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  glassCard: {
    backgroundColor: COLORS.surfaceGlass,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
  },
  glassInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: COLORS.textPrimary,
    fontSize: 15,
    textAlign: 'right', // RTL default
    marginBottom: 16,
  },
  glassButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  buttonText: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Typography for academic RTL interface
  textRTL: {
    textAlign: 'right',
  },
  titleLarge: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
    textAlign: 'right',
  },
  titleMedium: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textPrimary,
    textAlign: 'right',
  },
  bodyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'right',
    lineHeight: 20,
  },
});
