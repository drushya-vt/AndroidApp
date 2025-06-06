import React, { useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, FlatList, TouchableOpacity, Image, TextInput, Keyboard, TouchableWithoutFeedback } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useNavigation, RouteProp, useIsFocused } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import auth from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import CalendarScreen from './CalendarScreen';
import QuestionsScreen from './QuestionsScreen';
import { format } from 'date-fns';

type MemoryItem = {
  id: string;
  title: string;
  timestamp: string;
  duration?: string;
  questions?: { question: string; timestamp: string }[];
};

export default function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [tab, setTab] = useState<'memories' | 'calendar' | 'questions'>('memories');
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [totalDuration, setTotalDuration] = useState(0);
  const [globalQuestions, setGlobalQuestions] = useState<{ question: string; timestamp: string }[]>([]);
  const isFocused = useIsFocused();

    useEffect(() => {
      const loadData = async () => {
        if (tab === 'memories') {
          const stored = await AsyncStorage.getItem('SAVED_MEMORIES');
          if (stored) {
            const parsedMemories = JSON.parse(stored);
            parsedMemories.sort(
              (a: MemoryItem, b: MemoryItem) =>
                new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
            setMemories(parsedMemories);

            let totalSeconds = 0;
            parsedMemories.forEach((m: MemoryItem) => {
              if (m.duration) {
                const parts = m.duration.split(':').map(Number);
                if (parts.length === 3) {
                  totalSeconds += parts[0] * 3600 + parts[1] * 60 + parts[2];
                } else if (parts.length === 2) {
                  totalSeconds += parts[0] * 60 + parts[1];
                } else if (parts.length === 1) {
                  totalSeconds += parts[0];
                }
              }
            });
            setTotalDuration(totalSeconds);
          }
        }
        if (tab === 'questions') {
          const storedQuestions = await AsyncStorage.getItem('ALL_USER_QUESTIONS');
          const storedMemories = await AsyncStorage.getItem('SAVED_MEMORIES');
          let combinedQuestions: { question: string; timestamp: string }[] = [];

          if (storedQuestions) {
            combinedQuestions = JSON.parse(storedQuestions);
          }

          if (storedMemories) {
            const parsedMemories = JSON.parse(storedMemories);
            parsedMemories.forEach((memory: MemoryItem) => {
              if (Array.isArray(memory.questions)) {
                combinedQuestions = combinedQuestions.concat(memory.questions);
              }
            });
          }

          combinedQuestions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
          setGlobalQuestions(combinedQuestions);
        }
      };
      console.log(totalDuration);
      loadData();
    }, [tab, isFocused]);

  const handleSignOut = async () => {
    try {
      await GoogleSignin.signOut();
      await auth().signOut();
      console.log('User signed out');
    } catch (error) {
      console.error('Error signing out', error);
    }
  };

  const renderTabContent = () => {
    switch (tab) {
      case 'memories':
        let lastDateLabel = '';
        return (
          <FlatList
            data={memories}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const time = format(new Date(item.timestamp), 'h:mm a');
              const dateLabel = format(new Date(item.timestamp), 'EEEE, MMMM d');

              const showDateLabel = dateLabel !== lastDateLabel;
              if (showDateLabel) lastDateLabel = dateLabel;

              return (
                <>
                  {showDateLabel && (
                    <Text style={{ fontSize: 16, fontWeight: '500', marginTop: 12, marginBottom: 4, color: '#888' }}>
                      {dateLabel}
                    </Text>
                  )}
                  <TouchableOpacity
                    style={styles.memoryCard}
                    onPress={() => navigation.navigate('MemoryDetail', { memoryId: item.id })}
                  >
                    <Text style={styles.memoryTime}>{time}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memoryTitle}>{item.title}</Text>
                    </View>
                    <Text style={styles.memoryDuration}>
                      {(() => {
                        if (!item.duration) return '';
                        const parts = item.duration.split(':').map(Number);
                        let totalSeconds = 0;
                        if (parts.length === 3) {
                          totalSeconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
                        } else if (parts.length === 2) {
                          totalSeconds = parts[0] * 60 + parts[1];
                        } else if (parts.length === 1) {
                          totalSeconds = parts[0];
                        }

                        const h = Math.floor(totalSeconds / 3600);
                        const m = Math.floor((totalSeconds % 3600) / 60);
                        const s = totalSeconds % 60;
                        return `${h > 0 ? h + 'h ' : ''}${m > 0 ? m + 'm ' : ''}${s}s`;
                      })()}
                    </Text>
                  </TouchableOpacity>
                </>
              );
            }}
          />
        );
      case 'calendar':
        return <CalendarScreen />;
      case 'questions':
        return (
          <FlatList
            data={globalQuestions}
            keyExtractor={(item, index) => `${item.question}-${index}`}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.memoryCard}>
                <Text style={{ fontSize: 18, marginRight: 10 }}>💬</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.memoryTitle}>{item.question}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
        );
    }
  };

  return (
    <TouchableWithoutFeedback onPress={() => { if (showDropdown) setShowDropdown(false); Keyboard.dismiss(); }}>
      <View style={styles.container}>
        {/* Top header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => setShowDropdown(!showDropdown)}>
            <Image
              source={{
                uri: auth().currentUser?.photoURL || 'https://ui-avatars.com/api/?name=User',
              }}
              style={styles.avatar}
            />
          </TouchableOpacity>
          <Text style={styles.title}>
            TwinMind{' '}
            <Text style={styles.proBadge}>PRO</Text>
          </Text>
          <Text style={styles.help}>Help</Text>
        </View>

        {showDropdown && (
          <TouchableOpacity style={styles.signOutDropdown} onPress={handleSignOut}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        )}

        {/* Progress bar section */}
        <View style={styles.progressBox}>
          <Text style={styles.progressSubtitle}>Capture 100 Hours to Unlock Features</Text>
          <Text style={styles.progressTitle}>Building Your Second Brain</Text>
          <Text style={styles.progressHours}>{Math.round(totalDuration / 3600)} / 100 hours</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${Math.min((totalDuration / 360000) * 100, 100)}%` }]} />
          </View>
        </View>

        {/* Segmented control tabs */}
        <View style={styles.tabs}>
          {['memories', 'calendar', 'questions'].map((key) => (
            <TouchableOpacity key={key} onPress={() => setTab(key as any)}>
              <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.content}>{renderTabContent()}</View>
        {/* iOS-style bottom CTA buttons */}
        <View style={styles.bottomActions}>
          <TouchableOpacity style={styles.askButton} onPress={() => navigation.navigate('AskAllMemories')}>
            {/* <Icon name="magnify" size={20} color="#003f77" /> */}
            <Text style={styles.askText}>Ask All Memories</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.captureButton}
            onPress={() => {
              navigation.navigate('MemoryDetail', {
                mode: 'capture',
                title: 'New Recording',
                timestamp: new Date().toISOString(),
              });
            }}
          >
            {/* <Icon name="microphone" size={22} color="#fff" /> */}
            <Text style={styles.captureText}>Capture</Text>
          </TouchableOpacity>
        </View>
      </View>
    </TouchableWithoutFeedback>
  );
}


const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 50, backgroundColor: '#F6F7F9' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    backgroundColor: '#F6F7F9',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#ddd',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  proBadge: {
    color: '#005288',
    fontSize: 10,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  help: {
    color: '#0D4A86',
  },
  progressBox: {
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    elevation: 2,
  },
  progressSubtitle: {
    color: '#F57C00',
    fontSize: 12,
  },
  progressTitle: {
    fontWeight: '600',
    fontSize: 16,
    marginVertical: 4,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#eee',
    overflow: 'hidden',
    marginTop: 6,
  },
  progressFill: {
    width: '80%',
    height: '100%',
    backgroundColor: '#F57C00',
  },
  progressHours: {
    fontSize: 12,
    color: '#888',
    marginTop: 4,
  },
  tabs: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderBottomWidth: 1,
    borderColor: '#ddd',
    paddingVertical: 10,
    backgroundColor: '#fff',
  },
  tabText: {
    fontSize: 14,
    color: '#888',
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  tabTextActive: {
    color: '#000',
    fontWeight: 'bold',
    borderBottomWidth: 2,
    borderColor: '#000',
  },
  content: { flex: 1, paddingHorizontal: 16 },
  listItem: { paddingVertical: 10, borderBottomWidth: 1, borderColor: '#ccc' },
  timestamp: { fontSize: 12, color: 'gray' },
  bottomActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderColor: '#eee',
    backgroundColor: '#fff',
  },
  askButton: {
    backgroundColor: '#F3F2F1',
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  askText: {
    color: '#003f77',
    fontWeight: '600',
    marginLeft: 8,
  },
  captureButton: {
    backgroundColor: '#003f77',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 999,
  },
  captureText: {
    color: '#fff',
    marginLeft: 8,
  },
  signOutDropdown: {
    position: 'absolute',
    top: 80,
    left: 20,
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 8,
    elevation: 4,
    zIndex: 10,
  },
  signOutText: {
    color: '#d00',
    fontWeight: 'bold',
  },
  memoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginVertical: 6,
    padding: 12,
    borderRadius: 12,
    elevation: 1,
  },
  memoryTime: {
    fontSize: 12,
    color: '#888',
    marginRight: 10,
  },
  memoryTitle: {
    fontSize: 14,
    color: '#000',
  },
  memoryDuration: {
    fontSize: 12,
    color: '#666',
  },
});