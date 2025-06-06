import React, { useEffect, useState } from 'react';
import { Button, View, Text, Image, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import LinearGradient from 'react-native-linear-gradient';
import { WEB_CLIENT_ID } from '@env';

GoogleSignin.configure({
  webClientId: WEB_CLIENT_ID,
  scopes: ['https://www.googleapis.com/auth/calendar.readonly'],
});

export default function App() {
  const [user, setUser] = useState<FirebaseAuthTypes.User | null>(null);

  useEffect(() => {
    const subscriber = auth().onAuthStateChanged((user) => {
      console.log("Auth state changed. Current user: ", user);
      setUser(user);
    });
    return subscriber; 
  }, []);

  const onGoogleButtonPress = async () => {
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    await GoogleSignin.signIn();
    const { idToken } = await GoogleSignin.getTokens(); 

    const googleCredential = auth.GoogleAuthProvider.credential(idToken);
    await auth().signInWithCredential(googleCredential);

    console.log('User signed in:', auth().currentUser);
  } catch (err) {
    console.error('Google sign-in error', err);
  }
};

  return (
  <LinearGradient colors={['#35617B', '#DEB787']} style={styles.container}>
    <View style={styles.logoContainer}>
      <Image
        source={require('../assets/twinmind-logo.png')} 
        style={styles.logo}
        resizeMode="contain"
      />
    </View>
    <View style={styles.buttonContainer}>
      <TouchableOpacity style={styles.googleButton} onPress={onGoogleButtonPress}>
        <Text style={styles.buttonText}>ⓖ Continue with Google</Text>
      </TouchableOpacity>
    </View>
    <View style={styles.footer}>
      <Text style={styles.link} onPress={() => Linking.openURL('https://example.com/privacy')}>
        Privacy Policy
      </Text>
      <Text style={styles.link}> | </Text>
      <Text style={styles.link} onPress={() => Linking.openURL('https://example.com/terms')}>
        Terms of Service
      </Text>
    </View>
  </LinearGradient>
);

}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'linear-gradient(180deg, #35617B, #DEB787)', 
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  logoContainer: {
    flex: 2,
    justifyContent: 'center',
  },
  logo: {
    width: 200,
    height: 200,
  },
  buttonContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
  },
  googleButton: {
    backgroundColor: 'white',
    borderRadius: 32,
    paddingVertical: 14,
    paddingHorizontal: 24,
    marginVertical: 8,
    width: '90%',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    color: 'black',
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    flexDirection: 'row',
  },
  link: {
    color: 'white',
    marginHorizontal: 5,
    textDecorationLine: 'underline',
  },
});