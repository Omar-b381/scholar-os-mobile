import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  Dimensions,
  Linking
} from 'react-native';
import { useNavigation } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, GLOBAL_STYLES } from '../../components/Theme';
import {
  BookMarked,
  Plus,
  Trash2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Play,
  Award,
  CheckCircle,
  Clock,
  BookOpen,
  CheckSquare,
  Square
} from 'lucide-react-native';

interface Lesson {
  id: string;
  title: string;
  duration?: string;
  completed: boolean;
}

interface SelfStudyTrack {
  id: string;
  title: string;
  platform: string;
  url?: string;
  notes?: string;
  color: string;
  status: 'not_started' | 'in_progress' | 'completed';
  lessons: Lesson[];
  created_at: string;
}

const PRESETS_COLORS = [
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#f59e0b', // amber
  '#10b981', // emerald
  '#06b6d4'  // cyan
];

export default function SelfStudyScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [tracks, setTracks] = useState<SelfStudyTrack[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPlatform, setNewPlatform] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newColor, setNewColor] = useState(PRESETS_COLORS[0]);
  const [bulkLessonsText, setBulkLessonsText] = useState('');

  // Single Lesson Add form
  const [tempLessonTitle, setTempLessonTitle] = useState('');
  const [tempLessonDuration, setTempLessonDuration] = useState('');

  const activeTrack = tracks.find(t => t.id === selectedTrackId);

  // Load tracks
  useEffect(() => {
    loadTracks();
    const unsubscribe = navigation.addListener('focus', () => {
      loadTracks();
    });
    return unsubscribe;
  }, [navigation]);

  const loadTracks = async () => {
    try {
      setLoading(true);
      const saved = await AsyncStorage.getItem('selfStudyTracks');
      if (saved) {
        setTracks(JSON.parse(saved));
      }
      setLoading(false);
    } catch (e) {
      console.warn('Tracks load error:', e);
      setLoading(false);
    }
  };

  const saveTracks = async (updated: SelfStudyTrack[]) => {
    setTracks(updated);
    try {
      await AsyncStorage.setItem('selfStudyTracks', JSON.stringify(updated));
    } catch (e) {
      console.warn('Tracks save error:', e);
    }
  };

  // Add Track
  const handleAddTrack = async () => {
    if (!newTitle.trim()) {
      Alert.alert('خطأ', 'يرجى إدخال اسم المسار التعليمي.');
      return;
    }

    const parsedLessons: Lesson[] = bulkLessonsText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => ({
        id: 'lesson-' + Math.random().toString(36).substring(2, 9),
        title: line,
        completed: false
      }));

    const newTrack: SelfStudyTrack = {
      id: 'track-' + Math.random().toString(36).substring(2, 9),
      title: newTitle.trim(),
      platform: newPlatform.trim() || 'دراسة ذاتية حرة',
      url: newUrl.trim() || undefined,
      notes: newNotes.trim() || undefined,
      color: newColor,
      status: parsedLessons.length > 0 ? 'in_progress' : 'not_started',
      lessons: parsedLessons,
      created_at: new Date().toISOString()
    };

    const updated = [newTrack, ...tracks];
    await saveTracks(updated);
    setSelectedTrackId(newTrack.id);

    // Reset Form
    setNewTitle('');
    setNewPlatform('');
    setNewUrl('');
    setNewNotes('');
    setNewColor(PRESETS_COLORS[0]);
    setBulkLessonsText('');
    setIsAddModalOpen(false);
  };

  // Delete Track
  const handleDeleteTrack = (id: string) => {
    Alert.alert(
      'تأكيد الحذف',
      'هل تريد حذف هذا المسار التعليمي وكل محتوياته؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: async () => {
            const updated = tracks.filter(t => t.id !== id);
            await saveTracks(updated);
            if (selectedTrackId === id) {
              setSelectedTrackId(updated.length > 0 ? updated[0].id : null);
            }
          }
        }
      ]
    );
  };

  // Toggle Lesson
  const handleToggleLesson = async (lessonId: string) => {
    if (!selectedTrackId) return;
    const updated = tracks.map(t => {
      if (t.id === selectedTrackId) {
        const updatedLessons = t.lessons.map(l =>
          l.id === lessonId ? { ...l, completed: !l.completed } : l
        );
        const completedCount = updatedLessons.filter(l => l.completed).length;
        let status: SelfStudyTrack['status'] = t.status;
        if (updatedLessons.length > 0) {
          if (completedCount === updatedLessons.length) {
            status = 'completed';
          } else if (completedCount > 0) {
            status = 'in_progress';
          } else {
            status = 'not_started';
          }
        }
        return { ...t, lessons: updatedLessons, status };
      }
      return t;
    });
    await saveTracks(updated);
  };

  // Add Lesson
  const handleAddLesson = async () => {
    if (!selectedTrackId || !tempLessonTitle.trim()) return;

    const newLesson: Lesson = {
      id: 'lesson-' + Math.random().toString(36).substring(2, 9),
      title: tempLessonTitle.trim(),
      duration: tempLessonDuration.trim() || undefined,
      completed: false
    };

    const updated = tracks.map(t => {
      if (t.id === selectedTrackId) {
        const updatedLessons = [...t.lessons, newLesson];
        const completedCount = updatedLessons.filter(l => l.completed).length;
        const status: SelfStudyTrack['status'] = completedCount === updatedLessons.length ? 'completed' : 'in_progress';
        return { ...t, lessons: updatedLessons, status };
      }
      return t;
    });

    await saveTracks(updated);
    setTempLessonTitle('');
    setTempLessonDuration('');
  };

  // Delete Lesson
  const handleDeleteLesson = async (lessonId: string) => {
    if (!selectedTrackId) return;
    const updated = tracks.map(t => {
      if (t.id === selectedTrackId) {
        const updatedLessons = t.lessons.filter(l => l.id !== lessonId);
        const completedCount = updatedLessons.filter(l => l.completed).length;
        let status: SelfStudyTrack['status'] = t.status;
        if (updatedLessons.length > 0) {
          status = completedCount === updatedLessons.length ? 'completed' : 'in_progress';
        } else {
          status = 'not_started';
        }
        return { ...t, lessons: updatedLessons, status };
      }
      return t;
    });
    await saveTracks(updated);
  };

  // Update Notes
  const handleUpdateNotes = async (text: string) => {
    if (!selectedTrackId) return;
    const updated = tracks.map(t =>
      t.id === selectedTrackId ? { ...t, notes: text } : t
    );
    setTracks(updated);
    await AsyncStorage.setItem('selfStudyTracks', JSON.stringify(updated));
  };

  const handleOpenLink = (url?: string) => {
    if (url) {
      Linking.openURL(url).catch(() => {
        Alert.alert('خطأ', 'فشل فتح الرابط الإلكتروني.');
      });
    }
  };

  // Get general stats
  const totalTracks = tracks.length;
  const completedTracks = tracks.filter(t => t.status === 'completed').length;
  const inProgressTracks = tracks.filter(t => t.status === 'in_progress').length;

  return (
    <View style={GLOBAL_STYLES.container}>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : activeTrack ? (
        /* --- Track Detail View --- */
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.detailHeader}>
            <TouchableOpacity onPress={() => setSelectedTrackId(null)} style={styles.backBtn}>
              <ChevronRight size={22} color={COLORS.textPrimary} />
              <Text style={styles.backBtnText}>رجوع</Text>
            </TouchableOpacity>
            
            <View style={styles.headerDetails}>
              <View style={styles.badgeRow}>
                <Text style={[styles.platformBadge, { backgroundColor: activeTrack.color }]}>
                  {activeTrack.platform}
                </Text>
                {activeTrack.status === 'completed' ? (
                  <Text style={[styles.statusBadge, styles.statusCompleted]}>✓ مكتمل</Text>
                ) : (
                  <Text style={[styles.statusBadge, styles.statusProgress]}>قيد التقدم</Text>
                )}
              </View>
              <Text style={styles.trackTitleLarge}>{activeTrack.title}</Text>
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
            {/* Progress Bar Card */}
            <View style={GLOBAL_STYLES.glassCard}>
              <View style={styles.progressTextRow}>
                <Text style={styles.progressLabel}>نسبة إنجاز المسار:</Text>
                <Text style={[styles.progressVal, { color: activeTrack.color }]}>
                  {activeTrack.lessons.length > 0
                    ? Math.round((activeTrack.lessons.filter(l => l.completed).length / activeTrack.lessons.length) * 100)
                    : 0}%
                </Text>
              </View>
              <View style={styles.progressBg}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      backgroundColor: activeTrack.color,
                      width: `${activeTrack.lessons.length > 0 ? (activeTrack.lessons.filter(l => l.completed).length / activeTrack.lessons.length) * 100 : 0}%`
                    }
                  ]}
                />
              </View>
              <Text style={styles.progressDetailText}>
                أنجزت {activeTrack.lessons.filter(l => l.completed).length} من أصل {activeTrack.lessons.length} وحدة تعليمية
              </Text>
              
              {activeTrack.url && (
                <TouchableOpacity
                  style={[GLOBAL_STYLES.glassButton, styles.linkBtn, { backgroundColor: activeTrack.color }]}
                  onPress={() => handleOpenLink(activeTrack.url)}
                >
                  <View style={styles.btnContentRow}>
                    <ExternalLink size={16} color={COLORS.textPrimary} style={styles.btnIconLeft} />
                    <Text style={GLOBAL_STYLES.buttonText}>الانتقال لرابط المصدر</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>

            {/* Notes Section */}
            <View style={GLOBAL_STYLES.glassCard}>
              <Text style={styles.sectionTitle}>مفكرة المسار والملاحظات:</Text>
              <TextInput
                multiline
                style={styles.notesArea}
                placeholder="اكتب ملاحظاتك، تفاصيل التقدم، المشاكل والحلول هنا..."
                placeholderTextColor={COLORS.textMuted}
                value={activeTrack.notes || ''}
                onChangeText={handleUpdateNotes}
              />
            </View>

            {/* Add Lesson Form */}
            <View style={GLOBAL_STYLES.glassCard}>
              <Text style={styles.sectionTitle}>إضافة درس جديد للمسار:</Text>
              <TextInput
                style={GLOBAL_STYLES.glassInput}
                placeholder="عنوان الدرس / الوحدة"
                placeholderTextColor={COLORS.textMuted}
                value={tempLessonTitle}
                onChangeText={setTempLessonTitle}
              />
              <TextInput
                style={GLOBAL_STYLES.glassInput}
                placeholder="المدة (مثال: 15 د، الفصل الأول)"
                placeholderTextColor={COLORS.textMuted}
                value={tempLessonDuration}
                onChangeText={setTempLessonDuration}
              />
              <TouchableOpacity style={GLOBAL_STYLES.glassButton} onPress={handleAddLesson}>
                <Text style={GLOBAL_STYLES.buttonText}>أضف الدرس</Text>
              </TouchableOpacity>
            </View>

            {/* Lessons Checklist */}
            <Text style={styles.listHeaderTitle}>قائمة الدروس والوحدات:</Text>
            {activeTrack.lessons.length === 0 ? (
              <View style={styles.emptyLessons}>
                <Text style={styles.emptyLessonsText}>لا توجد دروس مضافة بعد.</Text>
              </View>
            ) : (
              activeTrack.lessons.map(lesson => (
                <View key={lesson.id} style={[GLOBAL_STYLES.glassCard, styles.lessonCard, lesson.completed && styles.lessonCompletedCard]}>
                  <View style={styles.lessonRow}>
                    <TouchableOpacity onPress={() => handleDeleteLesson(lesson.id)}>
                      <Trash2 size={16} color={COLORS.danger} />
                    </TouchableOpacity>
                    
                    <View style={styles.lessonTextCol}>
                      <Text style={[styles.lessonTitle, lesson.completed && styles.lessonCompletedText]}>
                        {lesson.title}
                      </Text>
                      {lesson.duration && (
                        <View style={styles.durationBadge}>
                          <Clock size={8} color={COLORS.textSecondary} style={styles.durationIcon} />
                          <Text style={styles.durationText}>{lesson.duration}</Text>
                        </View>
                      )}
                    </View>

                    <TouchableOpacity onPress={() => handleToggleLesson(lesson.id)} style={styles.checkboxContainer}>
                      {lesson.completed ? (
                        <CheckSquare size={20} color={COLORS.success} />
                      ) : (
                        <Square size={20} color={COLORS.textSecondary} />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
            
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      ) : (
        /* --- Track List View --- */
        <View style={styles.container}>
          {/* Quick Stats Header */}
          <View style={styles.statsHeader}>
            <View style={styles.statsContainer}>
              <View style={styles.statBox}>
                <Text style={styles.statNum}>{totalTracks}</Text>
                <Text style={styles.statLbl}>المسارات</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statNum, { color: COLORS.warning }]}>{inProgressTracks}</Text>
                <Text style={styles.statLbl}>قيد التقدم</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={[styles.statNum, { color: COLORS.success }]}>{completedTracks}</Text>
                <Text style={styles.statLbl}>المكتملة</Text>
              </View>
            </View>
            
            <TouchableOpacity style={[GLOBAL_STYLES.glassButton, styles.addBtn]} onPress={() => setIsAddModalOpen(true)}>
              <View style={styles.btnRow}>
                <Plus size={18} color={COLORS.textPrimary} style={styles.btnIcon} />
                <Text style={GLOBAL_STYLES.buttonText}>إضافة مسار تعلم حر</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* List of Tracks */}
          {tracks.length === 0 ? (
            <View style={styles.center}>
              <BookMarked size={40} color={COLORS.textMuted} style={styles.emptyIcon} />
              <Text style={styles.emptyText}>
                لا توجد مسارات تعلم حر حالياً.{'\n'}
                ابدأ بإضافة مسار كورس خارجي أو مهارة لتتبعها!
              </Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.listContent}>
              {tracks.map(track => {
                const completedCount = track.lessons.filter(l => l.completed).length;
                const progressPct = track.lessons.length > 0 ? Math.round((completedCount / track.lessons.length) * 100) : 0;
                
                return (
                  <TouchableOpacity
                    key={track.id}
                    style={[GLOBAL_STYLES.glassCard, styles.trackCard]}
                    onPress={() => setSelectedTrackId(track.id)}
                  >
                    <View style={styles.trackCardHeader}>
                      <TouchableOpacity onPress={() => handleDeleteTrack(track.id)}>
                        <Trash2 size={16} color={COLORS.danger} />
                      </TouchableOpacity>
                      
                      <View style={styles.trackCardTitles}>
                        <View style={styles.tagRow}>
                          <Text style={[styles.cardPlatformBadge, { backgroundColor: track.color }]}>
                            {track.platform}
                          </Text>
                          {track.status === 'completed' ? (
                            <Text style={styles.cardStatusCompleted}>✓ مكتمل</Text>
                          ) : (
                            <Text style={styles.cardStatusProgress}>قيد الدراسة</Text>
                          )}
                        </View>
                        <Text style={styles.trackTitle}>{track.title}</Text>
                      </View>
                      
                      <View style={[styles.colorIndicator, { backgroundColor: track.color }]} />
                    </View>

                    <View style={styles.progressSection}>
                      <View style={styles.progressLabelRow}>
                        <Text style={styles.progressPercent}>{progressPct}%</Text>
                        <Text style={styles.progressLessonsCount}>
                          إنجاز: {completedCount} / {track.lessons.length} درس
                        </Text>
                      </View>
                      <View style={styles.progressBgMini}>
                        <View
                          style={[
                            styles.progressFillMini,
                            { backgroundColor: track.color, width: `${progressPct}%` }
                          ]}
                        />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}

      {/* Add Track Modal */}
      <Modal visible={isAddModalOpen} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>إضافة مسار تعلم حر جديد</Text>
            
            <ScrollView style={styles.modalForm} keyboardShouldPersistTaps="handled">
              <TextInput
                style={GLOBAL_STYLES.glassInput}
                placeholder="اسم المسار (مثال: تعلم تصميم UI/UX)"
                placeholderTextColor={COLORS.textMuted}
                value={newTitle}
                onChangeText={setNewTitle}
              />
              
              <TextInput
                style={GLOBAL_STYLES.glassInput}
                placeholder="اسم المنصة (مثال: Coursera، YouTube)"
                placeholderTextColor={COLORS.textMuted}
                value={newPlatform}
                onChangeText={setNewPlatform}
              />

              <TextInput
                style={GLOBAL_STYLES.glassInput}
                placeholder="رابط المسار (مثال: https://...)"
                placeholderTextColor={COLORS.textMuted}
                value={newUrl}
                onChangeText={setNewUrl}
                autoCapitalize="none"
              />

              <TextInput
                multiline
                style={[GLOBAL_STYLES.glassInput, styles.notesInput]}
                placeholder="ملاحظات أو أهداف المسار..."
                placeholderTextColor={COLORS.textMuted}
                value={newNotes}
                onChangeText={setNewNotes}
              />

              <Text style={styles.fieldLabel}>أدخل الدروس الأولية (درس في كل سطر):</Text>
              <TextInput
                multiline
                style={[GLOBAL_STYLES.glassInput, styles.lessonsInput]}
                placeholder="مقدمة في الكورس&#10;تأسيس المفاهيم الأساسية&#10;الفصل الأول: التطبيق العملي"
                placeholderTextColor={COLORS.textMuted}
                value={bulkLessonsText}
                onChangeText={setBulkLessonsText}
              />

              <Text style={styles.fieldLabel}>اختر لوناً مميزاً للمجلد:</Text>
              <View style={styles.colorsRow}>
                {PRESETS_COLORS.map(color => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorSelector,
                      { backgroundColor: color },
                      newColor === color && styles.colorSelectorActive
                    ]}
                    onPress={() => setNewColor(color)}
                  />
                ))}
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={[GLOBAL_STYLES.glassButton, styles.modalBtn, { backgroundColor: COLORS.surface }]} onPress={() => setIsAddModalOpen(false)}>
                  <Text style={GLOBAL_STYLES.buttonText}>إلغاء</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[GLOBAL_STYLES.glassButton, styles.modalBtn]} onPress={handleAddTrack}>
                  <Text style={GLOBAL_STYLES.buttonText}>إنشاء المسار</Text>
                </TouchableOpacity>
              </View>
              
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyIcon: {
    marginBottom: 16,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  statsHeader: {
    padding: 16,
    backgroundColor: COLORS.surfaceGlass,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  statNum: {
    fontSize: 20,
    fontWeight: '900',
    color: COLORS.textPrimary,
  },
  statLbl: {
    fontSize: 10,
    color: COLORS.textSecondary,
    marginTop: 4,
    fontWeight: 'bold',
  },
  addBtn: {
    paddingVertical: 12,
  },
  btnRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  btnIcon: {
    marginLeft: 8,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  trackCard: {
    padding: 14,
  },
  trackCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  colorIndicator: {
    width: 4,
    height: 36,
    borderRadius: 2,
    marginLeft: 10,
  },
  trackCardTitles: {
    flex: 1,
    alignItems: 'flex-end',
  },
  tagRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardPlatformBadge: {
    fontSize: 8,
    color: COLORS.textPrimary,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    marginLeft: 6,
  },
  cardStatusProgress: {
    fontSize: 8,
    color: COLORS.warning,
    fontWeight: 'bold',
  },
  cardStatusCompleted: {
    fontSize: 8,
    color: COLORS.success,
    fontWeight: 'bold',
  },
  trackTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    textAlign: 'right',
  },
  progressSection: {
    marginTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.03)',
    paddingTop: 10,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  progressPercent: {
    fontSize: 10,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  progressLessonsCount: {
    fontSize: 10,
    color: COLORS.textSecondary,
    fontWeight: 'bold',
  },
  progressBgMini: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFillMini: {
    height: '100%',
    borderRadius: 2,
  },
  
  /* Detail Page Styles */
  detailHeader: {
    padding: 16,
    backgroundColor: COLORS.surfaceGlass,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backBtn: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    padding: 8,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
  },
  backBtnText: {
    color: COLORS.textPrimary,
    fontSize: 11,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  headerDetails: {
    flex: 1,
    alignItems: 'flex-end',
    marginLeft: 12,
  },
  badgeRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginBottom: 4,
  },
  platformBadge: {
    fontSize: 8,
    color: COLORS.textPrimary,
    fontWeight: 'bold',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    marginLeft: 6,
  },
  statusBadge: {
    fontSize: 8,
    fontWeight: 'bold',
  },
  statusProgress: {
    color: COLORS.warning,
  },
  statusCompleted: {
    color: COLORS.success,
  },
  trackTitleLarge: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.textPrimary,
    textAlign: 'right',
  },
  scrollContainer: {
    padding: 16,
  },
  progressTextRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  progressVal: {
    fontSize: 15,
    fontWeight: '950',
  },
  progressBg: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressDetailText: {
    fontSize: 10,
    color: COLORS.textSecondary,
    textAlign: 'right',
    fontWeight: 'bold',
  },
  linkBtn: {
    marginTop: 14,
    paddingVertical: 10,
  },
  btnContentRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  btnIconLeft: {
    marginLeft: 6,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    textAlign: 'right',
    marginBottom: 10,
  },
  notesArea: {
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 10,
    minHeight: 80,
    textAlignVertical: 'top',
    color: COLORS.textPrimary,
    fontSize: 12,
    textAlign: 'right',
  },
  listHeaderTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: COLORS.textPrimary,
    textAlign: 'right',
    marginTop: 8,
    marginBottom: 12,
  },
  emptyLessons: {
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: 'dashed',
    borderRadius: 14,
  },
  emptyLessonsText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: 'bold',
  },
  lessonCard: {
    padding: 12,
    marginBottom: 8,
  },
  lessonCompletedCard: {
    backgroundColor: 'rgba(16, 185, 129, 0.02)',
  },
  lessonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  lessonTextCol: {
    flex: 1,
    alignItems: 'flex-end',
    marginHorizontal: 12,
  },
  lessonTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    textAlign: 'right',
  },
  lessonCompletedText: {
    color: COLORS.textMuted,
    textDecorationLine: 'line-through',
  },
  durationBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    marginTop: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  durationIcon: {
    marginLeft: 3,
  },
  durationText: {
    fontSize: 8,
    color: COLORS.textSecondary,
    fontWeight: 'bold',
  },
  checkboxContainer: {
    paddingLeft: 4,
  },

  /* Modal Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: COLORS.textPrimary,
    textAlign: 'right',
    marginBottom: 16,
  },
  modalForm: {
    width: '100%',
  },
  notesInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  lessonsInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.textSecondary,
    textAlign: 'right',
    marginBottom: 8,
  },
  colorsRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  colorSelector: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorSelectorActive: {
    borderColor: '#ffffff',
    transform: [{ scale: 1.1 }],
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
  }
});
