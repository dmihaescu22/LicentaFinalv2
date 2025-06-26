import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Image,
    Alert,
    ActivityIndicator,
    ScrollView,
    SafeAreaView,
    StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../context/ThemeContext';
import { auth, db } from '../config/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { uploadToCloudinary } from '../utils/cloudinary';

export default function AddLiveUpdateScreen({ route, navigation }) {
    const { eventId, eventTitle } = route.params;
    const { colors } = useTheme();
    const [message, setMessage] = useState('');
    const [type, setType] = useState('info'); // info, warning
    const [image, setImage] = useState(null);
    const [isLoading, setIsLoading] = useState(false);

    const pickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (status !== 'granted') {
            Alert.alert('Eroare', 'Avem nevoie de permisiunea de acces la galerie pentru a încărca imagini.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [16, 9],
            quality: 0.8,
        });

        if (!result.canceled) {
            setImage(result.assets[0].uri);
        }
    };

    const handleSubmit = async () => {
        if (!message.trim()) {
            Alert.alert('Eroare', 'Te rugăm să adaugi un mesaj pentru actualizare.');
            return;
        }

        try {
            setIsLoading(true);
            let imageUrl = null;

            if (image) {
                imageUrl = await uploadToCloudinary(image);
            }

            const updateData = {
                eventId,
                userId: auth.currentUser.uid,
                message: message.trim(),
                type,
                imageUrl,
                timestamp: serverTimestamp(),
            };

            await addDoc(collection(db, 'liveUpdates'), updateData);

            Alert.alert(
                'Succes',
                'Actualizarea a fost adăugată cu succes!',
                [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
        } catch (error) {
            console.error('Error adding live update:', error);
            Alert.alert('Eroare', 'Nu am putut adăuga actualizarea. Te rugăm să încerci din nou.');
        } finally {
            setIsLoading(false);
        }
    };

    const renderTypeButton = (typeValue, icon, label) => (
        <TouchableOpacity
            style={[
                styles.typeButton,
                type === typeValue && { backgroundColor: colors.primary }
            ]}
            onPress={() => setType(typeValue)}
        >
            <Ionicons
                name={icon}
                size={24}
                color={type === typeValue ? '#fff' : colors.primary}
            />
            <Text style={[
                styles.typeButtonText,
                { color: type === typeValue ? '#fff' : colors.primary }
            ]}>
                {label}
            </Text>
        </TouchableOpacity>
    );

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar backgroundColor="#556B2F" barStyle="light-content" />
            <View style={styles.headerContainer}>
                <View style={[styles.header, { backgroundColor: '#556B2F' }]}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Adaugă Actualizare</Text>
                </View>
            </View>

            <ScrollView style={styles.content}>
                <View style={styles.typeContainer}>
                    {renderTypeButton('info', 'information-circle-outline', 'Informație')}
                    {renderTypeButton('warning', 'warning-outline', 'Avertisment')}
                </View>

                <View style={styles.inputContainer}>
                    <TextInput
                        style={[styles.input, {
                            backgroundColor: colors.cardBackground,
                            color: colors.text,
                            borderColor: colors.border
                        }]}
                        placeholder="Scrie mesajul tău aici..."
                        placeholderTextColor={colors.placeholder}
                        multiline
                        numberOfLines={4}
                        value={message}
                        onChangeText={setMessage}
                    />
                </View>

                <TouchableOpacity
                    style={[styles.imageButton, { borderColor: colors.primary }]}
                    onPress={pickImage}
                >
                    <Ionicons name="image-outline" size={24} color={colors.primary} />
                    <Text style={[styles.imageButtonText, { color: colors.primary }]}>
                        {image ? 'Schimbă imaginea' : 'Adaugă imagine'}
                    </Text>
                </TouchableOpacity>

                {image && (
                    <View style={styles.imagePreview}>
                        <Image source={{ uri: image }} style={styles.previewImage} />
                        <TouchableOpacity
                            style={styles.removeImage}
                            onPress={() => setImage(null)}
                        >
                            <Ionicons name="close-circle" size={24} color="#d32f2f" />
                        </TouchableOpacity>
                    </View>
                )}

                <TouchableOpacity
                    style={[styles.submitButton, { backgroundColor: colors.primary }]}
                    onPress={handleSubmit}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.submitButtonText}>Adaugă Actualizare</Text>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    headerContainer: {
        paddingTop: StatusBar.currentHeight + 80,
        backgroundColor: '#556B2F',
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
        marginBottom: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        marginBottom: 10,
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
        marginLeft: 16,
    },
    content: {
        flex: 1,
        padding: 20,
    },
    typeContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        padding: 20,
    },
    typeButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ddd',
        gap: 8,
    },
    typeButtonText: {
        fontSize: 14,
        fontWeight: '500',
    },
    inputContainer: {
        padding: 20,
    },
    input: {
        borderWidth: 1,
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        minHeight: 100,
        textAlignVertical: 'top',
    },
    imageButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 15,
        marginHorizontal: 20,
        borderRadius: 8,
        borderWidth: 1,
        borderStyle: 'dashed',
        gap: 8,
    },
    imageButtonText: {
        fontSize: 16,
        fontWeight: '500',
    },
    imagePreview: {
        margin: 20,
        borderRadius: 8,
        overflow: 'hidden',
    },
    previewImage: {
        width: '100%',
        height: 200,
    },
    removeImage: {
        position: 'absolute',
        top: 10,
        right: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.8)',
        borderRadius: 12,
    },
    submitButton: {
        margin: 20,
        padding: 15,
        borderRadius: 8,
        alignItems: 'center',
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
}); 