import React, { useState, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
    ActivityIndicator,
    Image,
    Modal,
    Alert,
} from 'react-native';
import { collection, query, orderBy, addDoc, onSnapshot, serverTimestamp, doc, getDoc, where, getDocs, updateDoc, arrayRemove, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../context/ThemeContext';
import moment from 'moment';

const MISTRAL_API_KEY = 'LNRFMpTzjhaQXurNay2r854IeY0NCWMj';
const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions';

// Sistem de prompt-uri pentru contextualizarea răspunsurilor
const HIKING_CONTEXT = `Ești HikeMate, un ghid montan concis care oferă răspunsuri scurte și la obiect despre drumeții în România. Răspunde mereu în maxim 2-3 propoziții, folosind doar informații esențiale despre:

- Trasee montane din România
- Echipament necesar
- Sfaturi de siguranță
- Cabane și puncte de plecare
- Perioade recomandate

Răspunde scurt, direct și practic, fără introduceri sau formule de politețe lungi.`;

const getAIResponse = async (message) => {
    try {
        const maxRetries = 3;
        let retryCount = 0;
        let response;

        while (retryCount < maxRetries) {
            try {
                response = await fetch(MISTRAL_API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${MISTRAL_API_KEY}`
                    },
                    body: JSON.stringify({
                        model: 'mistral-tiny',
                        messages: [
                            {
                                role: 'system',
                                content: HIKING_CONTEXT
                            },
                            {
                                role: 'user',
                                content: message
                            }
                        ]
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    return data.choices[0].message.content;
                }

                if (response.status === 422) {
                    console.error('Invalid request format:', await response.text());
                    return "Îmi pare rău, am întâmpinat o eroare de format. Te rog să încerci din nou.";
                }

                if (response.status !== 503 && response.status !== 429) {
                    throw new Error(`API error: ${response.status}`);
                }

                retryCount++;
                await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            } catch (error) {
                console.error(`Încercare ${retryCount + 1} eșuată:`, error);
                retryCount++;
                if (retryCount === maxRetries) throw error;
                await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            }
        }

        throw new Error(`Failed after ${maxRetries} retries`);

    } catch (error) {
        console.error('Error in getAIResponse:', error);
        return `Îmi pare rău, am întâmpinat o problemă tehnică temporară. 

Te rog să încerci din nou. Între timp, poți să te gândești la întrebări despre:
• Recomandări de trasee pentru nivelul tău
• Echipamentul necesar pentru drumeție
• Sfaturi de siguranță în munți
• Informații despre cabane și trasee
• Obiective turistice interesante`;
    }
};

export default function GroupChatScreen({ route }) {
    const { colors } = useTheme();
    const { chatId, chatName, isAI } = route.params;
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [isTyping, setIsTyping] = useState(false);
    const flatListRef = useRef();
    const navigation = useNavigation();
    const [participants, setParticipants] = useState([]);
    const [eventOwnerId, setEventOwnerId] = useState(null);
    const [showParticipantsModal, setShowParticipantsModal] = useState(false);
    const [eventId, setEventId] = useState(null);
    const currentUser = auth.currentUser;

    useEffect(() => {
        const loadChatData = async () => {
            try {
                const chatDoc = await getDoc(doc(db, 'groupChats', chatId));
                if (chatDoc.exists()) {
                    const chatData = chatDoc.data();
                    if (chatData.eventId) {
                        setEventId(chatData.eventId);
                        console.log('Found eventId:', chatData.eventId);
                    }
                }
            } catch (error) {
                console.error('Error loading chat data:', error);
            }
        };

        if (!isAI) {
            loadChatData();
        }
    }, [chatId, isAI]);

    useEffect(() => {
        if (isAI) {
            setMessages([{
                id: 'welcome',
                text: 'Salut! Sunt HikeMate, asistentul tău pentru drumeții în România. Cu ce te pot ajuta astăzi? Poți să mă întrebi despre:\n\n• Trasee recomandate\n• Echipament necesar\n• Condiții meteo\n• Puncte de interes\n• Sfaturi pentru drumeții\n\nCu ce te pot ajuta?',
                senderId: 'hikemate',
                senderName: 'HikeMate AI',
                timestamp: new Date(),
                isAI: true
            }]);
            setLoading(false);
            return;
        }

        const q = query(
            collection(db, `groupChats/${chatId}/messages`),
            orderBy('timestamp', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedMessages = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setMessages(fetchedMessages);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [chatId, isAI]);

    useEffect(() => {
        if (eventId) {
            loadParticipants();
        }
    }, [eventId]);

    const handleLeaveGroup = async () => {
        try {
            console.log('Attempting to leave group with:', { chatId, eventId });

            if (!eventId || !chatId) {
                console.error('Missing eventId or chatId:', { eventId, chatId });
                Alert.alert('Eroare', 'Nu s-au putut găsi informațiile necesare pentru a părăsi grupul.');
                return;
            }

            // Actualizăm statusul în upcomingEvents
            const upcomingQuery = query(
                collection(db, 'upcomingEvents'),
                where('eventId', '==', eventId),
                where('userId', '==', auth.currentUser.uid)
            );
            const upcomingSnapshot = await getDocs(upcomingQuery);

            if (!upcomingSnapshot.empty) {
                // Ștergem documentul din upcomingEvents în loc să-l marchem ca rejected
                await deleteDoc(upcomingSnapshot.docs[0].ref);
            }

            // Eliminăm din chat
            const chatRef = doc(db, 'groupChats', chatId);
            await updateDoc(chatRef, {
                participants: arrayRemove(auth.currentUser.uid)
            });

            // Actualizăm și postul pentru a elimina utilizatorul din lista de participanți
            const postRef = doc(db, 'posts', eventId);
            await updateDoc(postRef, {
                participants: arrayRemove(auth.currentUser.uid)
            });

            Alert.alert('Succes', 'Ai părăsit grupul cu succes.');
            navigation.goBack();
        } catch (error) {
            console.error('Error leaving group:', error);
            Alert.alert('Eroare', 'Nu am putut procesa cererea de a părăsi grupul.');
        }
    };

    const loadParticipants = async () => {
        try {
            console.log('Loading participants for event:', eventId);
            if (!eventId) {
                console.log('No eventId provided');
                return;
            }

            // Mai întâi încărcăm datele evenimentului
            const eventDoc = await getDoc(doc(db, 'posts', eventId));
            if (!eventDoc.exists()) {
                console.log('Event document does not exist');
                return;
            }

            const eventData = eventDoc.data();
            console.log('Event data:', eventData);
            setEventOwnerId(eventData.userId);

            // Încărcăm toți participanții din chat
            const chatDoc = await getDoc(doc(db, 'groupChats', chatId));
            if (!chatDoc.exists()) {
                console.log('Chat document does not exist');
                return;
            }

            const chatData = chatDoc.data();
            console.log('Chat data:', chatData);

            // Obținem toți participanții din chat
            const participantsList = [];
            const participantsPromises = [];

            // Adăugăm creatorul evenimentului
            const creatorDoc = await getDoc(doc(db, 'users', eventData.userId));
            if (creatorDoc.exists()) {
                participantsList.push({
                    id: eventData.userId,
                    ...creatorDoc.data()
                });
            }

            // Adăugăm ceilalți participanți
            if (chatData.participants && Array.isArray(chatData.participants)) {
                for (const participantId of chatData.participants) {
                    if (participantId !== eventData.userId) { // Evităm duplicarea creatorului
                        const userDoc = await getDoc(doc(db, 'users', participantId));
                        if (userDoc.exists()) {
                            participantsList.push({
                                id: participantId,
                                ...userDoc.data()
                            });
                        }
                    }
                }
            }

            console.log('Final participants list:', participantsList);
            setParticipants(participantsList);
        } catch (error) {
            console.error('Error loading participants:', error);
            Alert.alert('Eroare', 'Nu am putut încărca lista de participanți.');
        }
    };

    const handleSend = async () => {
        if (!newMessage.trim() || isTyping) return;

        if (isAI) {
            const userMessage = {
                id: Date.now().toString(),
                text: newMessage.trim(),
                senderId: auth.currentUser.uid,
                senderName: auth.currentUser.displayName || 'User',
                timestamp: new Date(),
                isUser: true
            };

            setMessages(prev => [userMessage, ...prev]);
            setNewMessage('');
            setIsTyping(true);

            try {
                console.log('Sending message to AI:', newMessage.trim());
                const aiResponse = await getAIResponse(newMessage.trim());
                console.log('Received AI response:', aiResponse);

                const aiMessage = {
                    id: (Date.now() + 1).toString(),
                    text: aiResponse,
                    senderId: 'hikemate',
                    senderName: 'HikeMate AI',
                    timestamp: new Date(),
                    isAI: true
                };
                setMessages(prev => [aiMessage, ...prev]);
            } catch (error) {
                console.error('Error in handleSend:', error);
                const errorMessage = {
                    id: (Date.now() + 1).toString(),
                    text: "Îmi pare rău, am întâmpinat o eroare. Te rog să încerci din nou peste câteva momente.",
                    senderId: 'hikemate',
                    senderName: 'HikeMate AI',
                    timestamp: new Date(),
                    isAI: true
                };
                setMessages(prev => [errorMessage, ...prev]);
            }
            setIsTyping(false);
        } else {
            try {
                await addDoc(collection(db, `groupChats/${chatId}/messages`), {
                    text: newMessage.trim(),
                    senderId: currentUser.uid,
                    senderName: currentUser.displayName,
                    timestamp: serverTimestamp(),
                });
                setNewMessage('');
            } catch (error) {
                console.error('Error sending message:', error);
                Alert.alert('Eroare', 'Nu am putut trimite mesajul.');
            }
        }
    };

    const handleRemoveParticipant = async (participantId) => {
        if (auth.currentUser?.uid !== eventOwnerId) {
            Alert.alert('Eroare', 'Doar creatorul evenimentului poate elimina participanți.');
            return;
        }

        try {
            // Actualizăm statusul în upcomingEvents
            const upcomingQuery = query(
                collection(db, 'upcomingEvents'),
                where('eventId', '==', eventId),
                where('userId', '==', participantId)
            );
            const upcomingSnapshot = await getDocs(upcomingQuery);

            if (!upcomingSnapshot.empty) {
                await updateDoc(upcomingSnapshot.docs[0].ref, {
                    status: 'removed'
                });
            }

            // Eliminăm din chat
            const chatRef = doc(db, 'groupChats', chatId);
            await updateDoc(chatRef, {
                participants: arrayRemove(participantId)
            });

            // Creăm o notificare pentru utilizatorul eliminat
            await addDoc(collection(db, 'notifications'), {
                userId: participantId,
                type: 'event_removed',
                eventId: eventId,
                eventTitle: chatName,
                senderId: auth.currentUser.uid,
                senderName: auth.currentUser.displayName,
                createdAt: serverTimestamp(),
                read: false
            });

            // Reîncărcăm lista de participanți
            loadParticipants();

            Alert.alert('Succes', 'Participantul a fost eliminat cu succes.');
        } catch (error) {
            console.error('Error removing participant:', error);
            Alert.alert('Eroare', 'Nu am putut elimina participantul.');
        }
    };

    const renderMessage = ({ item, index }) => {
        const isOwnMessage = item.senderId === auth.currentUser?.uid;
        const isAIMessage = item.isAI;

        // Verificăm dacă mesajul anterior este de la același expeditor
        const previousMessage = index < messages.length - 1 ? messages[index + 1] : null;
        const isFirstInSequence = !previousMessage || previousMessage.senderId !== item.senderId;

        // Verificăm dacă trebuie să afișăm separatorul de dată
        const showDateSeparator = () => {
            if (!previousMessage) return true;

            const currentDate = new Date(item.timestamp?.toDate?.() || item.timestamp);
            const previousDate = new Date(previousMessage.timestamp?.toDate?.() || previousMessage.timestamp);

            return currentDate.toDateString() !== previousDate.toDateString();
        };

        const formatDate = (timestamp) => {
            const date = new Date(timestamp?.toDate?.() || timestamp);
            const today = new Date();
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);

            if (date.toDateString() === today.toDateString()) {
                return 'Astăzi';
            } else if (date.toDateString() === yesterday.toDateString()) {
                return 'Ieri';
            } else {
                return date.toLocaleDateString('ro-RO', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric'
                });
            }
        };

        const formatTime = (timestamp) => {
            if (!timestamp) return '';
            if (timestamp?.toDate) {
                return timestamp.toDate().toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }
            if (timestamp instanceof Date) {
                return timestamp.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }
            if (timestamp?.seconds) {
                return new Date(timestamp.seconds * 1000).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }
            return '';
        };

        return (
            <View>
                {showDateSeparator() && (
                    <View style={styles.dateSeparator}>
                        <View style={[styles.dateSeparatorLine, { backgroundColor: colors.border }]} />
                        <Text style={[styles.dateSeparatorText, { color: colors.secondaryText }]}>
                            {formatDate(item.timestamp)}
                        </Text>
                        <View style={[styles.dateSeparatorLine, { backgroundColor: colors.border }]} />
                    </View>
                )}
                {isAIMessage ? (
                    <View style={[styles.messageContainer, styles.otherMessageContainer]}>
                        <View style={[styles.messageBubble, styles.aiMessageBubble, { backgroundColor: colors.secondary }]}>
                            <Text style={[styles.messageText, { color: colors.text }]}>{item.text}</Text>
                            <Text style={[styles.messageTime, { color: colors.secondaryText }]}>{formatTime(item.timestamp)}</Text>
                        </View>
                    </View>
                ) : isOwnMessage ? (
                    <View style={[
                        styles.messageContainer,
                        styles.ownMessageContainer,
                        !isFirstInSequence && styles.consecutiveMessage
                    ]}>
                        <View style={[styles.messageBubble, styles.ownMessageBubble, { backgroundColor: colors.primary }]}>
                            <Text style={[styles.messageText, { color: '#fff' }]}>{item.text}</Text>
                            <Text style={[styles.messageTime, { color: 'rgba(255, 255, 255, 0.8)' }]}>{formatTime(item.timestamp)}</Text>
                        </View>
                    </View>
                ) : (
                    <View style={[
                        styles.messageContainer,
                        styles.otherMessageContainer,
                        !isFirstInSequence && styles.consecutiveMessage
                    ]}>
                        <View style={styles.messengerContainer}>
                            {isFirstInSequence ? (
                                <Image
                                    source={{
                                        uri: item.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.senderName || 'User')}&background=random`
                                    }}
                                    style={styles.profileImage}
                                />
                            ) : (
                                <View style={styles.profileImagePlaceholder} />
                            )}
                            <View style={styles.messageContent}>
                                {isFirstInSequence && (
                                    <Text style={[styles.senderName, { color: colors.secondaryText }]}>{item.senderName}</Text>
                                )}
                                <View style={[
                                    styles.messageBubble,
                                    styles.otherMessageBubble,
                                    { backgroundColor: colors.secondary },
                                    !isFirstInSequence && styles.consecutiveBubble
                                ]}>
                                    <Text style={[styles.messageText, { color: colors.text }]}>{item.text}</Text>
                                    <Text style={[styles.messageTime, { color: colors.secondaryText }]}>{formatTime(item.timestamp)}</Text>
                                </View>
                            </View>
                        </View>
                    </View>
                )}
            </View>
        );
    };

    const renderParticipant = (participant) => {
        const isOwner = auth.currentUser?.uid === eventOwnerId;
        return (
            <View style={styles.participantItem}>
                <Image
                    source={{
                        uri: participant.profilePhotoUrl ||
                            `https://ui-avatars.com/api/?name=${encodeURIComponent(participant.displayName || 'User')}&background=random`
                    }}
                    style={styles.participantPhoto}
                />
                <View style={styles.participantInfo}>
                    <Text style={styles.participantName}>{participant.displayName || 'Utilizator'}</Text>
                    <Text style={styles.participantLevel}>{participant.level || 'Hiking Enthusiast'}</Text>
                </View>
                {isOwner && participant.id !== auth.currentUser?.uid && (
                    <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => handleRemoveParticipant(participant.id)}
                    >
                        <Ionicons name="close-circle" size={24} color="#ff4444" />
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    if (loading) {
        return (
            <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <LinearGradient
                colors={[colors.primary, colors.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.header}
            >
                <View style={styles.headerContent}>
                    <TouchableOpacity
                        style={[styles.backButton, { backgroundColor: 'rgba(255, 255, 255, 0.2)' }]}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <View style={styles.headerTitleContainer}>
                        <Text style={[styles.headerTitle, { color: '#fff' }]}>{chatName}</Text>
                    </View>
                    {!isAI && (
                        <>
                            <TouchableOpacity
                                onPress={() => setShowParticipantsModal(true)}
                                style={styles.participantsButton}
                            >
                                <Ionicons name="people" size={24} color="#fff" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={handleLeaveGroup}
                                style={styles.leaveButton}
                            >
                                <Ionicons name="exit-outline" size={24} color="#ff4444" />
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </LinearGradient>

            <KeyboardAvoidingView
                style={styles.keyboardAvoidingView}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 20}
            >
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={item => item.id}
                    inverted
                    contentContainerStyle={styles.messagesList}
                />

                <View style={[styles.inputContainer, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
                    <TextInput
                        style={[styles.input, {
                            backgroundColor: colors.secondary,
                            color: colors.text
                        }]}
                        value={newMessage}
                        onChangeText={setNewMessage}
                        placeholder="Scrie un mesaj..."
                        placeholderTextColor={colors.secondaryText}
                        multiline
                        maxHeight={100}
                    />
                    <TouchableOpacity
                        style={styles.sendButton}
                        onPress={handleSend}
                        disabled={!newMessage.trim()}
                    >
                        <Ionicons
                            name="send"
                            size={24}
                            color={newMessage.trim() ? colors.primary : colors.secondaryText}
                        />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>

            <Modal
                visible={showParticipantsModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowParticipantsModal(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={[styles.modalContent, { backgroundColor: '#fff' }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: '#333' }]}>Participanți</Text>
                            <TouchableOpacity onPress={() => setShowParticipantsModal(false)}>
                                <Ionicons name="close" size={24} color="#333" />
                            </TouchableOpacity>
                        </View>
                        {participants.length === 0 ? (
                            <View style={styles.emptyListContainer}>
                                <Text style={styles.emptyListText}>Nu există participanți încă</Text>
                            </View>
                        ) : (
                            <FlatList
                                data={participants}
                                renderItem={({ item }) => renderParticipant(item)}
                                keyExtractor={item => item.id}
                                style={styles.participantsList}
                            />
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        height: 130,
        paddingTop: 50,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 4.65,
        elevation: 8,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        height: 70,
        marginTop: 10,
    },
    backButton: {
        padding: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: 20,
        marginRight: 15,
    },
    headerTitleContainer: {
        flex: 1,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 22,
        fontWeight: 'bold',
        textShadowColor: 'rgba(0, 0, 0, 0.2)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    keyboardAvoidingView: {
        flex: 1,
        justifyContent: 'space-between',
    },
    messagesList: {
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    messageContainer: {
        marginVertical: 4,
        maxWidth: '80%',
    },
    ownMessageContainer: {
        alignSelf: 'flex-end',
    },
    otherMessageContainer: {
        alignSelf: 'flex-start',
        width: '80%',
    },
    messengerContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    messageContent: {
        flex: 1,
        marginLeft: 8,
    },
    profileImage: {
        width: 32,
        height: 32,
        borderRadius: 16,
    },
    senderName: {
        fontSize: 12,
        color: '#666',
        marginBottom: 4,
        fontWeight: '500',
    },
    messageBubble: {
        borderRadius: 20,
        padding: 12,
        maxWidth: '100%',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
    },
    ownMessageBubble: {
        backgroundColor: '#DCF8C6',
        borderTopRightRadius: 5,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        borderTopLeftRadius: 20,
    },
    otherMessageBubble: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 5,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        borderTopRightRadius: 20,
        borderWidth: 1,
        borderColor: '#E8E8E8',
    },
    aiMessageBubble: {
        backgroundColor: '#E3F2FD',
        borderTopLeftRadius: 5,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        borderTopRightRadius: 20,
    },
    messageText: {
        fontSize: 16,
        color: '#000',
        lineHeight: 22,
    },
    messageTime: {
        fontSize: 11,
        color: '#666',
        alignSelf: 'flex-end',
        marginTop: 4,
        opacity: 0.7,
    },
    inputContainer: {
        flexDirection: 'row',
        padding: 12,
        paddingBottom: Platform.OS === 'ios' ? 30 : 12,
        borderTopWidth: 1,
        borderTopColor: '#f0f0f0',
        backgroundColor: '#fff',
        alignItems: 'flex-end',
        marginBottom: Platform.OS === 'android' ? 10 : 0,
    },
    input: {
        flex: 1,
        backgroundColor: '#f0f0f0',
        borderRadius: 20,
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginRight: 8,
        minHeight: 40,
        maxHeight: 100,
    },
    sendButton: {
        padding: 8,
        alignSelf: 'flex-end',
        marginBottom: 2,
    },
    consecutiveMessage: {
        marginTop: 2,
    },
    consecutiveBubble: {
        marginTop: 2,
    },
    profileImagePlaceholder: {
        width: 32,
        height: 32,
        marginRight: 8,
    },
    dateSeparator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginVertical: 16,
        paddingHorizontal: 20,
    },
    dateSeparatorLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#E8E8E8',
    },
    dateSeparatorText: {
        marginHorizontal: 10,
        color: '#666',
        fontSize: 12,
        fontWeight: '500',
    },
    participantsButton: {
        padding: 5,
        marginRight: 10,
    },
    leaveButton: {
        padding: 5,
    },
    modalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 20,
        width: '90%',
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        paddingBottom: 10,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    participantsList: {
        padding: 10,
    },
    participantItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
        backgroundColor: '#fff',
    },
    participantPhoto: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: 15,
    },
    participantInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    participantName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 4,
    },
    participantLevel: {
        fontSize: 14,
        color: '#666',
    },
    removeButton: {
        padding: 8,
    },
    emptyListContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    emptyListText: {
        fontSize: 16,
        color: '#666',
        textAlign: 'center',
    },
}); 