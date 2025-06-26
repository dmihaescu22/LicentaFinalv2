import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../config/firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

export default function RegisterScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [fullName, setFullName] = useState('');

  const handleRegister = async () => {
    if (!email || !password || !username || !phone || !fullName) {
      Alert.alert('Eroare', 'Toate câmpurile sunt obligatorii!');
      return;
    }
    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      // userCred.user.uid e id-ul

      // Creez doc "users/{uid}"
      const userId = userCred.user.uid;
      const userRef = doc(db, 'users', userId);
      const userDoc = {
        userId: userId,
        displayName: username,
        email: email,
        phone: phone,
        level: 'Hiking Enthusiast', // default
        profilePhotoUrl: 'https://ui-avatars.com/api/?name=' + encodeURIComponent(fullName) + '&background=random',
        createdAt: serverTimestamp(),
        friends: [], // Lista de ID-uri ale prietenilor
        friendRequests: [], // Cereri de prietenie primite
        sentFriendRequests: [], // Cereri de prietenie trimise
        notifications: [] // Notificări pentru cereri de prietenie
      };
      await setDoc(userRef, userDoc);

      Alert.alert('Succes', 'Cont creat cu succes!');
      navigation.navigate('Login');
    } catch (error) {
      Alert.alert('Eroare', error.message);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        {/* Titlu și subtitlu */}
        <Text style={styles.title}>Create an account</Text>
        <Text style={styles.subtitle}>Connect with your friends today!</Text>

        {/* Câmpuri de input */}
        <TextInput
          style={styles.input}
          placeholder="Enter Your Username"
          placeholderTextColor="#999"
          value={username}
          onChangeText={setUsername}
        />
        <TextInput
          style={styles.input}
          placeholder="Enter Your Email"
          placeholderTextColor="#999"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Enter Your Password"
          placeholderTextColor="#999"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />
        <TextInput
          style={styles.input}
          placeholder="Enter Your Phone Number"
          placeholderTextColor="#999"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
        <TextInput
          style={styles.input}
          placeholder="Enter Your Full Name"
          placeholderTextColor="#999"
          value={fullName}
          onChangeText={setFullName}
        />

        {/* Buton de înregistrare */}
        <TouchableOpacity style={styles.registerButton} onPress={handleRegister}>
          <Text style={styles.registerButtonText}>Register</Text>
        </TouchableOpacity>

        {/* Link către Login */}
        <Text style={styles.loginLink}>
          Already have an account?{' '}
          <Text
            style={styles.loginLinkText}
            onPress={() => navigation.navigate('Login')}
          >
            Login
          </Text>
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 5,
    marginTop: 50,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 50,
  },
  input: {
    width: '90%',
    height: 50,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    paddingHorizontal: 15,
    marginBottom: 15,
    backgroundColor: '#F9F9F9',
  },
  registerButton: {
    backgroundColor: '#556B2F',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    width: '90%',
    marginTop: 10,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 5,
    elevation: 3,
  },
  registerButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
  loginLink: {
    marginTop: 280,
    fontSize: 14,
    color: '#333',
  },
  loginLinkText: {
    color: '#556B2F',
    fontWeight: 'bold',
  },
});
