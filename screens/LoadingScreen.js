import React, { useEffect } from 'react';
import { View, StyleSheet, Image } from 'react-native';
import logo from '../assets/images/logo.png';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase';

export default function LoadingScreen({ navigation }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (user) {
          console.log('User logged in:', user);
          navigation.replace('Main'); 
        } else {
          console.log('No user logged in');
          navigation.replace('Auth');
        }
      });

      return () => unsubscribe();
    }, 2000); // Așteaptă 2 secunde înainte de a verifica autentificarea

    return () => clearTimeout(timer); // Curăță timer-ul la demontare
  }, []);

  return (
    <View style={styles.container}>
      <Image source={logo} style={styles.logo} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#556B2F',
  },
  logo: {
    width: 500,
    height: 500,
    resizeMode: 'contain',
  },
});
