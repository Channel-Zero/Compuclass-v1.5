import React, { useEffect, useRef } from 'react';
import {
  View, Text, Pressable, TextInput, StyleSheet, Platform, useWindowDimensions,
  Animated, ScrollView, Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { Icon } from './Icon';

export const LAPTOP = 1024;
export const TABLET = 600;

let webStylesInstalled = false;
export function installWebStyles() {
  if (Platform.OS !== 'web' || webStylesInstalled || typeof document === 'undefined') return;
  webStylesInstalled = true;
  const style = document.createElement('style');
  style.id = 'compuclass-soft-glass';
  style.textContent = `
    html, body, #root { background: #F7FBFD; min-height: 100%; }
    body { margin: 0; -webkit-font-smoothing: antialiased; }
    .cc-glass { -webkit-backdrop-filter: blur(28px) saturate(1.5); backdrop-filter: blur(28px) saturate(1.5); }
    .cc-field-blob { filter: blur(70px); }
    .cc-field-glow { filter: blur(40px); }
  `;
  document.head.appendChild(style);
}

export function useLayout() {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const laptop = width >= LAPTOP;
  const tablet = width >= TABLET && !laptop;
  return {
    width,
    laptop,
    tablet,
    phone: width < TABLET,
    horizontal: laptop ? 40 : 20,
    bottom: laptop ? 64 : 128,
    contentMax: 1200,
    insets,
  };
}

export function font(theme, role) {
  const family = {
    display: theme.fontHead,
    h1: theme.fontHead,
    h2: theme.fontHeadBold,
    h3: theme.fontHeadBold,
    body: theme.fontBody,
    medium: theme.fontBodyMedium,
    semibold: theme.fontBodySemibold,
    bold: theme.fontBodyBold,
  }[role];
  return family ? { fontFamily: family } : null;
}

export function Heading({ children, level = 1, style, accessibilityLabel }) {
  const { theme } = useTheme();
  const { laptop } = useLayout();
  const sizes = {
    display: laptop ? { fontSize: 52, lineHeight: 58 } : { fontSize: 32, lineHeight: 38 },
    1: laptop ? { fontSize: 36, lineHeight: 44 } : { fontSize: 28, lineHeight: 34 },
    2: { fontSize: 20, lineHeight: 28 },
    3: { fontSize: 16, lineHeight: 24 },
  };
  const role = level === 'display' ? 'display' : level <= 1 ? 'h1' : 'h2';
  return (
    <Text
      accessibilityRole="header"
      accessibilityLabel={accessibilityLabel}
      style={[
        { color: theme.text, letterSpacing: level === 1 || level === 'display' ? -0.4 : -0.2 },
        font(theme, role),
        sizes[level] || sizes[1],
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Body({ children, variant = 'body', color, style, numberOfLines }) {
  const { theme } = useTheme();
  const sizes = {
    body: { fontSize: 16, lineHeight: 24 },
    small: { fontSize: 14, lineHeight: 20 },
    caption: { fontSize: 13, lineHeight: 18 },
  };
  const role = variant === 'caption' ? 'medium' : 'body';
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        sizes[variant] || sizes.body,
        font(theme, role),
        { color: color || (variant === 'caption' ? 'rgba(11,27,58,0.65)' : theme.textSecondary) },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function ColourField() {
  return (
    <View pointerEvents="none" style={styles.field} accessibilityElementsHidden importantForAccessibility="no">
      <View className="cc-field-blob" style={[styles.blob, styles.blob1]} />
      <View className="cc-field-blob" style={[styles.blob, styles.blob2]} />
      <View className="cc-field-blob" style={[styles.blob, styles.blob3]} />
      <View className="cc-field-glow" style={[styles.blob, styles.blob4]} />
    </View>
  );
}

export function Glass({ children, style, radius = 24, strong = false, sidebar = false }) {
  const { theme } = useTheme();
  const fill = sidebar ? theme.glassSidebar : strong ? theme.glassPanel : theme.glassFill;
  return (
    <View
      className="cc-glass"
      style={[
        {
          backgroundColor: fill,
          borderWidth: 1,
          borderColor: theme.glassBorder,
          borderRadius: radius,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.12,
          shadowRadius: 40,
          elevation: 8,
          overflow: 'hidden',
        },
        Platform.OS === 'web' ? { backdropFilter: 'blur(28px) saturate(1.5)' } : { backgroundColor: 'rgba(255,255,255,0.94)' },
        style,
      ]}
    >
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: theme.glassTint }]} />
      <View pointerEvents="none" style={styles.glassHighlight} />
      {children}
    </View>
  );
}

export function Card({ children, style }) {
  const { theme } = useTheme();
  return (
    <View style={[{ backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: theme.radiusLg }, style]}>
      {children}
    </View>
  );
}

export function IconTile({ name, tone = 'blue', size = 44 }) {
  const { theme } = useTheme();
  const map = {
    blue: { bg: theme.tint, color: theme.primary, tone: theme.iconTone },
    teal: { bg: theme.secondary, color: theme.accentInk, tone: theme.iconTone },
    yellow: { bg: theme.yellowTint, color: theme.yellowInk, tone: theme.iconToneYellow },
    neutral: { bg: '#E8ECF4', color: theme.text, tone: 'rgba(11,27,58,0.12)' },
  };
  const c = map[tone] || map.blue;
  return (
    <View style={{ width: size, height: size, borderRadius: 12, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center' }}>
      <Icon name={name} size={size >= 44 ? 24 : 20} color={c.color} tone={c.tone} />
    </View>
  );
}

export function Badge({ label, kind = 'neutral' }) {
  const { theme } = useTheme();
  const kinds = {
    ok: { bg: theme.successWash, color: theme.successInk },
    warning: { bg: theme.warningWash, color: theme.warningInk },
    error: { bg: theme.errorWash, color: theme.errorInk },
    info: { bg: theme.tint, color: theme.primaryInk },
    neutral: { bg: '#EAF0F6', color: theme.textSecondary },
    yellow: { bg: theme.yellowTint, color: theme.yellowInk },
    yellowStrong: { bg: theme.yellow, color: theme.yellowInk },
  };
  const c = kinds[kind] || kinds.neutral;
  return (
    <View style={{ height: 24, paddingHorizontal: 10, borderRadius: 999, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' }}>
      <Text style={[{ color: c.color, fontSize: 12, lineHeight: 16 }, font(theme, 'semibold')]}>{label}</Text>
    </View>
  );
}

export function Button({ label, onPress, variant = 'primary', icon, disabled, block, fit, style, accessibilityLabel }) {
  const { theme } = useTheme();
  const { phone } = useLayout();
  const primary = variant === 'primary';
  const text = variant === 'text';
  const stretch = !fit && !text && (block || phone);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        {
          minHeight: 48,
          height: 48,
          paddingHorizontal: text ? 8 : 24,
          borderRadius: theme.radiusButton,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'row',
          gap: 8,
          alignSelf: stretch ? 'stretch' : 'flex-start',
          maxWidth: stretch ? 400 : undefined,
          width: stretch ? '100%' : undefined,
          opacity: disabled ? 0.55 : pressed ? 0.92 : 1,
          backgroundColor: primary ? theme.primary : text ? 'transparent' : theme.surface,
          borderWidth: variant === 'secondary' ? 1 : 0,
          borderColor: theme.border,
        },
        primary && {
          shadowColor: theme.primary,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.24,
          shadowRadius: 16,
          elevation: 3,
        },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={18} color={primary ? '#fff' : text ? theme.primary : theme.text} tone="transparent" /> : null}
      <Text style={[{ fontSize: 15, color: primary ? '#fff' : text ? theme.primary : theme.text }, font(theme, 'semibold')]}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({ name, label, onPress, dot, style, accessibilityState, testID }) {
  const { theme } = useTheme();
  return (
    <Pressable
      testID={testID}
      className="cc-glass"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={accessibilityState}
      aria-expanded={accessibilityState?.expanded}
      aria-selected={accessibilityState?.selected}
      style={({ pressed }) => [{
        width: 44, height: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center',
        backgroundColor: theme.glassFill, borderWidth: 1, borderColor: theme.glassBorder, opacity: pressed ? 0.85 : 1,
      }, Platform.OS === 'web' ? { backdropFilter: 'blur(28px) saturate(1.5)' } : null, style]}
    >
      <Icon name={name} size={20} color={theme.text} />
      {dot ? <View style={[styles.dot, { backgroundColor: theme.error, borderColor: '#fff' }]} /> : null}
    </Pressable>
  );
}

export function Field({ label, value, onChangeText, placeholder, secure, keyboardType, autoCapitalize, icon = 'mail', maxLength, hint, onToggleSecure, secureVisible }) {
  const { theme } = useTheme();
  const [focused, setFocused] = React.useState(false);
  const inputRef = useRef(null);
  // alignSelf: 'stretch' keeps the field full width inside an alignItems:
  // 'flex-start' parent (AuthLayout). Without it the Android TextInput sizes to
  // its text, resizes on every keystroke and drops focus, so the keyboard closes.
  // The row is pressable so a tap on the icon or padding focuses the input
  // instead of dismissing the keyboard.
  return (
    <View style={{ alignSelf: 'stretch', marginBottom: 16 }}>
      {label ? <Text style={[{ fontSize: 14, lineHeight: 20, marginBottom: 8, color: theme.text }, font(theme, 'semibold')]}>{label}</Text> : null}
      <Pressable onPress={() => inputRef.current?.focus()} accessible={false} style={{
        flexDirection: 'row', alignItems: 'center', gap: 12, height: 52, paddingHorizontal: focused ? 15 : 16,
        borderRadius: theme.radiusMd, backgroundColor: theme.surface,
        borderWidth: focused ? 2 : 1, borderColor: focused ? theme.primary : theme.inputBorder,
        ...(focused ? { shadowColor: theme.primary, shadowOpacity: 0.12, shadowRadius: 0, shadowOffset: { width: 0, height: 0 } } : null),
      }}>
        <Icon name={icon} size={20} color={focused ? theme.primary : theme.textTertiary} />
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.textTertiary}
          secureTextEntry={secure && !secureVisible}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize || 'none'}
          autoCorrect={false}
          maxLength={maxLength}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={[{ flex: 1, fontSize: 16, color: theme.text, height: 48, outlineStyle: 'none' }, font(theme, 'body')]}
        />
        {secure ? (
          <Pressable onPress={onToggleSecure} accessibilityRole="button" accessibilityLabel={secureVisible ? 'Hide password' : 'Show password'} style={styles.eyeHit}>
            <Icon name={secureVisible ? 'eyeOff' : 'eye'} size={20} color={theme.textSecondary} />
          </Pressable>
        ) : null}
      </Pressable>
      {hint ? <Text style={[{ marginTop: 8, fontSize: 12, lineHeight: 16, color: theme.textTertiary }, font(theme, 'body')]}>{hint}</Text> : null}
    </View>
  );
}

export function Segmented({ options, value, onChange }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignSelf: 'flex-start', padding: 4, borderRadius: 999, backgroundColor: '#E9F0F6', flexWrap: 'wrap' }}>
      {options.map((opt) => {
        const on = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={{ height: 44, paddingHorizontal: 16, borderRadius: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? theme.surface : 'transparent' }}
          >
            <Text style={[{ fontSize: 14, color: on ? theme.text : theme.textSecondary }, font(theme, 'semibold')]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SectionHeader({ title, action, onAction }) {
  const { theme } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 16 }}>
      <Heading level={2}>{title}</Heading>
      {action ? (
        <Pressable onPress={onAction} accessibilityRole="button" accessibilityLabel={action} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 4 }}>
          <Text style={[{ color: theme.primary, fontSize: 14 }, font(theme, 'semibold')]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Page({ children, scroll = true, style, refreshControl, maxWidth, fill = false }) {
  const { horizontal, bottom, contentMax } = useLayout();
  const content = (
    <View style={{ width: '100%', maxWidth: maxWidth || contentMax, alignSelf: 'center', paddingHorizontal: horizontal, paddingBottom: bottom, paddingTop: 8, flex: fill ? 1 : undefined }}>
      {children}
    </View>
  );
  if (!scroll) return <View style={[{ flex: 1, backgroundColor: 'transparent' }, style]}>{content}</View>;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: 'transparent' }} contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" refreshControl={refreshControl}>
      {content}
    </ScrollView>
  );
}

export function Skeleton({ width = '100%', height = 14, radius = 8, style }) {
  const { theme } = useTheme();
  const shimmer = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(shimmer, { toValue: 0.9, duration: 800, useNativeDriver: true }),
      Animated.timing(shimmer, { toValue: 0.45, duration: 800, useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [shimmer]);
  return <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: theme.border, opacity: shimmer }, style]} />;
}

export function LoadingPanel({ title, detail }) {
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: theme.background }}>
      <View style={{ width: 72, height: 72, borderRadius: 24, backgroundColor: theme.tint, alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        <Icon name="windows" size={32} color={theme.primary} />
      </View>
      <View style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 3, borderColor: theme.tint, borderTopColor: theme.primary, marginBottom: 16 }} />
      <Heading level={3} style={{ textAlign: 'center', marginBottom: 8 }}>{title}</Heading>
      {detail ? <Body variant="small" style={{ textAlign: 'center', maxWidth: 320 }}>{detail}</Body> : null}
    </View>
  );
}

export function Logo({ size = 72 }) {
  const { Image } = require('react-native');
  return (
    <Image
      source={require('../../assets/brand/compuclass-glass.png')}
      accessibilityLabel="CompuClass"
      style={{ width: size, height: size, resizeMode: 'contain' }}
    />
  );
}

export function Mark({ size = 44 }) {
  const { Image } = require('react-native');
  return (
    <Image
      source={require('../../assets/brand/compuclass-glass-mark.png')}
      accessibilityIgnoresInvertColors
      style={{ width: size, height: size, resizeMode: 'contain' }}
    />
  );
}

export function Wordmark() {
  const { theme } = useTheme();
  return (
    <Text style={[{ fontSize: 20, lineHeight: 24, letterSpacing: -0.4, color: theme.text }, font(theme, 'h1')]}>
      Compu<Text style={{ color: theme.primary }}>Class</Text>
    </Text>
  );
}

export function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ label, size = 40, tone = 'blue', image }) {
  const { theme } = useTheme();
  const { Image } = require('react-native');
  const bg = tone === 'teal' ? theme.secondary : tone === 'neutral' ? '#E4E9F2' : theme.tint;
  const color = tone === 'teal' ? theme.accentInk : tone === 'neutral' ? theme.text : theme.primaryInk;
  if (image) {
    return <Image source={{ uri: image }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={[{ color, fontSize: size * 0.36 }, font(theme, 'h2')]}>{label || '?'}</Text>
    </View>
  );
}

export function Sheet({ visible, onClose, title, children }) {
  const { theme } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose} accessibilityLabel="Close">
        <Pressable onPress={() => {}} style={{ width: '100%', maxWidth: 480 }}>
          <Glass radius={theme.radiusSheet} strong style={{ padding: 24, backgroundColor: theme.surface }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <Heading level={2}>{title}</Heading>
              <IconButton name="close" label="Close" onPress={onClose} />
            </View>
            {children}
          </Glass>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function Toggle({ value, onValueChange, label }) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={() => onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      style={{ width: 51, height: 31, borderRadius: 16, backgroundColor: value ? theme.success : '#C9D6E3', justifyContent: 'center' }}
    >
      <View style={{ width: 27, height: 27, borderRadius: 14, backgroundColor: '#fff', marginLeft: value ? 22 : 2, shadowColor: '#0B1B3A', shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } }} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  field: { ...StyleSheet.absoluteFillObject, overflow: 'hidden', zIndex: 0 },
  blob: { position: 'absolute', borderRadius: 999 },
  blob1: { width: 520, height: 520, right: -140, top: -120, backgroundColor: 'rgba(10,102,255,0.20)' },
  blob2: { width: 460, height: 460, left: -160, top: '34%', backgroundColor: 'rgba(59,184,196,0.24)' },
  blob3: { width: 520, height: 520, right: -100, bottom: -200, backgroundColor: 'rgba(10,102,255,0.14)' },
  blob4: { width: 380, height: 380, left: -120, bottom: '12%', backgroundColor: 'rgba(255,230,128,0.55)' },
  glassHighlight: { position: 'absolute', top: 0, left: 0, right: 0, height: 1, backgroundColor: 'rgba(255,255,255,0.9)' },
  dot: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4, borderWidth: 2 },
  eyeHit: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: -10 },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(11,27,58,0.45)', alignItems: 'center', justifyContent: 'center', padding: 20 },
});
