import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { getDbConnection, getAllCourses, getScheduleSlots, saveScheduleSlot, deleteScheduleSlot, saveCourse } from '../services/database';
import { COLORS, GLOBAL_STYLES } from '../components/Theme';
import { Plus, MapPin, User, Clock, Trash2, X } from 'lucide-react-native';

const DAYS = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

export default function ScheduleScreen() {
  const isFocused = useIsFocused();
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState('الأحد');
  const [slots, setSlots] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);

  // Form Fields
  const [courseName, setCourseName] = useState('');
  const [startTime, setStartTime] = useState('');
  const [room, setRoom] = useState('');
  const [instructor, setInstructor] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');

  useEffect(() => {
    if (isFocused) {
      loadData();
    }
  }, [isFocused, selectedDay]);

  const loadData = async () => {
    try {
      setLoading(true);
      const activeCourses = await getAllCourses() as any[];
      setCourses(activeCourses || []);

      const activeSlots = await getScheduleSlots() as any[];
      const filtered = activeSlots.filter(s => s.day_of_week === selectedDay);
      
      // Resolve course name and color
      const resolved = filtered.map(slot => {
        const course = activeCourses.find(c => c.id === slot.course_id);
        return {
          ...slot,
          course_name: course ? course.name : 'مادة دراسية',
          course_color: course ? course.color : '#6d28d9'
        };
      });

      setSlots(resolved);
      setLoading(false);
    } catch (e) {
      console.warn('Schedule load error:', e);
      setLoading(false);
    }
  };

  const handleAddSlot = async () => {
    if (!startTime) {
      Alert.alert('خطأ', 'يرجى إدخال وقت المحاضرة (مثال: 09:00 ص)');
      return;
    }

    try {
      let finalCourseId = selectedCourseId;

      // If they chose to create a new course
      if (!finalCourseId && courseName) {
        const newCourseId = 'course-' + Math.random().toString(36).substring(2, 9);
        const randomColors = ['#7c3aed', '#10b981', '#f59e0b', '#3b82f6', '#ec4899', '#14b8a6'];
        const randomColor = randomColors[Math.floor(Math.random() * randomColors.length)];
        
        await saveCourse({
          id: newCourseId,
          name: courseName,
          color: randomColor
        });
        finalCourseId = newCourseId;
      } else if (!finalCourseId && !courseName) {
        Alert.alert('خطأ', 'يرجى اختيار مادة دراسية أو إدخال اسم مادة جديدة.');
        return;
      }

      const slotId = 'slot-' + Math.random().toString(36).substring(2, 9);
      await saveScheduleSlot({
        id: slotId,
        course_id: finalCourseId,
        day_of_week: selectedDay,
        start_time: startTime,
        room: room,
        instructor: instructor
      });

      setModalVisible(false);
      // Reset form
      setCourseName('');
      setStartTime('');
      setRoom('');
      setInstructor('');
      setSelectedCourseId('');

      loadData();
      Alert.alert('نجاح', 'تمت إضافة المحاضرة للجدول بنجاح!');
    } catch (e) {
      Alert.alert('خطأ', 'فشل إضافة المحاضرة للجدول.');
    }
  };

  const handleDeleteSlot = (id: string) => {
    Alert.alert(
      'تأكيد الحذف',
      'هل أنت متأكد من رغبتك في حذف هذه المحاضرة من الجدول؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        { 
          text: 'حذف', 
          style: 'destructive',
          onPress: async () => {
            await deleteScheduleSlot(id);
            loadData();
          }
        }
      ]
    );
  };

  return (
    <View style={GLOBAL_STYLES.container}>
      {/* Horizontal Day Tab Selector */}
      <View style={styles.daysScrollContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.daysScroll}>
          {DAYS.map((day) => {
            const isActive = selectedDay === day;
            return (
              <TouchableOpacity
                key={day}
                style={[styles.dayTab, isActive && styles.dayTabActive]}
                onPress={() => setSelectedDay(day)}
              >
                <Text style={[styles.dayTabText, isActive && styles.dayTabActiveText]}>{day}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Main List of slots */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : slots.length === 0 ? (
        <View style={styles.center}>
          <Clock size={40} color={COLORS.textMuted} style={styles.emptyIcon} />
          <Text style={styles.emptyText}>لا توجد محاضرات في جدول يوم {selectedDay}.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent}>
          {slots.map((item) => (
            <View key={item.id} style={GLOBAL_STYLES.glassCard}>
              <View style={styles.cardHeader}>
                <TouchableOpacity onPress={() => handleDeleteSlot(item.id)}>
                  <Trash2 size={18} color={COLORS.danger} />
                </TouchableOpacity>
                <View style={styles.cardInfoCol}>
                  <Text style={styles.className}>{item.course_name}</Text>
                  <View style={[styles.colorBadge, { backgroundColor: item.course_color }]} />
                </View>
              </View>

              <View style={styles.detailsRow}>
                <View style={styles.detailCol}>
                  <Text style={styles.detailVal}>{item.instructor || '--'}</Text>
                  <User size={13} color={COLORS.textSecondary} style={styles.detailIcon} />
                </View>

                <View style={styles.detailCol}>
                  <Text style={styles.detailVal}>{item.room || '--'}</Text>
                  <MapPin size={13} color={COLORS.textSecondary} style={styles.detailIcon} />
                </View>

                <View style={styles.detailCol}>
                  <Text style={styles.detailVal}>{item.start_time}</Text>
                  <Clock size={13} color={COLORS.primary} style={styles.detailIcon} />
                </View>
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Bottom Floating Action Button to Add */}
      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Plus size={24} color={COLORS.textPrimary} />
      </TouchableOpacity>

      {/* Adding Lecture Sheet Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalBg}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <X size={20} color={COLORS.textSecondary} />
              </TouchableOpacity>
              <Text style={GLOBAL_STYLES.titleMedium}>إضافة محاضرة جديدة للجدول</Text>
            </View>

            <ScrollView contentContainerStyle={styles.modalScroll}>
              {/* Day selection summary */}
              <Text style={styles.selectedDayHint}>سيتم إضافة المحاضرة ليوم: {selectedDay}</Text>

              {/* Course picker dropdown emulation */}
              <Text style={styles.inputLabel}>اختر مادة دراسية نشطة</Text>
              <View style={styles.coursesSelector}>
                {courses.map(c => {
                  const isSelected = selectedCourseId === c.id;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.courseChip, isSelected && styles.courseChipActive, { borderColor: c.color }]}
                      onPress={() => {
                        setSelectedCourseId(c.id);
                        setCourseName('');
                      }}
                    >
                      <Text style={[styles.courseChipText, isSelected && { fontWeight: 'bold' }]}>{c.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={styles.divider}>أو قم بإنشاء مادة جديدة</Text>

              <Text style={styles.inputLabel}>اسم المادة الجديدة</Text>
              <TextInput
                style={GLOBAL_STYLES.glassInput}
                placeholder="أدخل اسم مادة جديدة"
                placeholderTextColor={COLORS.textMuted}
                value={courseName}
                onChangeText={(txt) => {
                  setCourseName(txt);
                  setSelectedCourseId('');
                }}
              />

              <Text style={styles.inputLabel}>توقيت المحاضرة</Text>
              <TextInput
                style={GLOBAL_STYLES.glassInput}
                placeholder="مثال: 09:00 ص - 10:30 ص"
                placeholderTextColor={COLORS.textMuted}
                value={startTime}
                onChangeText={setStartTime}
              />

              <Text style={styles.inputLabel}>رقم القاعة / الغرفة</Text>
              <TextInput
                style={GLOBAL_STYLES.glassInput}
                placeholder="مثال: مبنى العلوم - قاعة 3"
                placeholderTextColor={COLORS.textMuted}
                value={room}
                onChangeText={setRoom}
              />

              <Text style={styles.inputLabel}>اسم المحاضر / الدكتور</Text>
              <TextInput
                style={GLOBAL_STYLES.glassInput}
                placeholder="مثال: د. أحمد البابلي"
                placeholderTextColor={COLORS.textMuted}
                value={instructor}
                onChangeText={setInstructor}
              />

              <TouchableOpacity style={[GLOBAL_STYLES.glassButton, styles.addBtn]} onPress={handleAddSlot}>
                <Text style={GLOBAL_STYLES.buttonText}>حفظ المحاضرة في الجدول</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  daysScrollContainer: {
    backgroundColor: COLORS.surfaceGlass,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 10,
  },
  daysScroll: {
    paddingHorizontal: 8,
    flexDirection: 'row-reverse',
  },
  dayTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: 'transparent',
    marginHorizontal: 4,
  },
  dayTabActive: {
    backgroundColor: COLORS.primaryGlow,
    borderColor: COLORS.primary,
  },
  dayTabText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  dayTabActiveText: {
    color: COLORS.textPrimary,
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
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.03)',
  },
  cardInfoCol: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  colorBadge: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: 8,
  },
  className: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  detailsRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
  },
  detailCol: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  detailIcon: {
    marginLeft: 6,
  },
  detailVal: {
    color: COLORS.textSecondary,
    fontSize: 12,
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
  selectedDayHint: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: 'bold',
    textAlign: 'right',
    marginBottom: 16,
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
  divider: {
    color: COLORS.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginVertical: 14,
  },
  addBtn: {
    marginTop: 10,
  }
});
