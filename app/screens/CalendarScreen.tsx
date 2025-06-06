import React, { useEffect, useState } from 'react';
import { View, Text, FlatList } from 'react-native';
import { parseISO, format, isSameDay } from 'date-fns';
import { TouchableOpacity } from 'react-native';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import axios from 'axios';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types'; 

export default function CalendarScreen() {
    const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
    const [events, setEvents] = useState<any[]>([]);

    useEffect(() => {
        const fetchCalendarEvents = async () => {
            try {
                const tokens = await GoogleSignin.getTokens(); // contains accessToken

                const response = await axios.get(
                    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
                    {
                        headers: {
                            Authorization: `Bearer ${tokens.accessToken}`,
                        },
                        params: {
                            maxResults: 10,
                            timeMin: new Date().toISOString(),
                            orderBy: 'startTime',
                            singleEvents: true,
                        },
                    }
                );

                setEvents(response.data.items);
            } catch (err) {
                console.error('Error fetching events', err);
            }
        };

        fetchCalendarEvents();
    }, []);

    return (
        <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 20, backgroundColor: '#f9fafc' }}>
            <FlatList
              data={events}
              keyExtractor={(item) => item.id}
              renderItem={({ item, index }) => {
                const eventDate = parseISO(item.start?.dateTime || item.start?.date);
                const showDateHeader =
                  index === 0 ||
                  !isSameDay(
                    parseISO(events[index - 1]?.start?.dateTime || events[index - 1]?.start?.date),
                    eventDate
                  );

                const startTime = format(parseISO(item.start?.dateTime || item.start?.date), 'h:mm a');
                const endTime = item.end?.dateTime
                  ? format(parseISO(item.end.dateTime), 'h:mm a')
                  : null;

                return (
                  <View style={{ marginBottom: 10 }}>
                    {showDateHeader && (
                      <Text style={{ fontSize: 16, fontWeight: '500', marginVertical: 12, color: '#888' }}>
                        {format(eventDate, 'EEE, MMM d')}
                      </Text>
                    )}
                    <View
                      style={{
                        backgroundColor: '#f7f7f7',
                        padding: 12,
                        borderRadius: 14,
                        marginBottom: 10,
                        flexDirection: 'row',
                        alignItems: 'center',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 0.5 },
                        shadowOpacity: 0.02,
                        shadowRadius: 0.5,
                        elevation: 1,
                        width: '100%',
                      }}
                    >
                      <View style={{ width: 4, height: '100%', backgroundColor: '#c4c4c4', borderRadius: 2, marginRight: 10 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: '500', color: '#000', marginBottom: 2 }}>
                          {item.summary}
                        </Text>
                        <Text style={{ fontSize: 13, color: '#444' }}>
                          {startTime}{endTime ? ` - ${endTime}` : ''}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              }}
            />
        </View>
    );
}