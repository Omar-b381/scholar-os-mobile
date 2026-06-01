import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator
} from 'react-native';
import { useNavigation } from 'expo-router';
import { getTasks, saveTask, deleteTask, getAllCourses } from '../../lib/database';
import { COLORS, GLOBAL_STYLES } from '../../components/Theme';
import { Square, CheckSquare, Trash2, Plus, Clock, BookOpen } from 'lucide-react-native';

export default function TasksScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');
  const [tasks, setTasks] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);
  
  // Quick Add Task Form State
  const [newTitle, setNewTitle] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [newDueDate, setNewDueDate] = useState('');

  useEffect(() => {
    loadData();
    const unsubscribe = navigation.addListener('focus', () => {
      loadData();
    });
    return unsubscribe;
  }, [navigation, activeTab]);

  const loadData = async () => {
    try {
      setLoading(true);
      const activeCourses = await getAllCourses() as any[];
      setCourses(activeCourses || []);

      const activeTasks = await getTasks() as any[];
      const filtered = activeTasks.filter(t => t.status === activeTab);
      
      // Resolve course name
      const resolved = filtered.map(t => {
        const course = activeCourses.find(c => c.id === t.course_id);
        return {
          ...t,
          course_name: course ? course.name : null,
          course_color: course ? course.color : null
        };
      });

      setTasks(resolved);
      setLoading(false);
    } catch (e) {
      console.warn('Tasks load error:', e);
      setLoading(false);
    }
  };

  const handleQuickAddTask = async () => {
    if (!newTitle.trim()) {
      Alert.alert('خطأ', 'يرجى إدخال عنوان المهمة أولاً.');
      return;
    }

    try {
      const taskId = 'task-' + Math.random().toString(36).substring(2, 9);
      const formattedDate = newDueDate.trim() ? newDueDate.trim() : new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10);
      
      await saveTask({
        id: taskId,
        title: newTitle,
        course_id: selectedCourseId || null,
        due_date: formattedDate,
        status: 'pending',
        notes: ''
      });

      setNewTitle('');
      setSelectedCourseId('');
      setNewDueDate('');
      
      loadData();
    } catch (e) {
      Alert.alert('خطأ', 'فشل إضافة المهمة الأكاديمية.');
    }
  };

  const handleToggleStatus = async (task: any) => {
    try {
      const nextStatus = task.status === 'pending' ? 'completed' : 'pending';
      await saveTask({
        ...task,
        status: nextStatus
      });
      loadData();
    } catch (e) {
      Alert.alert('خطأ', 'فشل تحديث حالة المهمة.');
    }
  };

  const handleDeleteTask = (id: string) => {
    Alert.alert(
      'تأكيد الحذف',
      'هل تريد حذف هذه المهمة نهائياً؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        { 
          text: 'حذف', 
          style: 'destructive',
          onPress: async () => {
            await deleteTask(id);
            loadData();
          }
        }
      ]
    );
  };

  return (
    <View style={GLOBAL_STYLES.container}>
      {/* Quick Add Form Section */}
      <View style={styles.quickAddContainer}>
        <TextInput
          style={[GLOBAL_STYLES.glassInput, styles.quickInput]}
          placeholder="إضافة مهمة دراسية جديدة سريعة..."
          placeholderTextColor={COLORS.textMuted}
          value={newTitle}
          onChangeText={setNewTitle}
        />
        
        <View style={styles.formRow}>
          {/* Quick Date Input */}
          <TextInput
            style={[GLOBAL_STYLES.glassInput, styles.dateInput]}
            placeholder="التاريخ: YYYY-MM-DD"
            placeholderTextColor={COLORS.textMuted}
            value={newDueDate}
            onChangeText={setNewDueDate}
          />
          
          {/* Course select chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.coursesScroll}>
            <TouchableOpacity
              style={[styles.courseChip, !selectedCourseId && styles.courseChipActive]}
              onPress={() => setSelectedCourseId('')}
            >
              <Text style={styles.courseChipText}>بلا مادة</Text>
            </TouchableOpacity>
            {courses.map(c => (
              <TouchableOpacity
                key={c.id}
                style={[styles.courseChip, selectedCourseId === c.id && { backgroundColor: c.color, borderColor: c.color }]}
                onPress={() => setSelectedCourseId(c.id)}
              >
                <Text style={styles.courseChipText}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <TouchableOpacity style={GLOBAL_STYLES.glassButton} onPress={handleQuickAddTask}>
          <View style={styles.btnRow}>
            <Plus size={18} color={COLORS.textPrimary} style={styles.btnIcon} />
            <Text style={GLOBAL_STYLES.buttonText}>أضف المهمة للأجندة</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Tabs Selector Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'completed' && styles.tabActive]}
          onPress={() => setActiveTab('completed')}
        >
          <Text style={[styles.tabText, activeTab === 'completed' && styles.tabActiveText]}>المكتملة</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'pending' && styles.tabActive]}
          onPress={() => setActiveTab('pending')}
        >
          <Text style={[styles.tabText, activeTab === 'pending' && styles.tabActiveText]}>المعلقة</Text>
        </TouchableOpacity>
      </View>

      {/* Checklist view */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : tasks.length === 0 ? (
        <View style={styles.center}>
          <CheckSquare size={36} color={COLORS.textMuted} style={styles.emptyIcon} />
          <Text style={styles.emptyText}>
            {activeTab === 'pending' 
              ? 'لا توجد مهام دراسية معلقة! عمل رائع 🎉' 
              : 'لم تقم بإكمال أي مهام بعد. بادر بالعمل!'}
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent}>
          {tasks.map(item => (
            <View key={item.id} style={GLOBAL_STYLES.glassCard}>
              <View style={styles.taskRow}>
                <TouchableOpacity onPress={() => handleDeleteTask(item.id)}>
                  <Trash2 size={18} color={COLORS.danger} style={styles.trashIcon} />
                </TouchableOpacity>

                <View style={styles.taskTextCol}>
                  <Text style={[
                    styles.taskTitle,
                    activeTab === 'completed' && styles.taskTitleCompleted
                  ]}>
                    {item.title}
                  </Text>
                  
                  <View style={styles.taskMetaRow}>
                    {item.course_name && (
                      <View style={[styles.courseBadge, { backgroundColor: item.course_color + '20', borderColor: item.course_color }]}>
                        <BookOpen size={10} color={item.course_color} style={styles.metaIcon} />
                        <Text style={[styles.metaText, { color: item.course_color }]}>{item.course_name}</Text>
                      </View>
                    )}
                    
                    <View style={styles.dueBadge}>
                      <Clock size={10} color={COLORS.textSecondary} style={styles.metaIcon} />
                      <Text style={styles.metaText}>{item.due_date}</Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity onPress={() => handleToggleStatus(item)} style={styles.checkboxContainer}>
                  {item.status === 'completed' ? (
                    <CheckSquare size={22} color={COLORS.success} />
                  ) : (
                    <Square size={22} color={COLORS.textSecondary} />
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  quickAddContainer: {
    backgroundColor: COLORS.surfaceGlass,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    padding: 16,
  },
  quickInput: {
    marginBottom: 10,
  },
  formRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 10,
  },
  dateInput: {
    width: 140,
    marginBottom: 0,
    marginLeft: 10,
  },
  coursesScroll: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  courseChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.01)',
    marginHorizontal: 3,
  },
  courseChipActive: {
    borderColor: COLORS.textMuted,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  courseChipText: {
    color: COLORS.textPrimary,
    fontSize: 11,
  },
  btnRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  btnIcon: {
    marginLeft: 8,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.01)',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: COLORS.primary,
  },
  tabText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: 'bold',
  },
  tabActiveText: {
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
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  trashIcon: {
    marginRight: 8,
  },
  taskTextCol: {
    flex: 1,
    alignItems: 'flex-end',
    marginHorizontal: 12,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginBottom: 6,
    textAlign: 'right',
  },
  taskTitleCompleted: {
    color: COLORS.textMuted,
    textDecorationLine: 'line-through',
  },
  taskMetaRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  courseBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
    marginLeft: 8,
  },
  dueBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  metaIcon: {
    marginLeft: 4,
  },
  metaText: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  checkboxContainer: {
    paddingLeft: 4,
  }
});
