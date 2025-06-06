import React, { useEffect, useRef, useState } from 'react';
import { View, Button, Text, PermissionsAndroid, Platform } from 'react-native';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import RNFS from 'react-native-fs';
import mime from 'mime';
import axios from 'axios';
import { OPENAI_API_KEY } from '@env';
import { RouteProp, useRoute } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const recorder = new AudioRecorderPlayer();

export default function MemoryDetailScreen() {
  const route = useRoute<RouteProp<{ params: { mode: string; title: string; timestamp: string } }, 'params'>>();
  const { mode, title, timestamp } = route.params || { mode: 'view', title: '', timestamp: '' };

  const [tab, setTab] = useState<'notes' | 'chat' | 'summary'>('notes');
  const [transcript, setTranscript] = useState('');
  const [summary, setSummary] = useState('');
  const [searchQueries, setSearchQueries] = useState<string[]>([]);
  const [recordingStopped, setRecordingStopped] = useState(false);

  const isRecordingRef = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const recordedChunks = useRef<string[]>([]);

  const transcribeChunk = async (filePath: string) => {
    const mimeType = mime.getType(filePath) || 'audio/mp4';
    const fileName = filePath.split('/').pop();
    const formData = new FormData();
    formData.append('file', {
      uri: `file://${filePath}`,
      type: mimeType,
      name: fileName,
    } as any);
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/audio/transcriptions',
        formData,
        {
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            'Content-Type': 'multipart/form-data',
          },
        }
      );
      return response.data.text;
    } catch (error) {
      console.error('Transcription error:', error);
      return null;
    }
  };

  const generateSummary = async (fullTranscript: string) => {
    try {
      const response = await axios.post(
        'https://api.openai.com/v1/chat/completions',
        {
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: 'You are a meeting assistant. Generate a structured meeting summary with bullet points and clear segmentation.',
            },
            {
              role: 'user',
              content: `Here is the full transcript:\n\n${fullTranscript}`,
            },
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
      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('Summary generation error:', error);
      return null;
    }
  };

  const recordChunk = async () => {
    const chunkId = `chunk_${Date.now()}`;
    const path = `${RNFS.DocumentDirectoryPath}/${chunkId}.mp4`;
    try {
      await recorder.startRecorder(path);
      setTimeout(async () => {
        try {
          await recorder.stopRecorder();
          const transcript = await transcribeChunk(path);
          if (transcript) recordedChunks.current.push(transcript);
        } catch (err) {
          console.error('Error stopping recorder or transcribing chunk:', err);
        }
      }, 30000);
    } catch (err) {
      console.error('Error starting recorder:', err);
    }
  };

  const startRecording = async () => {
    isRecordingRef.current = true;
    await recordChunk();
    intervalRef.current = setInterval(recordChunk, 30000);
  };

  const stopRecording = async () => {
    isRecordingRef.current = false;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    const combinedTranscript = recordedChunks.current.join('\n');
    setTranscript(combinedTranscript);
    const summaryResult = await generateSummary(combinedTranscript);
    if (summaryResult) setSummary(summaryResult);
    setRecordingStopped(true);
    setTab('notes');
    const questionsForThisRecording = [
      "What were the key takeaways?",
      "Any deadlines discussed?"
    ];
    setSearchQueries(questionsForThisRecording);
    // Store the latest transcript for chat screen retrieval
    try {
      await AsyncStorage.setItem('LATEST_TRANSCRIPT', combinedTranscript || '');
      // Store global questions
      const globalQuestions = JSON.parse(await AsyncStorage.getItem('ALL_QUESTIONS') || '[]');
      await AsyncStorage.setItem('ALL_QUESTIONS', JSON.stringify([...globalQuestions, ...questionsForThisRecording]));
    } catch (err) {
      console.error('Error saving LATEST_TRANSCRIPT or ALL_QUESTIONS:', err);
    }
  };

  useEffect(() => {
    if (mode === 'capture') {
      startRecording();
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      isRecordingRef.current = false;
    };
  }, []);

  return (
    <View style={{ flex: 1, padding: 20 }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>{title || 'Memory Detail'}</Text>
      <Text style={{ marginBottom: 10 }}>{timestamp}</Text>

      <View style={{ flexDirection: 'row', marginBottom: 10 }}>
        <Button title="Notes" onPress={() => setTab('notes')} disabled={mode === 'capture' && !recordingStopped} />
        <Button title="Summary" onPress={() => setTab('summary')} disabled={mode === 'capture' && !recordingStopped} />
        <Button title="Chat" onPress={() => setTab('chat')} />
      </View>

      {/* Tab content */}
      <View style={{ flex: 1 }}>
        {tab === 'notes' && <Text>{transcript || 'No notes yet.'}</Text>}
        {tab === 'summary' && <Text>{summary || 'No summary yet.'}</Text>}
        {tab === 'chat' && <Text>Chat with transcript here</Text>}
      </View>

      {/* Buttons */}
      {mode === 'capture' ? (
        <View style={{ marginTop: 20 }}>
          {!recordingStopped ? (
            <Button title="Stop Recording" onPress={stopRecording} />
          ) : (
            <>
              <Button title="Chat with Transcript" onPress={() => setTab('chat')} />
              <Button title="Restart Recording" onPress={startRecording} />
            </>
          )}
        </View>
      ) : (
        <View style={{ marginTop: 20 }}>
          <Button title="Chat with Transcript" onPress={() => setTab('chat')} />
        </View>
      )}
    </View>
  );
}