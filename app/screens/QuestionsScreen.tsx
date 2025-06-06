import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format, parseISO, isSameDay } from 'date-fns';

type QuestionEntry = {
  question: string;
  timestamp: string;
};

export default function QuestionsScreen() {
  const [questions, setQuestions] = useState<QuestionEntry[]>([]);

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const allQuestions: QuestionEntry[] = [];

        // Load standalone user questions
        const storedStandalone = await AsyncStorage.getItem('ALL_USER_QUESTIONS');
        if (storedStandalone) {
          allQuestions.push(...JSON.parse(storedStandalone));
        }

        // Load memory questions
        const storedMemories = await AsyncStorage.getItem('SAVED_MEMORIES');
        if (storedMemories) {
          const memories = JSON.parse(storedMemories);
          for (const memory of memories) {
            if (memory.questions && Array.isArray(memory.questions)) {
              memory.questions.forEach((q: { question: string; timestamp?: string }) => {
                if (q.question && q.question.trim() !== '') {
                  allQuestions.push({
                    question: q.question,
                    timestamp: q.timestamp || memory.timestamp || new Date().toISOString()
                  });
                }
              });
            }
          }
        }

        // Sort by timestamp descending
        allQuestions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        if (allQuestions.length > 0) {
          setQuestions(allQuestions);
        }
      } catch (err) {
        console.error('Error loading questions:', err);
      }
    };

    fetchQuestions();
  }, []);

  return (
    <View style={styles.container}>
      <FlatList
        data={questions}
        keyExtractor={(_, index) => index.toString()}
        renderItem={({ item, index }) => {
          const questionDate = parseISO(item.timestamp);
          const formattedDate = format(questionDate, 'EEE, MMM d');
          const showDateHeader =
            index === 0 ||
            !isSameDay(parseISO(questions[index - 1].timestamp), questionDate);

          return (
            <>
              {showDateHeader && (
                <Text style={styles.dateHeader}>{formattedDate}</Text>
              )}
              <View style={styles.questionItem}>
                <View style={styles.icon}>
                  <Icon name="chat-outline" size={16} color="#4682b4" />
                </View>
                <Text style={styles.question}>{item.question}</Text>
              </View>
            </>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#f7f7f7' },
  dateHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: '#666',
    marginTop: 20,
    marginBottom: 12,
  },
  questionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  icon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#e6f0fb',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  question: {
    fontSize: 15,
    color: '#222',
    flex: 1,
    fontWeight: '500',
  },
});