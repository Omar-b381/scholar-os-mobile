import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator
} from 'react-native';
import { Stack, useRouter, usePathname } from 'expo-router';
import { initDatabase } from '../lib/database';
import { startSyncTimer, stopSyncTimer, registerSyncStatusListener } from '../lib/syncService';
import { COLORS, GLOBAL_STYLES } from '../components/Theme';

export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const [dbReady, setDbReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState('idle');

  useEffect(() => {
    // 1. Boot local-first SQLite Database
    initDatabase()
      .then(() => {
        setDbReady(true);
        // 2. Start SyncGuard scheduler timer
        startSyncTimer();
      })
      .catch((err) => {
        console.error('Fatal database initialization failure:', err);
      });

    // Subscribe to SyncGuard updates to update the header badge pulsing glow
    const unsubscribe = registerSyncStatusListener((event) => {
      if (event === 'sync:running') {
        setSyncStatus('running');
      } else if (event === 'sync:offline') {
        setSyncStatus('offline');
      } else if (event === 'sync:success') {
        setSyncStatus('success');
        setTimeout(() => setSyncStatus('idle'), 3000); // return to idle after 3s
      } else if (event === 'sync:error') {
        setSyncStatus('error');
        setTimeout(() => setSyncStatus('idle'), 5000);
      } else if (event === 'sync:idle') {
        setSyncStatus('idle');
      }
    });

    return () => {
      unsubscribe();
      stopSyncTimer();
    };
  }, []);

  if (!dbReady) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor={COLORS.background} />
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>تهيئة ملفات المنصة المحلية ونظام التشفير...</Text>
      </View>
    );
  }

  // Get name of screen in Arabic for the header dynamically based on current path
  const getScreenTitle = () => {
    if (pathname === '/' || pathname === '/index') return 'لوحة التحكم الأكاديمية';
    if (pathname === '/schedule') return 'الجدول الدراسي';
    if (pathname === '/tasks') return 'المهام المعلقة';
    if (pathname === '/grades') return 'سجل الدرجات والمعدل';
    if (pathname === '/sync') return 'إعدادات المزامنة السحابية';
    return 'ScholarOS Mobile';
  };

  return (
    <SafeAreaView style={GLOBAL_STYLES.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.surfaceGlassLess} />

      {/* Shared Premium Top Header */}
      <View style={styles.header}>
        {/* SyncGuard Reactive Glowing Indicator Badge */}
        <TouchableOpacity style={styles.badgeContainer} onPress={() => router.push('/sync')}>
          <View style={[
            styles.syncIndicatorPulse,
            syncStatus === 'running' ? styles.pulsePrimary :
            syncStatus === 'success' ? styles.pulseSuccess :
            syncStatus === 'error' ? styles.pulseError :
            syncStatus === 'offline' ? styles.pulseOffline : styles.pulseIdle
          ]} />
          <Text style={styles.badgeText}>تزامن</Text>
        </TouchableOpacity>

        {/* Center Title */}
        <View style={styles.titleContainer}>
          <Text style={styles.headerTitle}>{getScreenTitle()}</Text>
          <Text style={styles.headerSub}>مساعد الطالب المتكامل</Text>
        </View>
      </View>

      {/* Navigation Slot */}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 16,
  },
  header: {
    height: 64,
    backgroundColor: COLORS.surfaceGlassLess,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  syncIndicatorPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  pulseIdle: { backgroundColor: COLORS.textMuted },
  pulsePrimary: { backgroundColor: COLORS.primary },
  pulseSuccess: { backgroundColor: COLORS.success },
  pulseError: { backgroundColor: COLORS.danger },
  pulseOffline: { backgroundColor: COLORS.warning },
  badgeText: {
    color: COLORS.textPrimary,
    fontSize: 11,
    fontWeight: 'bold',
  },
  titleContainer: {
    alignItems: 'flex-end',
  },
  headerTitle: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  headerSub: {
    color: COLORS.textSecondary,
    fontSize: 10,
    marginTop: 1,
  }
});
