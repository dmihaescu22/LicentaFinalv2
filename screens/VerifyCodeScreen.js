import React, { useState, useRef } from 'react';
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

export default function VerifyCodeScreen({ navigation, route }) {
    const { contactMethod, contact } = route.params;
    const [code, setCode] = useState(['', '', '', '']);
    const inputs = useRef([]);

    const handleCodeChange = (text, index) => {
        if (text.length > 1) {
            text = text[0];
        }

        const newCode = [...code];
        newCode[index] = text;
        setCode(newCode);

        // Mutăm focusul la următorul input
        if (text !== '' && index < 3) {
            inputs.current[index + 1].focus();
        }
    };

    const handleKeyPress = (e, index) => {
        if (e.nativeEvent.key === 'Backspace' && index > 0 && code[index] === '') {
            inputs.current[index - 1].focus();
        }
    };

    const handleVerify = () => {
        const verificationCode = code.join('');
        if (verificationCode.length !== 4) {
            Alert.alert('Eroare', 'Te rugăm să introduci codul complet.');
            return;
        }

        // Aici ar trebui să verificăm codul cu Firebase
        // Pentru moment, doar navigăm către ecranul de resetare parolă
        navigation.navigate('NewPassword');
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <View style={styles.content}>
                <Text style={styles.title}>Verify</Text>
                <Text style={styles.subtitle}>
                    Please enter the verification code sent to your {contactMethod}
                </Text>

                <View style={styles.codeContainer}>
                    {[0, 1, 2, 3].map((index) => (
                        <TextInput
                            key={index}
                            ref={(input) => (inputs.current[index] = input)}
                            style={styles.codeInput}
                            maxLength={1}
                            keyboardType="number-pad"
                            value={code[index]}
                            onChangeText={(text) => handleCodeChange(text, index)}
                            onKeyPress={(e) => handleKeyPress(e, index)}
                        />
                    ))}
                </View>

                <TouchableOpacity style={styles.verifyButton} onPress={handleVerify}>
                    <Text style={styles.verifyButtonText}>Verify</Text>
                </TouchableOpacity>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>Didn't receive code? </Text>
                    <TouchableOpacity onPress={() => {/* Implementează retrimiterea codului */ }}>
                        <Text style={styles.resendText}>Resend</Text>
                    </TouchableOpacity>
                </View>
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
        marginBottom: 10,
        color: '#333',
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
        marginBottom: 40,
    },
    codeContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '80%',
        marginBottom: 40,
    },
    codeInput: {
        width: 50,
        height: 50,
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 10,
        fontSize: 24,
        textAlign: 'center',
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
    footer: {
        flexDirection: 'row',
        marginTop: 30,
        alignItems: 'center',
    },
    footerText: {
        fontSize: 14,
        color: '#666',
    },
    resendText: {
        fontSize: 14,
        color: '#556B2F',
        fontWeight: 'bold',
    },
}); 