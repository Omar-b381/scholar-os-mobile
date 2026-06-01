import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Switch,
  ActivityIndicator,
  Alert
} from 'react-native';
import { getSyncSettings, setSyncSettings, getDbConnection, getAllLevels, getActiveLevel, archiveAndTransition } from '../services/database';
import { runSyncCycle, testSupabaseConnection, registerSyncStatusListener } from '../services/syncService';
import { COLORS, GLOBAL_STYLES } from '../components/Theme';
import { Shield, Cloud, RefreshCw, AlertCircle, WifiOff, FileText, CheckCircle, Award } from 'lucide-react-native';

export default function SyncScreen() {
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [settings, setSettings] = useState<any>({
    autoSync: true,
    paused: false,
    deviceId: 'student-phone',
    encryptionKey: 'scholar-default-passkey',
    offlineSimulated: false,
    lastSyncTimestamp: '1970-01-01T00:00:00.000Z',
    supabaseUrl: '',
    supabaseAnonKey: ''
  });
  const [logs, setLogs] = useState<any[]>([]);
  const [syncStatus, setSyncStatus] = useState('idle');
  const [syncMsg, setSyncMsg] = useState('');
  
  const [levels, setLevels] = useState<any[]>([]);
  const [activeLevel, setActiveLevel] = useState<any>(null);
  const [newLevelName, setNewLevelName] = useState('');
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    loadSettings();
    loadSyncLogs();
    loadLevelsData();

    // Subscribe to real-time SyncGuard updates
    const unsubscribe = registerSyncStatusListener((event, data) => {
      if (event === 'sync:running') {
        setSyncStatus('running');
        setSyncMsg('جارِ المزامنة مع سحابة Supabase...');
      } else if (event === 'sync:offline') {
        setSyncStatus('offline');
        setSyncMsg('غير متصل (تم تفعيل وضع محاكاة عدم الاتصال)');
      } else if (event === 'sync:success') {
        setSyncStatus('success');
        setSyncMsg(`تمت المزامنة بنجاح! تم رفع ${data?.pushed || 0} وتنزيل ${data?.pulled || 0}.`);
        loadSettings();
        loadSyncLogs();
      } else if (event === 'sync:error') {
        setSyncStatus('error');
        setSyncMsg(`فشلت المزامنة: ${data || 'خطأ غير معروف'}`);
        loadSyncLogs();
      } else if (event === 'sync:idle') {
        setSyncStatus('idle');
        setSyncMsg('البيانات متزامنة بالكامل محلياً وفي السحاب.');
      } else if (event === 'sync:log_added') {
        loadSyncLogs();
      }
    });

    return unsubscribe;
  }, []);

  const loadSettings = async () => {
    const s = await getSyncSettings();
    setSettings(s);
  };

  const loadSyncLogs = async () => {
    try {
      const db = getDbConnection();
      const rows = await db.getAllAsync(`
        SELECT * FROM sync_logs ORDER BY timestamp DESC LIMIT 10
      `) as any[];
      setLogs(rows || []);
    } catch (e) {
      console.warn('Failed to load sync logs', e);
    }
  };

  const loadLevelsData = async () => {
    try {
      const all = await getAllLevels();
      setLevels(all || []);
      const active = await getActiveLevel();
      setActiveLevel(active);
    } catch (e) {
      console.warn('[SyncScreen] Failed to load levels:', e);
    }
  };

  const handleTransition = async () => {
    if (!newLevelName.trim()) {
      Alert.alert('تنبيه', 'يرجى إدخال اسم المستوى الدراسي الجديد!');
      return;
    }

    Alert.alert(
      'تأكيد الانتقال الأكاديمي',
      `تنبيه: هل أنت متأكد من الانتقال إلى المستوى الدراسي الجديد "${newLevelName}"؟\n\nسيتم أرشفة مستواك الحالي وقفل مقرراته محلياً، وتأسيس لوحة تحكم ومحاضرات جديدة نظيفة بالكامل!`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'نعم، ابدأ الانتقال',
          onPress: async () => {
            setIsTransitioning(true);
            try {
              const res = await archiveAndTransition(newLevelName.trim());
              if (res.success) {
                Alert.alert('نجاح العملية', `تهانينا! تم الترقية إلى "${newLevelName}" بنجاح وأرشفة المستوى السابق.`);
                setNewLevelName('');
                await loadLevelsData();
                // Silent sync to instantly reflect levels on desktop
                runSyncCycle();
              }
            } catch (err: any) {
              Alert.alert('فشل الانتقال', err.message || 'تعذر الترقية.');
            } finally {
              setIsTransitioning(false);
            }
          }
        }
      ]
    );
  };

  const handleSaveSettings = async (updates: Partial<typeof settings>) => {
    const updated = { ...settings, ...updates };
    setSettings(updated);
    await setSyncSettings(updates);
  };

  const handleTestConnection = async () => {
    if (!settings.supabaseUrl || !settings.supabaseAnonKey) {
      Alert.alert('تنبيه', 'يرجى إدخال رابط URL ومفتاح Anon أولاً للاختبار.');
      return;
    }
    setTesting(true);
    const result = await testSupabaseConnection(settings.supabaseUrl, settings.supabaseAnonKey);
    setTesting(false);

    if (result.success) {
      Alert.alert('نجاح الاتصال', result.error || 'تم الاتصال بنجاح بجدول المزامنة في Supabase!');
    } else {
      Alert.alert('فشل الاتصال', result.error || 'فشل الاتصال بالسحابة. تحقق من التفاصيل.');
    }
  };

  const handleManualSync = async () => {
    setLoading(true);
    const res = await runSyncCycle();
    setLoading(false);

    if (res.success) {
      Alert.alert('اكتملت المزامنة', `تمت المزامنة بنجاح.\nتم رفع ${res.pushed} سجل وتنزيل ${res.pulled} سجل.`);
    } else {
      Alert.alert('خطأ في المزامنة', res.error || 'فشلت عملية المزامنة.');
    }
  };

  return (
    <ScrollView style={GLOBAL_STYLES.container} contentContainerStyle={styles.scrollContent}>
      {/* Real-time Sync Status Card */}
      <View style={GLOBAL_STYLES.glassCard}>
        <View style={styles.statusHeader}>
          <Text style={GLOBAL_STYLES.titleMedium}>تزامن الأجهزة (SyncGuard)</Text>
          <View style={[
            styles.badge,
            syncStatus === 'running' ? styles.badgeRunning :
            syncStatus === 'success' ? styles.badgeSuccess :
            syncStatus === 'error' ? styles.badgeError :
            syncStatus === 'offline' ? styles.badgeOffline : styles.badgeIdle
          ]}>
            <Text style={styles.badgeText}>
              {syncStatus === 'running' ? 'جارِ المزامنة' :
               syncStatus === 'success' ? 'مكتملة' :
               syncStatus === 'error' ? 'خطأ' :
               syncStatus === 'offline' ? 'أوفلاين' : 'متزامن'}
            </Text>
          </View>
        </View>

        <Text style={[GLOBAL_STYLES.bodyText, styles.statusMsg]}>
          {syncMsg || 'نظام التزامن متصل ويعمل بصمت في الخلفية.'}
        </Text>

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>آخر تزامن ناجح:</Text>
          <Text style={styles.metaVal}>{settings.lastSyncTimestamp.slice(0, 16).replace('T', ' ')}</Text>
        </View>

        <TouchableOpacity 
          style={[GLOBAL_STYLES.glassButton, styles.syncBtn]} 
          onPress={handleManualSync}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={COLORS.textPrimary} />
          ) : (
            <View style={styles.btnRow}>
              <RefreshCw size={18} color={COLORS.textPrimary} style={styles.btnIcon} />
              <Text style={GLOBAL_STYLES.buttonText}>مزامنة الآن</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Cloud Configuration Forms */}
      <View style={GLOBAL_STYLES.glassCard}>
        <View style={styles.cardTitleRow}>
          <Cloud size={20} color={COLORS.primary} style={styles.titleIcon} />
          <Text style={GLOBAL_STYLES.titleMedium}>إعدادات سحابة Supabase</Text>
        </View>
        
        <Text style={styles.inputLabel}>رابط السحابة (Supabase URL)</Text>
        <TextInput
          style={GLOBAL_STYLES.glassInput}
          placeholder="https://yourproject.supabase.co"
          placeholderTextColor={COLORS.textMuted}
          value={settings.supabaseUrl}
          onChangeText={(txt) => handleSaveSettings({ supabaseUrl: txt })}
          autoCapitalize="none"
          keyboardType="url"
        />

        <Text style={styles.inputLabel}>مفتاح السحابة (Supabase Anon Key)</Text>
        <TextInput
          style={GLOBAL_STYLES.glassInput}
          placeholder="eyJhbGciOi..."
          placeholderTextColor={COLORS.textMuted}
          value={settings.supabaseAnonKey}
          onChangeText={(txt) => handleSaveSettings({ supabaseAnonKey: txt })}
          secureTextEntry
          autoCapitalize="none"
        />

        <TouchableOpacity 
          style={[GLOBAL_STYLES.glassButton, styles.testBtn]} 
          onPress={handleTestConnection}
          disabled={testing}
        >
          {testing ? (
            <ActivityIndicator color={COLORS.textPrimary} />
          ) : (
            <Text style={GLOBAL_STYLES.buttonText}>تحقق من الاتصال بالسحابة</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Academic Levels & Transition Wizard */}
      <View style={GLOBAL_STYLES.glassCard}>
        <View style={styles.cardTitleRow}>
          <Award size={20} color={COLORS.primary} style={styles.titleIcon} />
          <Text style={GLOBAL_STYLES.titleMedium}>السنوات والمستويات الدراسية والأرشيف</Text>
        </View>
        <Text style={GLOBAL_STYLES.bodyText}>
          تسمح لك أرشفة الفصول والمستويات الدراسية بالانتقال إلى فصول جديدة بلوحات تحكم وجداول محاضرات ومهام نظيفة بالكامل، مع الإبقاء على درجاتك السابقة وحساب معدلك التراكمي العام (Cumulative GPA) بشكل متصل وتلقائي.
        </Text>

        <View style={styles.levelsList}>
          {levels.map((lvl) => (
            <View 
              key={lvl.id} 
              style={[
                styles.levelItem, 
                lvl.status === 'active' ? styles.levelItemActive : styles.levelItemArchived
              ]}
            >
              <View style={[
                styles.miniBadge, 
                lvl.status === 'active' ? styles.miniBadgeActive : styles.miniBadgeArchived
              ]}>
                <Text style={styles.miniBadgeText}>
                  {lvl.status === 'active' ? 'نشط حالياً' : 'مؤرشف ومغلق'}
                </Text>
              </View>
              <Text style={styles.levelNameText}>{lvl.name}</Text>
            </View>
          ))}
        </View>

        <View style={styles.divider} />

        <Text style={styles.inputLabel}>ترقية وانتقال للمستوى الأكاديمي التالي</Text>
        <TextInput
          style={GLOBAL_STYLES.glassInput}
          placeholder="مثال: الفرقة الثانية، المستوى الثاني..."
          placeholderTextColor={COLORS.textMuted}
          value={newLevelName}
          onChangeText={setNewLevelName}
          editable={!isTransitioning}
        />

        <TouchableOpacity 
          style={[GLOBAL_STYLES.glassButton, { marginTop: 4 }]} 
          onPress={handleTransition}
          disabled={isTransitioning || !newLevelName.trim()}
        >
          {isTransitioning ? (
            <ActivityIndicator color={COLORS.textPrimary} />
          ) : (
            <Text style={GLOBAL_STYLES.buttonText}>الانتقال للمستوى الدراسي التالي</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Privacy Encryption */}
      <View style={GLOBAL_STYLES.glassCard}>
        <View style={styles.cardTitleRow}>
          <Shield size={20} color={COLORS.success} style={styles.titleIcon} />
          <Text style={GLOBAL_STYLES.titleMedium}>تشفير الخصوصية والأمان</Text>
        </View>
        <Text style={GLOBAL_STYLES.bodyText}>
          يتم تشفير جميع سجلات المواد، الجداول، المهام، والدرجات محلياً بالكامل (AES-256) قبل مغادرة جهازك. لا تملك السحابة أو أي جهة أخرى القدرة على فك تشفير بياناتك.
        </Text>

        <Text style={[styles.inputLabel, { marginTop: 14 }]}>مفتاح فك تشفير البيانات (Passphrase Key)</Text>
        <TextInput
          style={GLOBAL_STYLES.glassInput}
          placeholder="أدخل رمز العبور الخاص بك"
          placeholderTextColor={COLORS.textMuted}
          value={settings.encryptionKey}
          onChangeText={(txt) => handleSaveSettings({ encryptionKey: txt })}
          secureTextEntry
          autoCapitalize="none"
        />
        <Text style={styles.hint}>
          ⚠️ هام: يجب استخدام نفس مفتاح التشفير هذا على حاسوبك الشخصي وهاتفك المحمول لضمان إمكانية قراءة ومزامنة البيانات بنجاح!
        </Text>
      </View>

      {/* Sandbox & Simulator Switches */}
      <View style={GLOBAL_STYLES.glassCard}>
        <View style={styles.cardTitleRow}>
          <WifiOff size={20} color={COLORS.warning} style={styles.titleIcon} />
          <Text style={GLOBAL_STYLES.titleMedium}>صندوق محاكاة المطور</Text>
        </View>

        <View style={styles.switchRow}>
          <Switch
            value={settings.offlineSimulated}
            onValueChange={(val) => handleSaveSettings({ offlineSimulated: val })}
            trackColor={{ false: '#3f3f46', true: COLORS.warning }}
            thumbColor={COLORS.textPrimary}
          />
          <View style={styles.switchTextCol}>
            <Text style={styles.switchTitle}>محاكاة عدم الاتصال (Offline Mode)</Text>
            <Text style={styles.switchDesc}>عند تفعيله، سيتم حظر المزامنة السحابية وتجميع التعديلات في قائمة الانتظار محلياً.</Text>
          </View>
        </View>
      </View>

      {/* Recent Sync Audit Logs */}
      <View style={GLOBAL_STYLES.glassCard}>
        <View style={styles.cardTitleRow}>
          <FileText size={20} color={COLORS.textSecondary} style={styles.titleIcon} />
          <Text style={GLOBAL_STYLES.titleMedium}>سجل المزامنة الأخير</Text>
        </View>

        {logs.length === 0 ? (
          <Text style={styles.emptyLogs}>لا توجد سجلات مزامنة مسجلة حتى الآن.</Text>
        ) : (
          logs.map((log) => (
            <View key={log.id} style={styles.logItem}>
              <View style={styles.logHeader}>
                <Text style={styles.logTime}>{log.timestamp.slice(11, 19)}</Text>
                <View style={styles.logStatusCol}>
                  <Text style={[styles.logStatus, log.status === 'success' ? styles.logSuccess : styles.logError]}>
                    {log.status === 'success' ? 'مزامنة ناجحة' : 'خطأ'}
                  </Text>
                </View>
              </View>
              {log.status === 'success' ? (
                <Text style={styles.logDetail}>
                  رفع: {log.records_pushed} | تنزيل: {log.records_pulled} | تعارض محلول: {log.conflicts_resolved} | مدة العملية: {log.duration_ms}ms
                </Text>
              ) : (
                <Text style={[styles.logDetail, { color: COLORS.danger }]}>
                  {log.error || 'خطأ غير معروف في الشبكة'}
                </Text>
              )}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  statusHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: 'bold',
  },
  badgeRunning: { backgroundColor: COLORS.primary },
  badgeSuccess: { backgroundColor: COLORS.success },
  badgeError: { backgroundColor: COLORS.danger },
  badgeOffline: { backgroundColor: COLORS.warning },
  badgeIdle: { backgroundColor: COLORS.textMuted },
  statusMsg: {
    marginBottom: 16,
    fontSize: 13,
  },
  metaRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  metaLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  metaVal: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: 'bold',
  },
  syncBtn: {
    marginTop: 4,
  },
  btnRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  btnIcon: {
    marginLeft: 8,
  },
  cardTitleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleIcon: {
    marginLeft: 8,
  },
  inputLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginBottom: 6,
    textAlign: 'right',
  },
  testBtn: {
    backgroundColor: 'rgba(124, 58, 237, 0.08)',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  hint: {
    color: COLORS.warning,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'right',
    marginTop: 8,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  switchTextCol: {
    flex: 1,
    marginRight: 16,
  },
  switchTitle: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'right',
    marginBottom: 2,
  },
  switchDesc: {
    color: COLORS.textSecondary,
    fontSize: 11,
    textAlign: 'right',
    lineHeight: 16,
  },
  emptyLogs: {
    color: COLORS.textMuted,
    textAlign: 'center',
    fontSize: 13,
    paddingVertical: 20,
  },
  logItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  logHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  logTime: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  logStatusCol: {
    flexDirection: 'row-reverse',
  },
  logStatus: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  logSuccess: { color: COLORS.success },
  logError: { color: COLORS.danger },
  logDetail: {
    color: COLORS.textSecondary,
    fontSize: 11,
    textAlign: 'right',
  },
  levelsList: {
    marginTop: 14,
    gap: 8,
  },
  levelItem: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  levelItemActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.03)',
    borderColor: 'rgba(16, 185, 129, 0.15)',
  },
  levelItemArchived: {
    backgroundColor: 'rgba(255, 255, 255, 0.01)',
    borderColor: 'rgba(255, 255, 255, 0.04)',
  },
  levelNameText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: 'bold',
  },
  miniBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  miniBadgeActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  miniBadgeArchived: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  miniBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    marginVertical: 16,
  }
});
