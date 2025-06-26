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
    Modal,
    Image,
} from 'react-native';
import { auth } from '../config/firebase';
import { confirmPasswordReset } from 'firebase/auth';

export default function NewPasswordScreen({ navigation }) {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showSuccessModal, setShowSuccessModal] = useState(false);

    const handleResetPassword = async () => {
        if (!password || !confirmPassword) {
            Alert.alert('Eroare', 'Te rugăm să completezi ambele câmpuri.');
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert('Eroare', 'Parolele nu coincid.');
            return;
        }

        if (password.length < 6) {
            Alert.alert('Eroare', 'Parola trebuie să aibă cel puțin 6 caractere.');
            return;
        }

        try {
            // Aici ar trebui să implementăm logica de resetare a parolei cu Firebase
            // await confirmPasswordReset(auth, code, password);

            setShowSuccessModal(true);
            setTimeout(() => {
                setShowSuccessModal(false);
                navigation.navigate('Login');
            }, 2000);
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
                <Text style={styles.title}>Create a New Password</Text>

                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder="Enter New Password"
                        placeholderTextColor="#000"
                        secureTextEntry
                        value={password}
                        onChangeText={setPassword}
                    />
                </View>

                <View style={styles.inputContainer}>
                    <TextInput
                        style={styles.input}
                        placeholder="Confirm New Password"
                        placeholderTextColor="#000"
                        secureTextEntry
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                    />
                </View>

                <TouchableOpacity
                    style={styles.verifyButton}
                    onPress={handleResetPassword}
                >
                    <Text style={styles.verifyButtonText}>Verify</Text>
                </TouchableOpacity>

                <Modal
                    transparent={true}
                    visible={showSuccessModal}
                    animationType="fade"
                >
                    <View style={styles.modalContainer}>
                        <View style={styles.modalContent}>
                            <Image
                                source={require('../assets/success-icon.png')}
                                style={styles.successIcon}
                            />
                            <Text style={styles.congratsText}>Congratulations!</Text>
                            <Text style={styles.modalText}>
                                Password Reset Successfully!{'\n'}
                                You'll be redirected to the{'\n'}
                                login screen now.
                            </Text>
                        </View>
                    </View>
                </Modal>
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
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 40,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 40,
        color: '#333',
    },
    inputContainer: {
        width: '100%',
        marginBottom: 20,
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
    verifyButton: {
        backgroundColor: '#556B2F',
        paddingVertical: 15,
        borderRadius: 12,
        alignItems: 'center',
        width: '100%',
        marginTop: 20,
    },
    verifyButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 18,
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContent: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 30,
        alignItems: 'center',
        width: '80%',
    },
    successIcon: {
        width: 100,
        height: 100,
        marginBottom: 20,
    },
    congratsText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 10,
    },
    modalText: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        lineHeight: 24,
    },
}); 