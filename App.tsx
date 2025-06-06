import { NavigationContainer } from '@react-navigation/native';
import AppNavigator from './app/navigation/AppNavigator';
import { Provider as PaperProvider } from 'react-native-paper';

export default function App() {
  return (
    <PaperProvider>
    <NavigationContainer>
      <AppNavigator />
    </NavigationContainer>
    </PaperProvider>
  );
}