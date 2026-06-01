import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { getDbConnection, getActiveLevel } from '../../lib/database';
import { COLORS, GLOBAL_STYLES } from '../../components/Theme';
import { Calendar, CheckSquare, Award, BookOpen, Clock, Plus, RefreshCw } from 'lucide-react-native';

export default function HomeScreen() {
  const router = useRouter();
  const isFocused = useIsFocused();
  const [loading, setLoading] = useState(true);
  const [todayClasses, setTodayClasses] = useState<any[]>([]);
  const [gpa, setGpa] = useState<number>(0.0);
  const [pendingTasksCount, setPendingTasksCount] = useState<number>(0);
  const [coursesCount, setCoursesCount] = useState<number>(0);
  const [activeLevel, setActiveLevel] = useState<any>(null);

  useEffect(() => {
    if (isFocused) {
      loadDashboardData();
    }
  }, [isFocused]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const db = getDbConnection();
      
      // 0. Get Active Academic Level
      const lvl = await getActiveLevel();
      setActiveLevel(lvl);
      const activeLvlId = lvl ? lvl.id : 'level-default';

      // 1. Get GPA
      const grades = await db.getAllAsync('SELECT * FROM grades WHERE is_deleted = 0') as any[];
      if (grades.length > 0) {
        let totalPoints = 0;
        let totalHours = 0;
        for (const g of grades) {
          if (g.grade_value !== null && g.credit_hours !== null) {
            totalPoints += g.grade_value * g.credit_hours;
            totalHours += g.credit_hours;
          }
        }
        setGpa(totalHours > 0 ? Number((totalPoints / totalHours / 25).toFixed(2)) : 0.0); // assuming percent to 4.0 scale
      } else {
        setGpa(0.0);
      }

      // 2. Get Active Courses Count
      const courses = await db.getAllAsync('SELECT * FROM courses WHERE is_deleted = 0 AND (academic_level_id = ? OR academic_level_id IS NULL)', [activeLvlId]) as any[];
      setCoursesCount(courses.length);

      // 3. Get Active Pending Tasks
      const tasks = await db.getAllAsync(`
        SELECT COUNT(*) as count FROM tasks t
        LEFT JOIN courses c ON t.course_id = c.id
        WHERE t.status = 'pending' 
          AND t.is_deleted = 0 
          AND (c.is_deleted = 0 OR t.course_id IS NULL)
          AND (c.academic_level_id = ? OR c.academic_level_id IS NULL)
      `, [activeLvlId]) as any[];
      setPendingTasksCount(tasks[0]?.count || 0);

      // 4. Get Today's Active Classes
      const daysArabic = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
      const currentDay = daysArabic[new Date().getDay()];
      
      const slots = await db.getAllAsync(`
        SELECT s.*, c.name as course_name, c.color as course_color
        FROM schedule_slots s
        JOIN courses c ON s.course_id = c.id
        WHERE s.day_of_week = ? 
          AND s.is_deleted = 0 
          AND c.is_deleted = 0
          AND (c.academic_level_id = ? OR c.academic_level_id IS NULL)
        ORDER BY s.start_time ASC
      `, [currentDay, activeLvlId]) as any[];

      setTodayClasses(slots || []);
      setLoading(false);
    } catch (e) {
      console.warn('Dashboard loading error:', e);
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>برجاء الانتظار، جارِ تحميل لوحة التحكم الأكاديمية...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={GLOBAL_STYLES.container} contentContainerStyle={styles.scrollContent}>
      {/* Visual Welcoming Greeting */}
      <View style={styles.welcomeContainer}>
        <Text style={styles.welcomeText}>أهلاً بك في ScholarOS 🎓</Text>
        <Text style={styles.subtext}>ثابر، فالنجاح الأكاديمي يبدأ بخطوات منظمة اليوم!</Text>
        
        {activeLevel && (
          <View style={styles.levelBadgeContainer}>
            <Award size={13} color={COLORS.primary} style={{ marginLeft: 6 }} />
            <Text style={styles.levelBadgeText}>المستوى الدراسي الحالي: {activeLevel.name}</Text>
          </View>
        )}
      </View>

      {/* Grid Quick Dashboard Cards */}
      <View style={styles.gridContainer}>
        {/* GPA tracker */}
        <TouchableOpacity style={[GLOBAL_STYLES.glassCard, styles.gridCard]} onPress={() => router.push('/grades')}>
          <Award size={24} color={COLORS.success} style={styles.cardIcon} />
          <Text style={styles.gridVal}>{gpa > 0 ? gpa.toFixed(2) : '--'}</Text>
          <Text style={styles.gridLabel}>المعدل التراكمي</Text>
        </TouchableOpacity>

        {/* Pending tasks */}
        <TouchableOpacity style={[GLOBAL_STYLES.glassCard, styles.gridCard]} onPress={() => router.push('/tasks')}>
          <CheckSquare size={24} color={COLORS.primary} style={styles.cardIcon} />
          <Text style={styles.gridVal}>{pendingTasksCount}</Text>
          <Text style={styles.gridLabel}>مهام أكاديمية معلقة</Text>
        </TouchableOpacity>

        {/* Courses enrolled */}
        <TouchableOpacity style={[GLOBAL_STYLES.glassCard, styles.gridCard]} onPress={() => router.push('/schedule')}>
          <BookOpen size={24} color={COLORS.warning} style={styles.cardIcon} />
          <Text style={styles.gridVal}>{coursesCount}</Text>
          <Text style={styles.gridLabel}>المواد الدراسية</Text>
        </TouchableOpacity>
      </View>

      {/* Today's Schedule timelist */}
      <View style={GLOBAL_STYLES.glassCard}>
        <View style={styles.sectionHeader}>
          <Calendar size={18} color={COLORS.primary} style={styles.sectionIcon} />
          <Text style={GLOBAL_STYLES.titleMedium}>جدول محاضرات اليوم</Text>
        </View>

        {todayClasses.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Clock size={36} color={COLORS.textMuted} style={styles.emptyIcon} />
            <Text style={styles.emptyText}>لا توجد محاضرات مقررة لليوم! استمتع بوقتك أو بادر بمذاكرة إضافية.</Text>
          </View>
        ) : (
          todayClasses.map((item) => (
            <View key={item.id} style={styles.classItem}>
              <View style={[styles.colorIndicator, { backgroundColor: item.course_color }]} />
              <View style={styles.classTextCol}>
                <Text style={styles.className}>{item.course_name}</Text>
                <Text style={styles.classDetails}>
                  القاعة: {item.room || 'غير محددة'} | المحاضر: {item.instructor || 'غير محدد'}
                </Text>
              </View>
              <View style={styles.timeCol}>
                <Text style={styles.timeText}>{item.start_time}</Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Motivations & Quick Actions */}
      <View style={GLOBAL_STYLES.glassCard}>
        <Text style={[GLOBAL_STYLES.titleMedium, { marginBottom: 12 }]}>إجراءات سريعة</Text>
        <View style={styles.actionsRow}>
          <TouchableOpacity 
            style={styles.actionBtn} 
            onPress={() => router.push('/schedule')}
          >
            <View style={[styles.actionIconBg, { backgroundColor: COLORS.primaryGlow }]}>
              <Plus size={20} color={COLORS.primary} />
            </View>
            <Text style={styles.actionText}>أضف محاضرة</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionBtn} 
            onPress={() => router.push('/tasks')}
          >
            <View style={[styles.actionIconBg, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
              <Plus size={20} color={COLORS.success} />
            </View>
            <Text style={styles.actionText}>أضف مهمة</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.actionBtn} 
            onPress={() => router.push('/sync')}
          >
            <View style={[styles.actionIconBg, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
              <RefreshCw size={18} color={COLORS.warning} />
            </View>
            <Text style={styles.actionText}>إعداد المزامنة</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
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
  welcomeContainer: {
    marginVertical: 14,
    alignItems: 'flex-end',
  },
  welcomeText: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.textPrimary,
  },
  subtext: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'right',
    marginTop: 4,
  },
  gridContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  gridCard: {
    flex: 1,
    marginHorizontal: 4,
    alignItems: 'center',
    paddingVertical: 18,
  },
  cardIcon: {
    marginBottom: 8,
  },
  gridVal: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  gridLabel: {
    fontSize: 11,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  sectionHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionIcon: {
    marginLeft: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyIcon: {
    marginBottom: 12,
  },
  emptyText: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  classItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.03)',
  },
  colorIndicator: {
    width: 4,
    height: 36,
    borderRadius: 2,
    marginLeft: 12,
  },
  classTextCol: {
    flex: 1,
    alignItems: 'flex-end',
  },
  className: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  classDetails: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  timeCol: {
    justifyContent: 'center',
    paddingRight: 8,
  },
  timeText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: 'bold',
  },
  actionsRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-around',
    paddingVertical: 8,
  },
  actionBtn: {
    alignItems: 'center',
  },
  actionIconBg: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: 'bold',
  },
  levelBadgeContainer: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: COLORS.primaryGlow,
    alignSelf: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(124, 58, 237, 0.15)',
  },
  levelBadgeText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: 'bold',
  }
});
