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
import { initDatabase } from './src/services/database';
import { startSyncTimer, stopSyncTimer, registerSyncStatusListener } from './src/services/syncService';
import { COLORS, GLOBAL_STYLES } from './src/components/Theme';

// Import Screens
import HomeScreen from './src/screens/HomeScreen';
import ScheduleScreen from './src/screens/ScheduleScreen';
import TasksScreen from './src/screens/TasksScreen';
import GradesScreen from './src/screens/GradesScreen';
import SyncScreen from './src/screens/SyncScreen';

// Import Lucide Icons
import { Home, Calendar, CheckSquare, Award, RefreshCw } from 'lucide-react-native';

export default function App() {
  const [dbReady, setDbReady] = useState(false);
  const [activeScreen, setActiveScreen] = useState('Home');
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

  // Emulated Navigation Navigator Switch
  const renderActiveScreen = () => {
    switch (activeScreen) {
      case 'Home':
        return <HomeScreen navigation={{ navigate: (screen: string) => setActiveScreen(screen) }} />;
      case 'Schedule':
        return <ScheduleScreen />;
      case 'Tasks':
        return <TasksScreen />;
      case 'Grades':
        return <GradesScreen />;
      case 'Sync':
        return <SyncScreen />;
      default:
        return <HomeScreen navigation={{ navigate: (screen: string) => setActiveScreen(screen) }} />;
    }
  };

  // Get name of screen in Arabic for the header
  const getScreenTitle = () => {
    switch (activeScreen) {
      case 'Home': return 'لوحة التحكم الأكاديمية';
      case 'Schedule': return 'الجدول الدراسي';
      case 'Tasks': return 'المهام المعلقة';
      case 'Grades': return 'سجل الدرجات والمعدل';
      case 'Sync': return 'إعدادات المزامنة السحابية';
      default: return 'ScholarOS Mobile';
    }
  };

  return (
    <SafeAreaView style={GLOBAL_STYLES.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.surfaceGlassLess} />

      {/* Shared Premium Top Header */}
      <View style={styles.header}>
        {/* SyncGuard Reactive Glowing Indicator Badge */}
        <TouchableOpacity style={styles.badgeContainer} onPress={() => setActiveScreen('Sync')}>
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

      {/* Main Content Area */}
      <View style={styles.content}>
        {renderActiveScreen()}
      </View>

      {/* Custom Bottom Glassmorphic Navigation Bar */}
      <View style={styles.tabBar}>
        {/* 1. Dashboard Tab */}
        <TouchableOpacity
          style={[styles.tabItem, activeScreen === 'Home' && styles.tabItemActive]}
          onPress={() => setActiveScreen('Home')}
        >
          <Home size={20} color={activeScreen === 'Home' ? COLORS.primary : COLORS.textSecondary} />
          <Text style={[styles.tabLabel, activeScreen === 'Home' && styles.tabLabelActive]}>الرئيسية</Text>
        </TouchableOpacity>

        {/* 2. Timetable Tab */}
        <TouchableOpacity
          style={[styles.tabItem, activeScreen === 'Schedule' && styles.tabItemActive]}
          onPress={() => setActiveScreen('Schedule')}
        >
          <Calendar size={20} color={activeScreen === 'Schedule' ? COLORS.primary : COLORS.textSecondary} />
          <Text style={[styles.tabLabel, activeScreen === 'Schedule' && styles.tabLabelActive]}>الجدول</Text>
        </TouchableOpacity>

        {/* 3. Tasks Tab */}
        <TouchableOpacity
          style={[styles.tabItem, activeScreen === 'Tasks' && styles.tabItemActive]}
          onPress={() => setActiveScreen('Tasks')}
        >
          <CheckSquare size={20} color={activeScreen === 'Tasks' ? COLORS.primary : COLORS.textSecondary} />
          <Text style={[styles.tabLabel, activeScreen === 'Tasks' && styles.tabLabelActive]}>المهام</Text>
        </TouchableOpacity>

        {/* 4. Grades Tab */}
        <TouchableOpacity
          style={[styles.tabItem, activeScreen === 'Grades' && styles.tabItemActive]}
          onPress={() => setActiveScreen('Grades')}
        >
          <Award size={20} color={activeScreen === 'Grades' ? COLORS.primary : COLORS.textSecondary} />
          <Text style={[styles.tabLabel, activeScreen === 'Grades' && styles.tabLabelActive]}>الدرجات</Text>
        </TouchableOpacity>

        {/* 5. SyncGuard Tab */}
        <TouchableOpacity
          style={[styles.tabItem, activeScreen === 'Sync' && styles.tabItemActive]}
          onPress={() => setActiveScreen('Sync')}
        >
          <RefreshCw size={20} color={activeScreen === 'Sync' ? COLORS.primary : COLORS.textSecondary} />
          <Text style={[styles.tabLabel, activeScreen === 'Sync' && styles.tabLabelActive]}>المزامنة</Text>
        </TouchableOpacity>
      </View>
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
  },
  content: {
    flex: 1,
  },
  tabBar: {
    height: 68,
    backgroundColor: COLORS.surfaceGlassLess,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 4,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 60,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tabItemActive: {
    backgroundColor: COLORS.primaryGlow,
  },
  tabLabel: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  tabLabelActive: {
    color: COLORS.primary,
    fontWeight: 'bold',
  }
});
