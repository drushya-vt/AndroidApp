// app/navigation/AppNavigator.tsx
import React, { useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from '../screens/LoginScreen'; // Adjust path as needed
import CalendarScreen from '../screens/CalendarScreen'; // Adjust path as needed
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import TranscriptionScreen from '../screens/TranscriptionScreen';
import TranscriptChatScreen from '../screens/TranscriptChatScreen';
import AskAllMemoriesScreen from '../screens/AskAllMemoriesScreen';
import MemoryDetailScreen from '../screens/MemoryDetailScreen';
import QuestionsScreen from '../screens/QuestionsScreen';
import HomeScreen from '../screens/HomeScreen';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
    const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);

    useEffect(() => {
        const unsubscribe = auth().onAuthStateChanged(user => {
            setUser(user);
            console.log("Auth state changed. User: ", user);
        });
        return () => unsubscribe();
    }, []);

    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            {user ? (
                <>
                    <Stack.Screen name="Home" component={HomeScreen} />
                    <Stack.Screen name="Calendar" component={CalendarScreen} />
                    <Stack.Screen name="Transcription" component={TranscriptionScreen} />
                    <Stack.Screen name="TranscriptChat" component={TranscriptChatScreen} />
                    <Stack.Screen name="AskAllMemories" component={AskAllMemoriesScreen} />
                    <Stack.Screen name="MemoryDetail" component={MemoryDetailScreen} />
                    <Stack.Screen name="Questions" component={QuestionsScreen} />
                </>
            ) : (
                <Stack.Screen name="Login" component={LoginScreen} />
            )}
        </Stack.Navigator>
    );
}