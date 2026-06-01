import React from 'react';
import { Tabs } from 'expo-router';
import { Home, Calendar, CheckSquare, Award, RefreshCw } from 'lucide-react-native';
import { COLORS } from '../../components/Theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: COLORS.surfaceGlassLess,
          borderTopWidth: 1,
          borderTopColor: COLORS.border,
          height: 68,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: 'bold',
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'الرئيسية',
          tabBarIcon: ({ color }) => <Home size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: 'الجدول',
          tabBarIcon: ({ color }) => <Calendar size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'المهام',
          tabBarIcon: ({ color }) => <CheckSquare size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="grades"
        options={{
          title: 'الدرجات',
          tabBarIcon: ({ color }) => <Award size={20} color={color} />,
        }}
      />
      <Tabs.Screen
        name="sync"
        options={{
          title: 'المزامنة',
          tabBarIcon: ({ color }) => <RefreshCw size={20} color={color} />,
        }}
      />
    </Tabs>
  );
}
