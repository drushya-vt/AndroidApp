import React, { useState, useEffect, useRef } from 'react';
import Markdown from 'react-native-markdown-display';
import { View, Text, Button, TouchableOpacity, StyleSheet, ScrollView, TextInput, PermissionsAndroid, Platform, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation, RouteProp, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import RNFS from 'react-native-fs';
import mime from 'mime';
import axios from 'axios';
import { OPENAI_API_KEY } from '@env';
import AsyncStorage from '@react-native-async-storage/async-storage';
import uuid from 'react-native-uuid';

type MemoryDetailScreenRouteProp = RouteProp<
    { MemoryDetail: { mode?: 'view' | 'capture'; title?: string; timestamp?: string; memoryId?: string } },
    'MemoryDetail'
>;

export default function MemoryDetailScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const route = useRoute<MemoryDetailScreenRouteProp>();
    const { mode, title, timestamp, memoryId: routeMemoryId } = route.params || {};

    const [tab, setTab] = useState<'searches' | 'notes' | 'transcript'>('searches');
    const [recordingStopped, setRecordingStopped] = useState(mode !== 'capture');
    const [searchQueries, setSearchQueries] = useState<any[]>([]);
    const [summary, setSummary] = useState<string>('');
    const [transcript, setTranscript] = useState<string>('');
    const [editableTitle, setEditableTitle] = useState(title || 'Untitled Recording');
    //recordingStartTimestamp is set when recording starts, and used for display and memory storage
    const [recordingStartTimestamp, setRecordingStartTimestamp] = useState<string | null>(null);
    const formattedDate = recordingStartTimestamp
      ? `${new Date(recordingStartTimestamp).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        })} • ${new Date(recordingStartTimestamp).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })}`
      : '';
    const [recordingTime, setRecordingTime] = useState(0);
    const [memoryId, setMemoryId] = useState<string | null>(routeMemoryId || null); // For storing generated memory id
    const [chunks, setChunks] = useState<string[]>([]); // Store chunk texts or paths

    const recorder = new AudioRecorderPlayer();
    const isRecordingRef = useRef(false);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const recordedChunks = useRef<string[]>([]);

    const transcribeChunk = async (filePath: string) => {
        try {
            const exists = await RNFS.exists(filePath);
            if (!exists) {
                console.warn(`[transcribeChunk] File does not exist: ${filePath}`);
                return null;
            }
            const stat = await RNFS.stat(filePath);
            console.log(`[transcribeChunk] File: ${filePath}, Exists: ${exists}, Size: ${stat.size}`);

            // Skip tiny chunks (<2KB) which are likely silence or incomplete
            if (stat.size < 2048) {
                console.log('[transcribeChunk] Chunk too small, skipping transcription.');
                await RNFS.unlink(filePath);
                return null;
            }

            if (stat.size === 0) {
                console.warn('Empty file, skipping transcription.');
                return null;
            }

            const uri = Platform.OS === 'android' ? `file://${filePath}` : filePath;
            const fileName = filePath.split('/').pop();

            console.log('[transcribeChunk] Uploading file:', { uri, type: 'audio/m4a', name: fileName, size: stat.size });

            const formData = new FormData();
            formData.append('file', {
                uri,
                type: 'audio/m4a',
                name: fileName,
            } as any);
            formData.append('model', 'whisper-1');
            formData.append('language', 'en');

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
        } catch (err: unknown) {
            const errorMessage =
                typeof err === 'object' && err !== null && 'response' in err
                    ? (err as any).response?.data || 'Unknown response error'
                    : (err as Error).message;

            console.warn('[transcribeChunk] Failed with error:', errorMessage);
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
        } catch (err) {
            console.error('Error generating summary:', err);
            Alert.alert(
                'Summary Error',
                'Failed to generate summary. Please try again later.',
                [{ text: 'OK' }]
            );
            return '';
        }
    };

    const recordChunk = async () => {
        const chunkId = `chunk_${Date.now()}`;
        const path = `${RNFS.DocumentDirectoryPath}/${chunkId}.m4a`;

        
        try {
            await recorder.stopRecorder();
            recorder.removeRecordBackListener();
            await new Promise((resolve) => setTimeout(resolve, 200));
        } catch (e) {
            console.log('[recordChunk] No active recorder to stop.');
        }

        try {
            // Check if file already exists before starting a new recorder
            const exists = await RNFS.exists(path);
            if (exists) {
                console.warn(`[recordChunk] Chunk file already exists, will not overwrite: ${path}`);
                return;
            }
            // Prevent duplicate startRecorder if already recording
            if (isRecordingRef.current) {
                console.warn('[recordChunk] Recording already in progress. Skipping duplicate call.');
                return;
            }
            await recorder.startRecorder(path);
            isRecordingRef.current = true;
            setTimeout(async () => {
                try {
                    await recorder.stopRecorder();
                    isRecordingRef.current = false;

                    let transcriptChunk: string | null = null;
                    for (let attempt = 1; attempt <= 2; attempt++) {
                        try {
                            transcriptChunk = await transcribeChunk(path);
                            if (transcriptChunk) break;
                        } catch (err) {
                            console.warn(`Transcription attempt ${attempt} failed`, err);
                        }
                    }

                    if (transcriptChunk) {
                        recordedChunks.current.push(transcriptChunk);
                        setChunks((prev) => [...prev, transcriptChunk]);
                    } else {
                        // Delete the file if it fails transcription to prevent infinite retry loops
                        console.warn('Transcription failed after retries. Deleting chunk:', path);
                        try {
                            await RNFS.unlink(path);
                        } catch (unlinkErr) {
                            console.warn('[recordChunk] Failed to delete chunk (maybe already removed):', path, unlinkErr);
                        }
                    }
                } catch (e) {
                    console.error('Error stopping recorder or transcribing:', e);
                }
            }, 30000);
        } catch (e) {
            console.error('Failed to start recording chunk:', e);
        }
    };

  const startRecording = async () => {
    // Request microphone permission on Android
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert(
          'Permission Denied',
          'Microphone access is required to record audio.',
          [{ text: 'OK' }]
        );
        return;
      }
    }
    isRecordingRef.current = true;
    // Generate memoryId if not already present
    if (!memoryId) {
      const newId = uuid.v4() as string;
      setMemoryId(newId);
    }
    // Set the start timestamp for this recording session
    const now = new Date().toISOString();
    setRecordingStartTimestamp(now);
    const startTime = Date.now();
    setRecordingTime(0);
    await recordChunk();
    intervalRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      setRecordingTime(elapsed);
      recordChunk();
    }, 30000);
  };

    const stopRecording = async () => {
        isRecordingRef.current = false;
        if (intervalRef.current) clearInterval(intervalRef.current);
        // Combine transcript chunks
        const combinedTranscript = recordedChunks.current.join('\n');
        setTranscript(combinedTranscript);
        // Generate summary
        const summaryResult = await generateSummary(combinedTranscript);
        setSummary(summaryResult);
        setRecordingStopped(true);
        setTab('notes');
        setSearchQueries([]);
        // Store the latest transcript for chat screen retrieval
        try {
            await AsyncStorage.setItem('LATEST_TRANSCRIPT', combinedTranscript || '');
        } catch (err) {
            console.error('Error saving LATEST_TRANSCRIPT:', err);
        }
        // --- Persist to local AsyncStorage ---
        try {
            // Use the memoryId generated at startRecording
            let memId = memoryId;
            if (!memId) {
                memId = uuid.v4() as string;
                setMemoryId(memId);
            }
            const memory = {
                id: memId,
                title: editableTitle,
                timestamp: recordingStartTimestamp || new Date().toISOString(),
                duration: new Date(recordingTime * 1000).toISOString().substr(11, 8),
                transcript: combinedTranscript,
                notes: summaryResult,
                questions: searchQueries,
                chunks: [...recordedChunks.current],
            };

            const existingMemoriesJson = await AsyncStorage.getItem('SAVED_MEMORIES');
            const existingMemories = existingMemoriesJson ? JSON.parse(existingMemoriesJson) : [];

            const memoryIndex = existingMemories.findIndex((m: any) => m.id === memId);
            if (memoryIndex !== -1) {
                const existingMemory = existingMemories[memoryIndex];
                const updatedQuestions = [
                    ...(existingMemory.questions || []),
                    ...searchQueries.map(q => ({ question: q, timestamp: new Date().toISOString() })),
                ];
                existingMemories[memoryIndex] = {
                    ...memory,
                    questions: updatedQuestions,
                };
            } else {
                memory.questions = searchQueries.map(q => ({ question: q, timestamp: new Date().toISOString() }));
                existingMemories.push(memory);
            }

            await AsyncStorage.setItem('SAVED_MEMORIES', JSON.stringify(existingMemories));
            await AsyncStorage.setItem('LATEST_MEMORY_ID', memId);
            console.log('Updated memories: ' + JSON.stringify(existingMemories));
        } catch (err) {
            console.error('Error saving memory locally:', err);
        }
    };

    useEffect(() => {
        const loadMemory = async () => {
            if (mode !== 'capture' && routeMemoryId) {
                const stored = await AsyncStorage.getItem('SAVED_MEMORIES');
                if (stored) {
                    const memories = JSON.parse(stored);
                    // only use memory with matching id
                    const memory = memories.find((m: any) => m.id === routeMemoryId);
                    if (memory) {
                        setEditableTitle(memory.title || '');
                        setTranscript(memory.transcript || '');
                        setSummary(memory.notes || '');
                        setSearchQueries(
                            Array.isArray(memory.questions)
                                ? memory.questions.filter((q: any) => q && q.question && q.question.trim() !== '')
                                : []
                        );
                        setRecordingStopped(true);
                        setTab('notes');
                        // Set recordingStartTimestamp for consistent display
                        if (memory.timestamp) setRecordingStartTimestamp(memory.timestamp);
                    } else {
                        // If not found, clear out state to avoid leaking data from other memories
                        setEditableTitle('');
                        setTranscript('');
                        setSummary('');
                        setSearchQueries([]);
                        setRecordingStartTimestamp(null);
                    }
                } else {
                    // No memories, clear out state
                    setEditableTitle('');
                    setTranscript('');
                    setSummary('');
                    setSearchQueries([]);
                    setRecordingStartTimestamp(null);
                }
            }
        };
        loadMemory();

        let timerInterval: NodeJS.Timeout | null = null;
        if (mode === 'capture') {
            startRecording();
            // Set the timestamp for display immediately on mount for new captures
            if (!recordingStartTimestamp) {
                const now = new Date().toISOString();
                setRecordingStartTimestamp(now);
            }
            // Retry untranscribed chunks if any
            (async () => {
              try {
                const files = await RNFS.readDir(RNFS.DocumentDirectoryPath);
                const untranscribedFiles = files
                  .filter(f => f.name.startsWith('chunk_') && f.name.endsWith('.m4a'))
                  .map(f => `${RNFS.DocumentDirectoryPath}/${f.name}`);

                for (const filePath of untranscribedFiles) {
                  try {
                    // Check for file existence before transcription
                    const exists = await RNFS.exists(filePath);
                    if (!exists) {
                      console.warn('[Retry untranscribed] File does not exist, skipping:', filePath);
                      continue;
                    }
                    const text = await transcribeChunk(filePath);
                    if (text) {
                      recordedChunks.current.push(text);
                      setChunks(prev => [...prev, text]);
                      try {
                        await RNFS.unlink(filePath);
                      } catch (unlinkErr) {
                        console.warn('[Retry untranscribed] Failed to delete chunk (maybe already removed):', filePath, unlinkErr);
                      }
                    }
                  } catch (err) {
                    console.warn('Retry transcription failed for:', filePath, err);
                  }
                }
              } catch (err) {
                console.error('Error scanning for untranscribed files:', err);
              }
            })();

            timerInterval = setInterval(() => {
                setRecordingTime((prev) => prev + 1);
            }, 1000);
        }
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (timerInterval) clearInterval(timerInterval);
            recorder.stopRecorder();
        };
    }, []);

    const renderTabContent = () => {
        switch (tab) {
            case 'searches':
                return (
                    <ScrollView style={styles.content}>
                        {recordingStopped ? (
                            searchQueries.map((q, i) => (
                              <TouchableOpacity key={i} style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor: '#fff',
                                marginVertical: 6,
                                padding: 12,
                                borderRadius: 12,
                                elevation: 1,
                              }}>
                                <Text style={{ fontSize: 18, marginRight: 10 }}>💬</Text>
                                <View style={{ flex: 1 }}>
                                  <Text style={{ fontSize: 14, color: '#000' }}>{q.question}</Text>
                                </View>
                              </TouchableOpacity>
                            ))
                        ) : (
                            <Text>No searches made yet.</Text>
                        )}
                    </ScrollView>
                );
            case 'notes':
                return (
                    <ScrollView style={styles.content}>
                        <Markdown>{summary}</Markdown>
                    </ScrollView>
                );
            case 'transcript':
                return (
                    <ScrollView style={styles.content}>
                        {transcript.split('\n').map((chunk, index) => {
                          const seconds = index * 30;
                          const hrs = Math.floor(seconds / 3600);
                          const mins = Math.floor((seconds % 3600) / 60);
                          const secs = seconds % 60;
                          const formatted = [hrs, mins, secs]
                            .map(unit => unit.toString().padStart(2, '0'))
                            .join(':');
                          return (
                            <View key={index} style={{ marginBottom: 24 }}>
                              <Text style={{ fontWeight: '600', color: '#003f77', fontSize: 15, marginBottom: 4 }}>
                                {formatted}
                              </Text>
                              <Text style={{ fontSize: 15, color: '#222', lineHeight: 22 }}>
                                {chunk.trim()}
                              </Text>
                            </View>
                          );
                        })}
                    </ScrollView>
                );
        }
    };

    return (
        <View style={styles.container}>
            {/* Header row with Android back arrow and share icon */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 6 }}>
                    <Text style={{ color: '#0D4A86' }}>Back</Text>
                </TouchableOpacity>

                {mode === 'capture' && !recordingStopped && (
                    <View style={{
                        backgroundColor: '#fff4f4',
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 8,
                    }}>
                        <Text style={{ color: '#d00', fontWeight: '600' }}>
                            🔴 {new Date(recordingTime * 1000).toISOString().substr(11, 8)}
                        </Text>
                    </View>
                )}

                <TouchableOpacity onPress={() => { /* share logic here */ }} style={{ padding: 6 }}>
                    <Text style={{ color: '#0D4A86' }}>Share</Text>
                </TouchableOpacity>
            </View>
            {/* Top header details */}
            <View style={{ marginBottom: 16 }}>
                {mode === 'capture' && !recordingStopped ? (
                    <TextInput
                        value={editableTitle}
                        onChangeText={setEditableTitle}
                        style={styles.titleInput}
                        placeholder="Enter recording title"
                    />
                ) : (
                    <>
                    <Text style={{ fontSize: 20, fontWeight: '700', marginBottom: 4 }}>
                        {editableTitle}
                    </Text>
                     </>
                )}
                {!mode || recordingStopped ? (
                  <Text style={{ color: '#666' }}>{formattedDate}</Text>
                ) : null}
            </View>

            {/* Tab row with pill UI */}
            <View style={styles.tabRow}>
                <TouchableOpacity onPress={() => setTab('searches')} disabled={!recordingStopped}>
                    <Text style={[
                        styles.tabText,
                        tab === 'searches' && styles.activeTab
                    ]}>
                        {recordingStopped ? 'Questions' : 'Searches'}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setTab('notes')} disabled={!recordingStopped}>
                    <Text style={[
                        styles.tabText,
                        tab === 'notes' && styles.activeTab
                    ]}>Notes</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setTab('transcript')} disabled={!recordingStopped}>
                    <Text style={[
                        styles.tabText,
                        tab === 'transcript' && styles.activeTab
                    ]}>Transcript</Text>
                </TouchableOpacity>
            </View>

            {/* Main content */}
            {mode === 'capture' && !recordingStopped ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    {/* Listening UI */}
                    <View style={{ alignItems: 'center', marginVertical: 20 }}>
                        {/* <View style={{ width: 48, height: 48, backgroundColor: '#eee', borderRadius: 24, marginBottom: 12 }} /> */}
                        <Text style={{ fontSize: 16, fontWeight: '600', color: '#003f77', textAlign: 'center' }}>
                            TwinMind is listening in the background
                        </Text>
                        <Text style={{ textAlign: 'center', color: '#555', marginTop: 6 }}>
                            Leave it on during your <Text style={{ backgroundColor: 'yellow' }}>meeting</Text> or conversations.
                        </Text>
                    </View>
                    {/* CTA Button */}
                    <TouchableOpacity style={{ backgroundColor: '#003f77', borderRadius: 30, paddingVertical: 12, paddingHorizontal: 24, alignSelf: 'center', marginTop: 10 }}>
                        <Text style={{ color: '#fff', fontWeight: '600' }}>✨ Tap to Get Answer</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                renderTabContent()
            )}

            {/* Footer */}
            {mode === 'capture' && !recordingStopped ? (
                <View style={{ flex: 1, justifyContent: 'flex-end' }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <TouchableOpacity
                            style={{ backgroundColor: '#e5f0fb', padding: 12, borderRadius: 20, opacity: 0.5 }}
                            onPress={() => navigation.navigate('TranscriptChat')}
                            disabled={true}
                        >
                            <Text>💬 Chat with Transcript</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={{ backgroundColor: '#ffecec', padding: 12, borderRadius: 20 }}
                            onPress={stopRecording}
                        >
                            <Text style={{ color: '#d00' }}>⏹ Stop</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            ) : (
                <View style={{ marginTop: 20 }}>
                    <TouchableOpacity
                        style={{ backgroundColor: '#e5f0fb', padding: 12, borderRadius: 20 }}
                        onPress={() => navigation.navigate('TranscriptChat')}
                    >
                        <Text>💬 Chat with Transcript</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, backgroundColor: '#fff' },
    tabRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        backgroundColor: '#f0f0f0',
        borderRadius: 20,
        paddingVertical: 6,
        marginBottom: 12,
    },
    tabText: {
        paddingVertical: 8,
        paddingHorizontal: 16,
        fontSize: 14,
        borderRadius: 20,
        backgroundColor: '#fff',
        overflow: 'hidden',
        color: '#222',
    },
    activeTab: {
        backgroundColor: '#003f77',
        color: '#fff',
    },
    disabledTab: { opacity: 0.3 },
    content: { flex: 1 },
    footer: { marginTop: 10 },
    titleInput: {
        fontSize: 20,
        fontWeight: '700',
        marginBottom: 4,
        borderBottomWidth: 1,
        borderColor: '#ccc',
        paddingVertical: 4,
    },
});