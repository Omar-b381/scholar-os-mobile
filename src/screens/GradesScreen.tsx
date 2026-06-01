import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { getGrades, saveGrade, deleteGrade, getAllCourses, getDbConnection } from '../services/database';
import { COLORS, GLOBAL_STYLES } from '../components/Theme';
import { Plus, Award, Trash2, X, ChevronLeft, Percent, Lock } from 'lucide-react-native';

export default function GradesScreen() {
  const isFocused = useIsFocused();
  const [loading, setLoading] = useState(true);
  const [grades, setGrades] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [allCourses, setAllCourses] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);

  // GPA calculation state
  const [overallGpa, setOverallGpa] = useState(0.0);
  const [totalHours, setTotalHours] = useState(0);

  // Form Fields State
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [semester, setSemester] = useState('الفصل الأول 2026');
  const [scoreVal, setScoreVal] = useState('');
  const [creditHours, setCreditHours] = useState('3');

  useEffect(() => {
    if (isFocused) {
      loadData();
    }
  }, [isFocused]);

  const loadData = async () => {
    try {
      setLoading(true);
      const db = getDbConnection();

      const activeCourses = await getAllCourses() as any[];
      setCourses(activeCourses || []);

      const all = await db.getAllAsync('SELECT * FROM courses WHERE is_deleted = 0') as any[];
      setAllCourses(all || []);

      const activeGrades = await getGrades() as any[];
      setGrades(activeGrades || []);

      // Calculate GPA
      if (activeGrades.length > 0) {
        let totalPoints = 0;
        let hoursSum = 0;
        for (const g of activeGrades) {
          if (g.grade_value !== null && g.credit_hours !== null) {
            totalPoints += g.grade_value * g.credit_hours;
            hoursSum += g.credit_hours;
          }
        }
        setTotalHours(hoursSum);
        // Map 0-100 score percent to 4.0 GPA scale (classic university conversion)
        const percentGpa = hoursSum > 0 ? (totalPoints / hoursSum) : 0;
        // 90%+ = 4.0 | 80%+ = 3.0 | 70%+ = 2.0 | 60%+ = 1.0
        const calculated4 = Number((percentGpa / 25).toFixed(2));
        setOverallGpa(calculated4);
      } else {
        setOverallGpa(0.0);
        setTotalHours(0);
      }
      
      setLoading(false);
    } catch (e) {
      console.warn('Grades load error:', e);
      setLoading(false);
    }
  };

  const handleAddGrade = async () => {
    if (!selectedCourseId) {
      Alert.alert('خطأ', 'يرجى اختيار مادة دراسية أولاً.');
      return;
    }
    const score = parseFloat(scoreVal);
    const hours = parseInt(creditHours);

    if (isNaN(score) || score < 0 || score > 100) {
      Alert.alert('خطأ', 'يرجى إدخال درجة صالحة بين 0 و 100.');
      return;
    }
    if (isNaN(hours) || hours <= 0) {
      Alert.alert('خطأ', 'يرجى إدخال عدد ساعات معتمد صحيح.');
      return;
    }

    try {
      const gradeId = 'grade-' + Math.random().toString(36).substring(2, 9);
      await saveGrade({
        id: gradeId,
        course_id: selectedCourseId,
        semester: semester.trim(),
        grade_value: score,
        credit_hours: hours
      });

      setModalVisible(false);
      // Reset forms
      setSelectedCourseId('');
      setScoreVal('');
      setCreditHours('3');

      loadData();
      Alert.alert('نجاح', 'تم تسجيل درجة المقرر بنجاح!');
    } catch (e) {
      Alert.alert('خطأ', 'فشل حفظ درجة المقرر.');
    }
  };

  const handleDeleteGrade = (id: string) => {
    Alert.alert(
      'تأكيد الحذف',
      'هل أنت متأكد من حذف هذه الدرجة الأكاديمية؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: async () => {
            await deleteGrade(id);
            loadData();
          }
        }
      ]
    );
  };

  // Convert numeric grade percentage to Letter Grade
  const getLetterGrade = (score: number) => {
    if (score >= 95) return 'A+';
    if (score >= 90) return 'A';
    if (score >= 85) return 'B+';
    if (score >= 80) return 'B';
    if (score >= 75) return 'C+';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  };

  const getLetterColor = (letter: string) => {
    if (letter.startsWith('A')) return COLORS.success;
    if (letter.startsWith('B')) return '#3b82f6';
    if (letter.startsWith('C')) return COLORS.warning;
    return COLORS.danger;
  };

  return (
    <View style={GLOBAL_STYLES.container}>
      {/* GPA visual Dial Card */}
      <View style={[GLOBAL_STYLES.glassCard, styles.dialCard]}>
        <View style={styles.dialInner}>
          <Award size={36} color={COLORS.success} style={styles.dialIcon} />
          <Text style={styles.gpaText}>{overallGpa > 0 ? overallGpa.toFixed(2) : '0.00'}</Text>
          <Text style={styles.gpaSub}>المعدل التراكمي العام (GPA)</Text>
          <Text style={styles.hoursSub}>إجمالي الساعات المعتمدة: {totalHours}</Text>
        </View>
      </View>

      {/* Segment / List of grades */}
      <View style={styles.sectionHeader}>
        <Text style={GLOBAL_STYLES.titleMedium}>رصد درجات المقررات الأكاديمية</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : grades.length === 0 ? (
        <View style={styles.center}>
          <Percent size={36} color={COLORS.textMuted} style={styles.emptyIcon} />
          <Text style={styles.emptyText}>لم تقم بتسجيل أي درجات حتى الآن. بادر بالرصد للتنبؤ بمعدلك!</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent}>
          {grades.map(item => {
            const course = allCourses.find(c => c.id === item.course_id);
            const courseName = course ? course.name : 'مقرر دراسي';
            const courseColor = course ? course.color : '#6d28d9';
            const letter = getLetterGrade(item.grade_value);
            const isArchived = !courses.some(c => c.id === item.course_id);
            
            return (
              <View key={item.id} style={GLOBAL_STYLES.glassCard}>
                <View style={styles.gradeRow}>
                  {isArchived ? (
                    <Lock size={15} color={COLORS.textMuted} style={{ marginLeft: 6, opacity: 0.6 }} />
                  ) : (
                    <TouchableOpacity onPress={() => handleDeleteGrade(item.id)}>
                      <Trash2 size={16} color={COLORS.danger} />
                    </TouchableOpacity>
                  )}

                  <View style={styles.gradeTextCol}>
                    <Text style={styles.courseName}>{courseName}</Text>
                    <Text style={styles.semesterName}>
                      {item.semester} {isArchived && '(مؤرشف)'} | {item.credit_hours} ساعات معتمدة
                    </Text>
                  </View>

                  <View style={styles.scoreBadgeCol}>
                    <View style={[styles.letterCircle, { borderColor: getLetterColor(letter) }]}>
                      <Text style={[styles.letterText, { color: getLetterColor(letter) }]}>{letter}</Text>
                    </View>
                    <Text style={styles.scoreText}>% {item.grade_value}</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Bottom Floating Action Button to Add */}
      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Plus size={24} color={COLORS.textPrimary} />
      </TouchableOpacity>

      {/* Adding Grade Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
              <Text style={GLOBAL_STYLES.titleMedium}>رصد درجة مقرر جديدة</Text>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              <Text style={styles.inputLabel}>اختر المقرر الدراسي</Text>
              <View style={styles.coursesSelector}>
                {courses.map(c => {
                  const isSelected = selectedCourseId === c.id;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.courseChip, isSelected && styles.courseChipActive, { borderColor: c.color }]}
                      onPress={() => setSelectedCourseId(c.id)}
                    >
                      <Text style={[styles.courseChipText, isSelected && { fontWeight: 'bold' }]}>{c.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {courses.length === 0 && (
                <Text style={styles.noCoursesWarning}>⚠️ يجب إضافة مقررات في الجدول أولاً لرصد درجاتها.</Text>
              )}

              <Text style={styles.inputLabel}>الفصل الدراسي</Text>
              <TextInput
                style={GLOBAL_STYLES.glassInput}
                placeholder="مثال: الفصل الدراسي الأول 2026"
                placeholderTextColor={COLORS.textMuted}
                value={semester}
                onChangeText={setSemester}
              />

              <Text style={styles.inputLabel}>درجة المقرر الكلية (0 - 100)</Text>
              <TextInput
                style={GLOBAL_STYLES.glassInput}
                placeholder="مثال: 92.5"
                placeholderTextColor={COLORS.textMuted}
                value={scoreVal}
                onChangeText={setScoreVal}
                keyboardType="numeric"
              />

              <Text style={styles.inputLabel}>عدد الساعات المعتمدة للمقرر</Text>
              <TextInput
                style={GLOBAL_STYLES.glassInput}
                placeholder="مثال: 3"
                placeholderTextColor={COLORS.textMuted}
                value={creditHours}
                onChangeText={setCreditHours}
                keyboardType="number-pad"
              />

              <TouchableOpacity style={GLOBAL_STYLES.glassButton} onPress={handleAddGrade}>
                <Text style={GLOBAL_STYLES.buttonText}>حفظ الدرجة وحساب المعدل</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  dialCard: {
    margin: 16,
    paddingVertical: 24,
    alignItems: 'center',
  },
  dialInner: {
    alignItems: 'center',
  },
  dialIcon: {
    marginBottom: 8,
  },
  gpaText: {
    fontSize: 38,
    fontWeight: '900',
    color: COLORS.textPrimary,
  },
  gpaSub: {
    color: COLORS.success,
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 4,
  },
  hoursSub: {
    color: COLORS.textSecondary,
    fontSize: 11,
    marginTop: 2,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    marginBottom: 10,
    alignItems: 'flex-end',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyIcon: {
    marginBottom: 12,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
  },
  gradeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gradeTextCol: {
    flex: 1,
    alignItems: 'flex-end',
    marginHorizontal: 16,
  },
  courseName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 4,
  },
  semesterName: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  scoreBadgeCol: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  letterCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    backgroundColor: 'rgba(255,255,255,0.01)',
  },
  letterText: {
    fontSize: 12,
    fontWeight: '900',
  },
  scoreText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    left: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingTop: 16,
  },
  modalHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalScroll: {
    padding: 20,
    paddingBottom: 40,
  },
  inputLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginBottom: 8,
    textAlign: 'right',
  },
  coursesSelector: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  courseChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 1,
    marginHorizontal: 3,
    marginVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.01)',
  },
  courseChipActive: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  courseChipText: {
    color: COLORS.textPrimary,
    fontSize: 12,
  },
  noCoursesWarning: {
    color: COLORS.danger,
    fontSize: 12,
    textAlign: 'right',
    marginBottom: 16,
  }
});
