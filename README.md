TwinMind Android App

This project is a React Native implementation of the Android Developer Interview Assignment. The application replicates core functionalities of the reference iOS app, focusing on transcription, calendar integration, and AI-powered user interaction.

Implemented Features

1. User Authentication
	•	Integrated Google Sign-In using Firebase Authentication.
	•	Login functionality is implemented in LoginScreen.tsx, allowing secure user access.

2. Google Calendar Integration
	•	Users can authenticate and view upcoming calendar events in CalendarScreen.tsx.
	•	Calendar data is retrieved using the OAuth token obtained from Google Sign-In.

3. Real-Time Meeting Transcription
	•	Audio recording is handled via react-native-audio-recorder-player, saving audio in 30-second chunks.
	•	Transcription is processed using OpenAI’s Speech-to-Text API.
	•	Implements offline-first behavior: audio is buffered to local storage and automatically retried upon network availability.
	•	Transcripts are displayed under the Transcript tab in MemoryDetailScreen.tsx.

4. AI-Powered Interaction
	•	A chat interface in TranscriptChatScreen.tsx enables users to ask questions based on recorded content for a particular memory.
	•	Transcripts are sent to OpenAI’s API, and responses are rendered contextually.
    •   Similarly, a chat interface in AskAllMemoriesScreen.tsx enables users to ask questions based on all previously recorded content of all memories.

5. Memory Management and Visualization
	•	Recorded sessions "Memories" are listed in HomeScreen.tsx.
	•	Each memory displays duration, date, and content summary.
	•	The application tracks total memory duration and presents it with a progress bar toward a 100-hour milestone.
	•	Recording summaries and notes are handled within MemoryDetailScreen.tsx.

6. UI and Navigation
	•	Tab-based navigation for Memories, Calendar, and Questions is implemented via AppNavigator.tsx.
	•	The UI is styled to reflect the layout and behavior of the iOS reference app.
	•	Pro feature indicators, badge styling, and screen transitions are visually aligned with the design guidelines.


Planned Enhancements (Pending Due to Time Constraints):
	•	Persistent backend storage of transcripts, notes, and chat queries.
    •   To display transcripts in real-time under the Transcript tab.
	•	Enhanced state management using a centralized store (e.g., Redux).
	•	Automated testing and CI/CD integration.


Environment Setup

Create a .env file at the root of the project and define the following variables:

OPENAI_API_KEY=your_openai_api_key
WEB_CLIENT_ID=your_firebase_web_client_id

These are required for API communication and Google authentication.

Running the Application

1.	Clone the repository.

2.	Install dependencies:
        npm install
        
3.  Start the application:
        npx react-native run-android