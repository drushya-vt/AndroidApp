import { useFocusEffect } from '@react-navigation/native';
import React, { useState, useEffect } from 'react';
import { View, ScrollView, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { TextInput, Button, ActivityIndicator } from 'react-native-paper';
import axios from 'axios';
import { OPENAI_API_KEY } from '@env';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function TranscriptChatScreen() {
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);
  const [savedMemories, setSavedMemories] = useState<any[]>([]);
  const [memoriesLoading, setMemoriesLoading] = useState(true);

  // Fetch all saved memories on mount
  useEffect(() => {
    const fetchMemories = async () => {
      setMemoriesLoading(true);
      try {
        const stored = await AsyncStorage.getItem('SAVED_MEMORIES');
        const parsed = stored ? JSON.parse(stored) : [];
        setSavedMemories(parsed);
      } catch (err) {
        setSavedMemories([]);
      } finally {
        setMemoriesLoading(false);
      }
    };
    fetchMemories();
  }, []);

  // Refresh memories whenever this screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      const reload = async () => {
        try {
          const stored = await AsyncStorage.getItem('SAVED_MEMORIES');
          const parsed = stored ? JSON.parse(stored) : [];
          setSavedMemories(parsed);
        } catch (err) {
          console.error('Error refreshing memories on focus:', err);
        }
      };
      reload();
    }, [])
  );

  const storeQuestion = async (q: string) => {
    try {
      const stored = await AsyncStorage.getItem('SAVED_MEMORIES');
      if (!stored) return;
      const memories = JSON.parse(stored);
      if (memories.length === 0) return;

      const latestMemoryId = await AsyncStorage.getItem('LATEST_MEMORY_ID');
      if (!latestMemoryId) return;

      const memoryIndex = memories.findIndex((m: any) => m.id === latestMemoryId);
      if (memoryIndex === -1) return;

      const questionEntry = { question: q, timestamp: new Date().toISOString() };
      const existingQuestions = memories[memoryIndex].questions || [];
      if (!existingQuestions.some((item: any) => item.question === q)) {
        memories[memoryIndex].questions = [...existingQuestions, questionEntry];
        await AsyncStorage.setItem('SAVED_MEMORIES', JSON.stringify(memories));
        setSavedMemories(memories);
      }
    } catch (err) {
      console.error('Error storing question:', err);
    }
  };

  const handleSend = async () => {
    if (savedMemories.length === 0) {
      setResponse('No transcripts available to ask about.');
      return;
    }
    setLoading(true);
    try {
      const latestMemoryId = await AsyncStorage.getItem('LATEST_MEMORY_ID');
      const latestMemory = savedMemories.find(m => m.id === latestMemoryId);
      const mergedTranscript = latestMemory?.transcript || '';
      const messages = [
        {
          role: 'system',
          content: 'You are a meeting assistant. Answer based on the transcript provided.',
        },
        {
          role: 'user',
          content: `Transcript:\n${mergedTranscript}\n\nUser question: ${query}`,
        },
      ];

      const res = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-3.5-turbo',
          messages,
          temperature: 0.7,
        },
        {
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          timeout: 20000,
        }
      );

      const answer = res.data.choices[0].message.content;
      setResponse(answer);
      await storeQuestion(query);
    } catch (err) {
      console.error('Chat failed:', err);
      setResponse('Error: Could not get response.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {memoriesLoading ? (
        <ActivityIndicator style={{ marginBottom: 12 }} />
      ) : savedMemories.length === 0 ? (
        <Text style={{ color: '#888', marginBottom: 12 }}>No saved transcripts found.</Text>
      ) : null}
      <Text style={styles.label}>Ask a question about transcripts:</Text>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="e.g. What are some main topics?"
        mode="outlined"
        style={styles.input}
      />
      <Button mode="contained" onPress={handleSend} disabled={loading || savedMemories.length === 0}>
        Send
      </Button>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 20 }} />
      ) : (
        <ScrollView style={styles.outputBox}>
          <Text>{response}</Text>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    flex: 1,
    backgroundColor: 'white',
  },
  label: {
    marginBottom: 8,
    fontSize: 16,
  },
  input: {
    marginBottom: 12,
  },
  outputBox: {
    marginTop: 20,
    backgroundColor: '#f4f4f4',
    padding: 10,
    borderRadius: 8,
  },
  memoryPickerContainer: {
    marginBottom: 12,
  },
  memoryPickerLabel: {
    fontWeight: '600',
    marginBottom: 4,
    fontSize: 15,
  },
  memoryItem: {
    backgroundColor: '#e5f0fb',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    minWidth: 120,
    maxWidth: 180,
    justifyContent: 'center',
    alignItems: 'flex-start',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  memoryItemSelected: {
    backgroundColor: '#003f77',
    borderColor: '#003f77',
  },
  memoryTitle: {
    fontWeight: '700',
    color: '#003f77',
    fontSize: 15,
  },
  memoryTimestamp: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
});