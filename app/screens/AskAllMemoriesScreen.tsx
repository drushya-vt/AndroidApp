import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { TextInput, Button, ActivityIndicator } from 'react-native-paper';
import axios from 'axios';
import { OPENAI_API_KEY } from '@env';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function AskAllMemoriesScreen() {
  const [query, setQuery] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);

  const storeQuestion = async (q: string) => {
    const entry = { question: q, timestamp: new Date().toISOString() };
    try {
      const existing = await AsyncStorage.getItem('ALL_USER_QUESTIONS');
      const parsed = existing ? JSON.parse(existing) : [];
      parsed.push(entry);
      await AsyncStorage.setItem('ALL_USER_QUESTIONS', JSON.stringify(parsed));
    } catch (err) {
      console.error('Error storing question:', err);
    }
  };

  const handleAsk = async () => {
    setLoading(true);
    try {
      const pastTranscript = "Meeting 1 summary. Meeting 2 summary...";
      const res = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-3.5-turbo',
          messages: [
            { role: 'system', content: 'You are an assistant that answers questions based on past meeting summaries.' },
            { role: 'user', content: `User question: ${query}\n\nPast summaries:\n${pastTranscript}` },
          ],
          temperature: 0.5,
        },
        {
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
        }
      );
      setAnswer(res.data.choices[0].message.content);
      await storeQuestion(query);
    } catch (err) {
      setAnswer('Failed to get response.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Ask a question about your meeting:</Text>
      <TextInput
        style={styles.input}
        value={query}
        onChangeText={setQuery}
        placeholder="e.g. What topics were discussed in the meeting?"
        mode="outlined"
      />
      <Button mode="contained" onPress={handleAsk} disabled={loading}>
        Ask
      </Button>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 20 }} />
      ) : (
        <ScrollView style={styles.outputBox}>
          <Text>{answer}</Text>
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
    fontSize: 18,
    fontWeight: '600',
    color: '#003f77',
  },
  input: {
    marginBottom: 12,
    backgroundColor: 'white',
  },
  outputBox: {
    marginTop: 20,
    backgroundColor: '#eef5fb',
    padding: 14,
    borderRadius: 10,
    borderColor: '#c0d3ec',
    borderWidth: 1,
  },
});