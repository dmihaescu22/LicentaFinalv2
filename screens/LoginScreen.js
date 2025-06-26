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

import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../config/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { CommonActions } from '@react-navigation/native';

const CustomCheckBox = ({ value, onValueChange }) => {
  return (
    <TouchableOpacity
      style={[
        styles.checkbox,
        { backgroundColor: value ? '#556B2F' : '#FFF' },
      ]}
      onPress={() => onValueChange(!value)}
    >
      {value && <View style={styles.checkboxInner} />}
    </TouchableOpacity>
  );
};

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const handleLogin = async () => {
    console.log('Încercare de autentificare...');

    if (!email || !password) {
      Alert.alert('Eroare', 'Te rugăm să completezi toate câmpurile.');
      return;
    }

    try {
      console.log('Autentificare cu:', email);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      console.log('Autentificare reușită:', userCredential.user.uid);

      // Verificăm dacă utilizatorul există în Firestore
      const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
      console.log('Date utilizator:', userDoc.exists() ? 'găsite' : 'nu există');

      if (!userDoc.exists()) {
        console.log('Utilizatorul nu există în Firestore');
        Alert.alert('Eroare', 'Nu s-au găsit datele utilizatorului.');
        await auth.signOut(); // Deconectăm utilizatorul dacă nu există în Firestore
      }

    } catch (error) {
      console.error('Eroare la autentificare:', error.message);
      Alert.alert('Eroare', 'Email sau parolă incorectă.');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        {/* Titlu */}
        <Text style={styles.title}>Hi, Welcome Back! 👋</Text>

        {/* Email Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Email</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your email"
            placeholderTextColor="#000"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
        </View>

        {/* Password Input */}
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your password"
            placeholderTextColor="#000"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />
        </View>

        {/* Remember Me și Forgot Password */}
        <View style={styles.row}>
          <View style={styles.checkboxContainer}>
            <CustomCheckBox
              value={rememberMe}
              onValueChange={setRememberMe}
            />
            <Text style={styles.checkboxLabel}>Remember Me</Text>
          </View>
          <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')}>
            <Text style={styles.forgotPassword}>Forgot Password?</Text>
          </TouchableOpacity>
        </View>

        {/* Login Button */}
        <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
          <Text style={styles.loginButtonText}>Login</Text>
        </TouchableOpacity>
      </View>

      {/* Register Link */}
      <View style={styles.footer}>
        <Text style={styles.registerLink}>
          Don't have an account?{' '}
          <Text
            style={styles.registerText}
            onPress={() => navigation.navigate('Register')}
          >
            Sign up
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
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 40,
    marginTop: -60,
    color: '#333',
  },
  inputGroup: {
    marginBottom: 15,
    width: '85%',
  },
  inputLabel: {
    fontSize: 14,
    color: '#333',
    marginBottom: 5,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 15,
    height: 50,
    fontSize: 16,
    backgroundColor: '#F9F9F9',
    color: '#333',
    placeholderTextColor: '#000',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
    width: '85%',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 1,
    borderColor: '#556B2F',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    borderRadius: 4,
  },
  checkboxInner: {
    width: 12,
    height: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#333',
  },
  forgotPassword: {
    color: '#FF4500',
    fontSize: 14,
    fontWeight: 'bold',
  },
  loginButton: {
    backgroundColor: '#556B2F',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 30,
    width: '85%',
  },
  loginButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 18,
  },
  footer: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 20,
  },
  registerLink: {
    textAlign: 'center',
    fontSize: 14,
    color: '#333',
  },
  registerText: {
    color: '#556B2F',
    fontWeight: 'bold',
  },
});
