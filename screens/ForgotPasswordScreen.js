import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Image,
    KeyboardAvoidingView,
    Platform,
    Alert,
} from 'react-native';
import { auth } from '../config/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';

export default function ForgotPasswordScreen({ navigation }) {
    const [email, setEmail] = useState('');

    const handleResetPassword = async () => {
        if (!email) {
            Alert.alert('Eroare', 'Te rugăm să introduci adresa de email.');
            return;
        }

        // Validare simplă pentru email
        if (!email.includes('@')) {
            Alert.alert('Eroare', 'Te rugăm să introduci o adresă de email validă.');
            return;
        }

        try {
            await sendPasswordResetEmail(auth, email);
            Alert.alert(
                'Email trimis',
                'Un email de resetare a parolei a fost trimis. Te rugăm să verifici inbox-ul tău.',
                [
                    {
                        text: 'OK',
                        onPress: () => navigation.navigate('Login')
                    }
                ]
            );
        } catch (error) {
            console.error('Eroare la trimiterea email-ului:', error);
            Alert.alert('Eroare', 'Nu s-a putut trimite email-ul de resetare. Te rugăm să încerci din nou.');
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <TouchableOpacity
                style={styles.backButton}
                onPress={() => navigation.goBack()}
            >
                <Text style={styles.backButtonText}>←</Text>
            </TouchableOpacity>

            <View style={styles.content}>
                <Text style={styles.title}>Forgot Password?</Text>

                <Image
                    source={require('../assets/forgot-password.png')}
                    style={styles.image}
                />

                <Text style={styles.subtitle}>
                    Introdu adresa ta de email pentru a primi instrucțiuni de resetare a parolei.
                </Text>

                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter your email"
                        placeholderTextColor="#000"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                    />
                </View>

                <TouchableOpacity
                    style={styles.nextButton}
                    onPress={handleResetPassword}
                >
                    <Text style={styles.nextButtonText}>Trimite</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    backButton: {
        position: 'absolute',
        top: 50,
        left: 20,
        zIndex: 1,
        padding: 10,
    },
    backButtonText: {
        fontSize: 28,
        color: '#333',
    },
    content: {
        flex: 1,
        alignItems: 'center',
        paddingHorizontal: 20,
        justifyContent: 'center',
        paddingTop: 0,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 40,
        color: '#333',
    },
    image: {
        width: 200,
        height: 200,
        marginBottom: 40,
        resizeMode: 'contain',
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        marginBottom: 40,
        lineHeight: 24,
    },
    inputContainer: {
        width: '100%',
        marginBottom: 30,
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 12,
        padding: 15,
        fontSize: 16,
        backgroundColor: '#F9F9F9',
        color: '#333',
    },
    nextButton: {
        backgroundColor: '#556B2F',
        paddingVertical: 15,
        borderRadius: 12,
        alignItems: 'center',
        width: '100%',
    },
    nextButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 18,
    },
}); 