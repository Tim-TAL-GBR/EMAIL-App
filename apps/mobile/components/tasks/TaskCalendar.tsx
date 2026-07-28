import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Colors, Spacing, FontSize, FontWeight } from '../../lib/constants';
import { Task } from '../../hooks/useTasks';
import { Feather } from '@expo/vector-icons';

interface TaskCalendarProps {
  tasks: Task[];
  onTaskPress: (task: Task) => void;
}

const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
];

const DAY_NAMES = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function getDaysInMonth(year: number, month: number): Date[] {
  const days: Date[] = [];
  const date = new Date(year, month, 1);
  while (date.getMonth() === month) {
    days.push(new Date(date));
    date.setDate(date.getDate() + 1);
  }
  return days;
}

function getStartDayOfWeek(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1; // Monday = 0
}

export function TaskCalendar({ tasks, onTaskPress }: TaskCalendarProps) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const days = useMemo(() => getDaysInMonth(currentYear, currentMonth), [currentYear, currentMonth]);
  const startDay = useMemo(() => getStartDayOfWeek(currentYear, currentMonth), [currentYear, currentMonth]);

  // Map tasks by date string
  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      if (!task.due_date) continue;
      const dateStr = new Date(task.due_date).toISOString().split('T')[0];
      if (!map.has(dateStr)) map.set(dateStr, []);
      map.get(dateStr)!.push(task);
    }
    return map;
  }, [tasks]);

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
    setSelectedDay(null);
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
    setSelectedDay(null);
  };

  const goToToday = () => {
    setCurrentMonth(today.getMonth());
    setCurrentYear(today.getFullYear());
    setSelectedDay(today.toISOString().split('T')[0]);
  };

  const todayStr = today.toISOString().split('T')[0];

  // Tasks for the selected day
  const selectedDayTasks = selectedDay ? tasksByDate.get(selectedDay) || [] : [];

  return (
    <View style={styles.container}>
      {/* Month Navigation */}
      <View style={styles.nav}>
        <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
          <Feather name="chevron-left" size={20} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.navCenter}>
          <Text style={styles.monthTitle}>{MONTH_NAMES[currentMonth]} {currentYear}</Text>
          <TouchableOpacity onPress={goToToday} style={styles.todayBtn}>
            <Text style={styles.todayBtnText}>Heute</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
          <Feather name="chevron-right" size={20} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {/* Day Names */}
      <View style={styles.dayNames}>
        {DAY_NAMES.map(day => (
          <Text key={day} style={styles.dayName}>{day}</Text>
        ))}
      </View>

      {/* Calendar Grid */}
      <View style={styles.grid}>
        {/* Empty cells for offset */}
        {Array.from({ length: startDay }).map((_, i) => (
          <View key={`empty-${i}`} style={styles.dayCell} />
        ))}

        {days.map(day => {
          const dateStr = day.toISOString().split('T')[0];
          const dayTasks = tasksByDate.get(dateStr) || [];
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDay;
          const hasOverdue = dayTasks.some(t => t.status === 'open' && new Date(t.due_date!) < today);
          const hasOpen = dayTasks.some(t => t.status === 'open');

          return (
            <TouchableOpacity
              key={dateStr}
              style={[
                styles.dayCell,
                isToday && styles.dayCellToday,
                isSelected && styles.dayCellSelected,
              ]}
              onPress={() => setSelectedDay(dateStr === selectedDay ? null : dateStr)}
            >
              <Text style={[
                styles.dayNumber,
                isToday && styles.dayNumberToday,
                isSelected && styles.dayNumberSelected,
              ]}>
                {day.getDate()}
              </Text>
              {dayTasks.length > 0 && (
                <View style={styles.dotsRow}>
                  {hasOverdue ? (
                    <View style={[styles.dot, styles.dotOverdue]} />
                  ) : hasOpen ? (
                    <View style={[styles.dot, styles.dotOpen]} />
                  ) : (
                    <View style={[styles.dot, styles.dotDone]} />
                  )}
                  {dayTasks.length > 1 && (
                    <Text style={styles.dotCount}>{dayTasks.length}</Text>
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Selected Day Tasks */}
      {selectedDay && (
        <View style={styles.detailSection}>
          <Text style={styles.detailTitle}>
            {new Date(selectedDay + 'T00:00:00').toLocaleDateString('de-DE', {
              weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
            })}
          </Text>
          {selectedDayTasks.length === 0 ? (
            <Text style={styles.noTasks}>Keine Tasks an diesem Tag</Text>
          ) : (
            <ScrollView style={styles.taskList} contentContainerStyle={styles.taskListContent}>
              {selectedDayTasks.map(task => (
                <TouchableOpacity
                  key={task.id}
                  style={styles.taskItem}
                  onPress={() => onTaskPress(task)}
                >
                  <View style={[
                    styles.statusDot,
                    task.status === 'done' ? styles.statusDotDone : styles.statusDotOpen
                  ]} />
                  <View style={styles.taskInfo}>
                    <Text style={[styles.taskTitle, task.status === 'done' && styles.taskTitleDone]} numberOfLines={1}>
                      {task.title}
                    </Text>
                    {task.team && (
                      <Text style={styles.taskTeam}>{task.team.name}</Text>
                    )}
                  </View>
                  {task.assignee && (
                    <Text style={styles.taskAssignee}>{task.assignee.display_name || '?'}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  navBtn: {
    padding: Spacing.sm,
  },
  navCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  monthTitle: {
    fontSize: FontSize.lg,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  todayBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: Colors.primary,
  },
  todayBtnText: {
    fontSize: FontSize.sm,
    color: '#FFF',
    fontWeight: FontWeight.medium,
  },
  dayNames: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xs,
    paddingBottom: Spacing.xs,
  },
  dayName: {
    flex: 1,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: FontWeight.medium,
    color: Colors.textTertiary,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.xs,
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    padding: 2,
  },
  dayCellToday: {
    backgroundColor: Colors.surfaceHover,
  },
  dayCellSelected: {
    backgroundColor: Colors.primary,
  },
  dayNumber: {
    fontSize: FontSize.sm,
    color: Colors.text,
    fontWeight: FontWeight.medium,
  },
  dayNumberToday: {
    color: Colors.primary,
    fontWeight: FontWeight.bold,
  },
  dayNumberSelected: {
    color: '#FFF',
    fontWeight: FontWeight.bold,
  },
  dotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 2,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  dotOverdue: {
    backgroundColor: Colors.error,
  },
  dotOpen: {
    backgroundColor: Colors.primary,
  },
  dotDone: {
    backgroundColor: Colors.success,
  },
  dotCount: {
    fontSize: 9,
    color: Colors.textTertiary,
  },
  detailSection: {
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
    padding: Spacing.md,
    maxHeight: 300,
  },
  detailTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  noTasks: {
    fontSize: FontSize.sm,
    color: Colors.textTertiary,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  taskList: {
    flex: 1,
  },
  taskListContent: {
    gap: 6,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.sm,
    backgroundColor: Colors.surfaceHover,
    borderRadius: 8,
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusDotOpen: {
    backgroundColor: Colors.primary,
  },
  statusDotDone: {
    backgroundColor: Colors.success,
  },
  taskInfo: {
    flex: 1,
  },
  taskTitle: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.medium,
    color: Colors.text,
  },
  taskTitleDone: {
    textDecorationLine: 'line-through',
    color: Colors.textTertiary,
  },
  taskTeam: {
    fontSize: 11,
    color: Colors.textTertiary,
  },
  taskAssignee: {
    fontSize: 11,
    color: Colors.textTertiary,
  },
});
