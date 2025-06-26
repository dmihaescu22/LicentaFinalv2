import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    StyleSheet,
    Image,
    TextInput,
    Alert,
    Modal,
    ScrollView
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { collection, query, orderBy, onSnapshot, where, getDocs, addDoc, serverTimestamp, doc, updateDoc, getDoc, arrayUnion, arrayRemove, deleteDoc } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

export default function ChatsScreen() {
    const { colors } = useTheme();
    const navigation = useNavigation();
    const [chats, setChats] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredChats, setFilteredChats] = useState([]);
    const [activeTab, setActiveTab] = useState('chats');
    const [friendRequests, setFriendRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [notifications, setNotifications] = useState([]);
    const [showNotifications, setShowNotifications] = useState(false);

    useEffect(() => { //#1
        // Adăugăm chat-ul cu HikeMate la început
        const hikeMateChat = {
            id: 'hikemate',
            name: 'HikeMate AI',
            lastMessage: 'Salut! Sunt asistentul tău pentru drumeții. Cu ce te pot ajuta?',
            timestamp: new Date(),
            imageUrl: 'https://i.imgur.com/7k12EPD.png',
            isAI: true
        };

        // Verificăm și creăm chat-uri pentru evenimente
        const createEventChats = async () => {
            try {
                console.log('Începem verificarea evenimentelor...');

                // Query pentru toate evenimentele la care participă utilizatorul
                const upcomingEventsQuery = query(
                    collection(db, 'upcomingEvents'),
                    where('userId', '==', auth.currentUser.uid)
                );

                const postsQuery = query(
                    collection(db, 'posts'),
                    where('participants', 'array-contains', auth.currentUser.uid)
                );

                const [upcomingEventsSnapshot, postsSnapshot] = await Promise.all([
                    getDocs(upcomingEventsQuery),
                    getDocs(postsQuery)
                ]);

                console.log('Evenimente găsite:', upcomingEventsSnapshot.size + postsSnapshot.size);

                // Combinăm evenimentele din ambele surse
                const allEvents = new Set();

                // Adăugăm evenimentele din upcomingEvents
                upcomingEventsSnapshot.docs.forEach(doc => {
                    const eventData = doc.data();
                    allEvents.add({
                        eventId: eventData.eventId,
                        eventTitle: eventData.eventTitle,
                        imageUrl: eventData.imageUrl
                    });
                });

                // Adăugăm evenimentele din posts
                postsSnapshot.docs.forEach(doc => {
                    const postData = doc.data();
                    if (postData.isEvent) {
                        allEvents.add({
                            eventId: doc.id,
                            eventTitle: postData.title,
                            imageUrl: postData.imageUrl
                        });
                    }
                });

                // Creăm chat-uri pentru toate evenimentele găsite
                const chatCreationPromises = Array.from(allEvents).map(async (event) => {
                    try {
                        // Verificăm dacă există deja un chat pentru acest eveniment
                        const existingChatQuery = query(
                            collection(db, 'groupChats'),
                            where('eventId', '==', event.eventId)
                        );
                        const existingChatSnapshot = await getDocs(existingChatQuery);

                        if (existingChatSnapshot.empty) {
                            console.log('Creăm chat nou pentru:', event.eventTitle);

                            // Obținem toți participanții din postarea originală
                            const postRef = doc(db, 'posts', event.eventId);
                            const postDoc = await getDoc(postRef);
                            const postData = postDoc.data();
                            const allParticipants = postData?.participants || [];

                            // Creăm un nou chat pentru eveniment cu toți participanții
                            return addDoc(collection(db, 'groupChats'), {
                                eventId: event.eventId,
                                name: event.eventTitle,
                                imageUrl: event.imageUrl,
                                participants: allParticipants,
                                lastMessage: 'Chat creat pentru eveniment',
                                lastMessageTime: serverTimestamp(),
                                createdAt: serverTimestamp()
                            });
                        } else {
                            // Dacă chat-ul există, actualizăm lista de participanți
                            const chatDoc = existingChatSnapshot.docs[0];
                            const postRef = doc(db, 'posts', event.eventId);
                            const postDoc = await getDoc(postRef);
                            const postData = postDoc.data();
                            const allParticipants = postData?.participants || [];

                            // Actualizăm participanții în chat-ul existent
                            await updateDoc(chatDoc.ref, {
                                participants: allParticipants
                            });
                        }
                        return null;
                    } catch (error) {
                        console.error('Eroare la procesarea chat-ului pentru evenimentul:', event.eventTitle, error);
                        return null;
                    }
                });

                await Promise.all(chatCreationPromises.filter(Boolean));
                console.log('Procesul de creare chat-uri finalizat');
            } catch (error) {
                console.error('Eroare la crearea chat-urilor:', error);
            }
        };

        // Preluăm toate chat-urile
        const setupChatsListener = () => {
            console.log('Configurăm listener pentru chat-uri...');
            const q = query(
                collection(db, 'groupChats'),
                where('participants', 'array-contains', auth.currentUser.uid)
            );

            return onSnapshot(q, (snapshot) => {
                console.log('Chat-uri actualizate, număr:', snapshot.size);
                const chatsList = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                // Combinăm HikeMate cu restul chat-urilor
                setChats([hikeMateChat, ...chatsList]);
            });
        };

        // Executăm secvențial
        const initializeChats = async () => {
            await createEventChats();
            return setupChatsListener();
        };

        const unsubscribe = initializeChats();
        return () => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        };
    }, []);

    useEffect(() => {
        if (searchQuery.trim() === '') {
            setFilteredChats(chats);
        } else {
            const filtered = chats.filter(chat =>
                chat.name.toLowerCase().includes(searchQuery.toLowerCase())
            );
            setFilteredChats(filtered);
        }
    }, [searchQuery, chats]);

    useEffect(() => {
        const fetchFriendRequests = async () => {
            try {
                console.log('DEBUG: Începe fetchFriendRequests');
                const currentUser = auth.currentUser;
                const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
                const userData = userDoc.data();

                console.log('DEBUG: Date utilizator primite:', {
                    friendRequests: userData.friendRequests,
                    friends: userData.friends
                });

                if (userData.friendRequests && userData.friendRequests.length > 0) {
                    console.log('DEBUG: Găsite cereri de prietenie:', userData.friendRequests.length);
                    const requests = await Promise.all(
                        userData.friendRequests
                            .filter(request => !request.responded) // Filtram doar cererile nerăspunse
                            .map(async (request) => {
                                console.log('DEBUG: Procesare cerere:', {
                                    id: request.id,
                                    senderId: request.senderId,
                                    responded: request.responded
                                });
                                const senderDoc = await getDoc(doc(db, 'users', request.senderId));
                                const senderData = senderDoc.data();
                                return {
                                    id: request.id,
                                    senderId: request.senderId,
                                    senderName: senderData.fullName || senderData.displayName,
                                    senderPhoto: senderData.profilePhotoUrl,
                                    timestamp: request.timestamp,
                                    responded: request.responded || false
                                };
                            })
                    );
                    console.log('DEBUG: Cereri procesate:', requests);
                    setFriendRequests(requests);
                } else {
                    console.log('DEBUG: Nu există cereri de prietenie');
                    setFriendRequests([]);
                }
                setLoading(false);
            } catch (error) {
                console.error('Error fetching friend requests:', error);
                setLoading(false);
            }
        };

        fetchFriendRequests();
    }, []);

    useEffect(() => {
        if (auth.currentUser) {
            console.log('DEBUG: Începem să ascultăm pentru notificări pentru utilizatorul:', auth.currentUser.uid);

            // Ascultăm pentru notificări reale
            const notificationsQuery = query(
                collection(db, 'notifications'),
                where('receiverId', '==', auth.currentUser.uid),
                where('read', '==', false),
                orderBy('createdAt', 'desc')
            );

            const unsubscribe = onSnapshot(notificationsQuery, async (snapshot) => {
                console.log('DEBUG: Am primit update pentru notificări. Număr de notificări:', snapshot.docs.length);

                const notificationsList = await Promise.all(snapshot.docs.map(async (docSnapshot) => {
                    const data = docSnapshot.data();

                    // Preluăm datele utilizatorului care a trimis notificarea
                    let senderData = {};
                    if (data.senderId) {
                        try {
                            const userRef = doc(db, 'users', data.senderId);
                            const senderDoc = await getDoc(userRef);
                            if (senderDoc.exists()) {
                                senderData = senderDoc.data();
                                console.log('DEBUG: Date utilizator găsite:', {
                                    id: data.senderId,
                                    name: senderData.displayName,
                                    photo: senderData.profilePhotoUrl
                                });
                            }
                        } catch (error) {
                            console.error('Eroare la preluarea datelor utilizatorului:', error);
                        }
                    }

                    const notificationData = {
                        id: docSnapshot.id,
                        ...data,
                        senderName: data.senderName || senderData.displayName || 'Un utilizator',
                        senderPhoto: senderData.profilePhotoUrl || 'https://via.placeholder.com/40'
                    };

                    console.log('DEBUG: Notificare procesată:', {
                        id: notificationData.id,
                        type: notificationData.type,
                        senderName: notificationData.senderName,
                        senderPhoto: notificationData.senderPhoto,
                        eventTitle: notificationData.eventTitle
                    });

                    return notificationData;
                }));

                setNotifications(notificationsList);
            });

            return () => unsubscribe();
        }
    }, []);

    const unreadNotifications = notifications.filter(n => !n.read).length;

    const handleAcceptFriendRequest = async (request) => {
        try {
            console.log('DEBUG: Începe handleAcceptFriendRequest pentru:', request);
            const currentUser = auth.currentUser;
            const currentUserRef = doc(db, 'users', currentUser.uid);
            const senderRef = doc(db, 'users', request.senderId);

            // Obținem datele curente ale utilizatorului
            const currentUserDoc = await getDoc(currentUserRef);
            const currentUserData = currentUserDoc.data();

            // Filtram cererile pentru a elimina pe cea la care am răspuns
            const updatedFriendRequests = currentUserData.friendRequests.filter(
                req => req.id !== request.id
            );

            console.log('DEBUG: Actualizare friendRequests:', {
                before: currentUserData.friendRequests.length,
                after: updatedFriendRequests.length
            });

            // Actualizăm ambele utilizatori în aceeași tranzacție
            await Promise.all([
                updateDoc(currentUserRef, {
                    friends: arrayUnion(request.senderId),
                    friendRequests: updatedFriendRequests
                }),
                updateDoc(senderRef, {
                    friends: arrayUnion(currentUser.uid),
                    sentFriendRequests: arrayRemove(request)
                })
            ]);

            // Creăm notificare pentru utilizatorul care a trimis cererea
            await addDoc(collection(db, 'notifications'), {
                receiverId: request.senderId,
                type: 'friend_request_accepted',
                senderId: currentUser.uid,
                senderName: currentUser.displayName,
                createdAt: serverTimestamp(),
                read: false
            });

            console.log('DEBUG: Actualizare baza de date completă');
            setFriendRequests(prev => {
                const newRequests = prev.filter(req => req.id !== request.id);
                console.log('DEBUG: Lista actualizată de cereri:', newRequests);
                return newRequests;
            });

            Alert.alert('Succes', `Acum ești prieten cu ${request.senderName}!`);
        } catch (error) {
            console.error('Error accepting friend request:', error);
            Alert.alert('Eroare', 'Nu am putut accepta cererea de prietenie.');
        }
    };

    const handleDeclineFriendRequest = async (request) => {
        try {
            console.log('DEBUG: Începe handleDeclineFriendRequest pentru:', request);
            const currentUser = auth.currentUser;
            const currentUserRef = doc(db, 'users', currentUser.uid);
            const senderRef = doc(db, 'users', request.senderId);

            // Obținem datele curente ale utilizatorului
            const currentUserDoc = await getDoc(currentUserRef);
            const currentUserData = currentUserDoc.data();

            // Filtram cererile pentru a elimina pe cea la care am răspuns
            const updatedFriendRequests = currentUserData.friendRequests.filter(
                req => req.id !== request.id
            );

            console.log('DEBUG: Actualizare friendRequests:', {
                before: currentUserData.friendRequests.length,
                after: updatedFriendRequests.length
            });

            // Actualizăm ambele utilizatori în aceeași tranzacție
            await Promise.all([
                updateDoc(currentUserRef, {
                    friendRequests: updatedFriendRequests
                }),
                updateDoc(senderRef, {
                    sentFriendRequests: arrayRemove(request)
                })
            ]);

            // Creăm notificare pentru utilizatorul care a trimis cererea
            await addDoc(collection(db, 'notifications'), {
                receiverId: request.senderId,
                type: 'friend_request_rejected',
                senderId: currentUser.uid,
                senderName: currentUser.displayName,
                createdAt: serverTimestamp(),
                read: false
            });

            console.log('DEBUG: Actualizare baza de date completă');
            setFriendRequests(prev => {
                const newRequests = prev.filter(req => req.id !== request.id);
                console.log('DEBUG: Lista actualizată de cereri:', newRequests);
                return newRequests;
            });

            Alert.alert('Succes', 'Cererea de prietenie a fost respinsă.');
        } catch (error) {
            console.error('Error declining friend request:', error);
            Alert.alert('Eroare', 'Nu am putut respinge cererea de prietenie.');
        }
    };

    const handleNotificationResponse = async (notification, response) => {
        try {
            if (response === 'accepted') {
                // Actualizăm statusul în upcomingEvents
                const upcomingQuery = query(
                    collection(db, 'upcomingEvents'),
                    where('eventId', '==', notification.eventId),
                    where('userId', '==', notification.senderId)
                );
                const upcomingSnapshot = await getDocs(upcomingQuery);

                if (!upcomingSnapshot.empty) {
                    await updateDoc(upcomingSnapshot.docs[0].ref, {
                        status: 'accepted'
                    });
                }

                // Adăugăm utilizatorul în chat-ul grupului
                const chatQuery = query(
                    collection(db, 'groupChats'),
                    where('eventId', '==', notification.eventId)
                );
                const chatSnapshot = await getDocs(chatQuery);

                if (!chatSnapshot.empty) {
                    const chatDoc = chatSnapshot.docs[0];
                    await updateDoc(chatDoc.ref, {
                        participants: arrayUnion(notification.senderId)
                    });
                }

                // Adăugăm utilizatorul în lista de participanți a postului
                const postRef = doc(db, 'posts', notification.eventId);
                await updateDoc(postRef, {
                    participants: arrayUnion(notification.senderId)
                });

                // Creăm notificare pentru utilizatorul acceptat
                await addDoc(collection(db, 'notifications'), {
                    receiverId: notification.senderId,
                    type: 'event_join_accepted',
                    eventId: notification.eventId,
                    eventTitle: notification.eventTitle,
                    senderId: auth.currentUser.uid,
                    senderName: auth.currentUser.displayName,
                    createdAt: serverTimestamp(),
                    read: false
                });
            } else {
                // Actualizăm statusul în upcomingEvents
                const upcomingQuery = query(
                    collection(db, 'upcomingEvents'),
                    where('eventId', '==', notification.eventId),
                    where('userId', '==', notification.senderId)
                );
                const upcomingSnapshot = await getDocs(upcomingQuery);

                if (!upcomingSnapshot.empty) {
                    await updateDoc(upcomingSnapshot.docs[0].ref, {
                        status: 'rejected'
                    });
                }

                // Creăm notificare pentru utilizatorul respins
                await addDoc(collection(db, 'notifications'), {
                    receiverId: notification.senderId,
                    type: 'event_join_rejected',
                    eventId: notification.eventId,
                    eventTitle: notification.eventTitle,
                    senderId: auth.currentUser.uid,
                    senderName: auth.currentUser.displayName,
                    createdAt: serverTimestamp(),
                    read: false
                });
            }

            // Ștergem notificarea originală
            await deleteDoc(doc(db, 'notifications', notification.id));

            // Actualizăm starea locală pentru a elimina notificarea
            setNotifications(prevNotifications =>
                prevNotifications.filter(n => n.id !== notification.id)
            );

        } catch (error) {
            console.error('Error handling notification response:', error);
            Alert.alert('Eroare', 'Nu am putut procesa răspunsul. Te rugăm să încerci din nou.');
        }
    };

    const renderFriendRequest = ({ item }) => (
        <View style={[styles.notificationItem, { backgroundColor: colors.background }]}>
            <View style={styles.notificationContent}>
                <Image
                    source={{ uri: item.senderPhoto || 'https://via.placeholder.com/40' }}
                    style={styles.notificationPhoto}
                />
                <View style={styles.notificationTextContainer}>
                    <Text style={[styles.notificationTitle, { color: colors.text }]}>
                        Cerere de prietenie
                    </Text>
                    <Text style={[styles.notificationText, { color: colors.secondaryText }]}>
                        {item.senderName} vrea să fie prietenul tău
                    </Text>
                    <View style={styles.notificationActions}>
                        <TouchableOpacity
                            style={[styles.notificationButton, styles.profileButton]}
                            onPress={() => navigation.navigate('Profile', { userId: item.senderId })}
                        >
                            <Text style={styles.buttonText}>Vezi profil</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.notificationButton, styles.acceptButton, { backgroundColor: colors.primary }]}
                            onPress={() => handleAcceptFriendRequest(item)}
                        >
                            <Text style={styles.buttonText}>Acceptă</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.notificationButton, styles.rejectButton, { backgroundColor: colors.error }]}
                            onPress={() => handleDeclineFriendRequest(item)}
                        >
                            <Text style={styles.buttonText}>Respinge</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </View>
    );

    const formatTime = (date) => {
        if (!date) return '';
        const now = new Date();
        const diff = now - date;
        const oneDay = 24 * 60 * 60 * 1000;

        if (diff < oneDay) {
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (diff < 7 * oneDay) {
            return ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'][date.getDay()];
        } else {
            return date.toLocaleDateString();
        }
    };

    const renderChatItem = ({ item }) => (
        <TouchableOpacity
            style={[styles.chatItem, { borderBottomColor: colors.border }]}
            onPress={() => {
                if (item.isAI) {
                    navigation.navigate('GroupChatScreen', {
                        chatId: item.id,
                        chatName: item.name,
                        isAI: true
                    });
                } else {
                    navigation.navigate('GroupChatScreen', {
                        chatId: item.id,
                        chatName: item.name,
                        isAI: false
                    });
                }
            }}
        >
            <Image
                source={{ uri: item.imageUrl || 'https://via.placeholder.com/50' }}
                style={styles.chatImage}
            />
            <View style={styles.chatInfo}>
                <Text style={[styles.chatName, { color: colors.text }]}>{item.name}</Text>
                <Text style={[styles.lastMessage, { color: colors.secondaryText }]} numberOfLines={1}>
                    {item.lastMessage}
                </Text>
            </View>
            <Text style={[styles.timestamp, { color: colors.secondaryText }]}>
                {item.timestamp?.toDate?.()
                    ? formatTime(item.timestamp.toDate())
                    : formatTime(item.timestamp)}
            </Text>
        </TouchableOpacity>
    );

    const renderNotification = (notification) => {
        console.log('DEBUG: Rendering notification:', {
            id: notification.id,
            type: notification.type,
            senderName: notification.senderName,
            senderPhoto: notification.senderPhoto,
            eventTitle: notification.eventTitle,
            createdAt: notification.createdAt?.toDate?.() || notification.createdAt
        });

        const handleViewProfile = () => {
            navigation.navigate('Profile', { userId: notification.senderId });
        };

        if (notification.type === 'friend_request') {
            return (
                <View style={[styles.notificationItem, { backgroundColor: colors.background }]}>
                    <View style={styles.notificationContent}>
                        <Image
                            source={{ uri: notification.senderPhoto }}
                            style={styles.notificationPhoto}
                        />
                        <View style={styles.notificationTextContainer}>
                            <Text style={[styles.notificationTitle, { color: colors.text }]}>
                                Cerere de prietenie
                            </Text>
                            <Text style={[styles.notificationText, { color: colors.secondaryText }]}>
                                {notification.senderName} vrea să fie prietenul tău
                            </Text>
                            <View style={styles.notificationActions}>
                                <TouchableOpacity
                                    style={[styles.notificationButton, styles.profileButton]}
                                    onPress={handleViewProfile}
                                >
                                    <Text style={styles.buttonText}>Vezi profil</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.notificationButton, styles.acceptButton, { backgroundColor: colors.primary }]}
                                    onPress={() => handleAcceptFriendRequest(notification)}
                                >
                                    <Text style={styles.buttonText}>Acceptă</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.notificationButton, styles.rejectButton, { backgroundColor: colors.error }]}
                                    onPress={() => handleDeclineFriendRequest(notification)}
                                >
                                    <Text style={styles.buttonText}>Respinge</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </View>
            );
        }

        if (notification.type === 'friend_request_accepted') {
            return (
                <View style={[styles.notificationItem, { backgroundColor: colors.background }]}>
                    <View style={styles.notificationContent}>
                        <Image
                            source={{ uri: notification.senderPhoto }}
                            style={styles.notificationPhoto}
                        />
                        <View style={styles.notificationTextContainer}>
                            <Text style={[styles.notificationTitle, { color: colors.text }]}>
                                Cerere de prietenie acceptată
                            </Text>
                            <Text style={[styles.notificationText, { color: colors.secondaryText }]}>
                                {notification.senderName} a acceptat cererea ta de prietenie
                            </Text>
                            <View style={styles.notificationActions}>
                                <TouchableOpacity
                                    style={[styles.notificationButton, styles.profileButton]}
                                    onPress={handleViewProfile}
                                >
                                    <Text style={styles.buttonText}>Vezi profil</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </View>
            );
        }

        if (notification.type === 'friend_request_rejected') {
            return (
                <View style={[styles.notificationItem, { backgroundColor: colors.background }]}>
                    <View style={styles.notificationContent}>
                        <Image
                            source={{ uri: notification.senderPhoto }}
                            style={styles.notificationPhoto}
                        />
                        <View style={styles.notificationTextContainer}>
                            <Text style={[styles.notificationTitle, { color: colors.text }]}>
                                Cerere de prietenie respinsă
                            </Text>
                            <Text style={[styles.notificationText, { color: colors.secondaryText }]}>
                                {notification.senderName} a respins cererea ta de prietenie
                            </Text>
                            <View style={styles.notificationActions}>
                                <TouchableOpacity
                                    style={[styles.notificationButton, styles.profileButton]}
                                    onPress={handleViewProfile}
                                >
                                    <Text style={styles.buttonText}>Vezi profil</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </View>
            );
        }

        if (notification.type === 'event_join_request' || notification.type === 'join_request') {
            return (
                <View style={[styles.notificationItem, { backgroundColor: colors.background }]}>
                    <View style={styles.notificationContent}>
                        <Image
                            source={{ uri: notification.senderPhoto }}
                            style={styles.notificationPhoto}
                        />
                        <View style={styles.notificationTextContainer}>
                            <Text style={[styles.notificationTitle, { color: colors.text }]}>
                                Cerere de participare
                            </Text>
                            <Text style={[styles.notificationText, { color: colors.secondaryText }]}>
                                {notification.senderName} vrea să participe la evenimentul "{notification.eventTitle}"
                            </Text>
                            <View style={styles.notificationActions}>
                                <TouchableOpacity
                                    style={[styles.notificationButton, styles.profileButton]}
                                    onPress={handleViewProfile}
                                >
                                    <Text style={styles.buttonText}>Vezi profil</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.notificationButton, styles.acceptButton, { backgroundColor: colors.primary }]}
                                    onPress={() => handleNotificationResponse(notification, 'accepted')}
                                >
                                    <Text style={styles.buttonText}>Acceptă</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.notificationButton, styles.rejectButton, { backgroundColor: colors.error }]}
                                    onPress={() => handleNotificationResponse(notification, 'rejected')}
                                >
                                    <Text style={styles.buttonText}>Respinge</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </View>
            );
        }

        if (notification.type === 'event_join_accepted') {
            return (
                <View style={[styles.notificationItem, { backgroundColor: colors.background }]}>
                    <View style={styles.notificationContent}>
                        <Image
                            source={{ uri: notification.senderPhoto }}
                            style={styles.notificationPhoto}
                        />
                        <View style={styles.notificationTextContainer}>
                            <Text style={[styles.notificationTitle, { color: colors.text }]}>
                                Cerere acceptată
                            </Text>
                            <Text style={[styles.notificationText, { color: colors.secondaryText }]}>
                                {notification.senderName} a acceptat cererea ta de participare la evenimentul "{notification.eventTitle}"
                            </Text>
                            <View style={styles.notificationActions}>
                                <TouchableOpacity
                                    style={[styles.notificationButton, styles.profileButton]}
                                    onPress={handleViewProfile}
                                >
                                    <Text style={styles.buttonText}>Vezi profil</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </View>
            );
        }

        if (notification.type === 'event_join_rejected') {
            return (
                <View style={[styles.notificationItem, { backgroundColor: colors.background }]}>
                    <View style={styles.notificationContent}>
                        <Image
                            source={{ uri: notification.senderPhoto }}
                            style={styles.notificationPhoto}
                        />
                        <View style={styles.notificationTextContainer}>
                            <Text style={[styles.notificationTitle, { color: colors.text }]}>
                                Cerere respinsă
                            </Text>
                            <Text style={[styles.notificationText, { color: colors.secondaryText }]}>
                                {notification.senderName} a respins cererea ta de participare la evenimentul "{notification.eventTitle}"
                            </Text>
                            <View style={styles.notificationActions}>
                                <TouchableOpacity
                                    style={[styles.notificationButton, styles.profileButton]}
                                    onPress={handleViewProfile}
                                >
                                    <Text style={styles.buttonText}>Vezi profil</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </View>
            );
        }

        return null;
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header Verde */}
            <View style={[styles.header, { backgroundColor: colors.primary }]}>
                <View style={styles.headerContent}>
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, { color: '#fff' }]}>Chat-uri</Text>
                </View>
            </View>

            {/* Tab-uri */}
            <View style={[styles.tabsContainer, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'chats' && [styles.activeTab, { borderBottomColor: colors.primary }]]}
                    onPress={() => setActiveTab('chats')}
                >
                    <Text style={[styles.tabText, { color: colors.secondaryText }, activeTab === 'chats' && [styles.activeTabText, { color: colors.primary }]]}>
                        Chat-uri
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, activeTab === 'notifications' && [styles.activeTab, { borderBottomColor: colors.primary }]]}
                    onPress={() => setActiveTab('notifications')}
                >
                    <View style={styles.notificationTab}>
                        <Text style={[styles.tabText, { color: colors.secondaryText }, activeTab === 'notifications' && [styles.activeTabText, { color: colors.primary }]]}>
                            Notificări
                        </Text>
                        {(notifications.length > 0 || friendRequests.length > 0) && (
                            <View style={[styles.notificationBadge, { backgroundColor: colors.error }]}>
                                <Text style={styles.notificationBadgeText}>{notifications.length + friendRequests.length}</Text>
                            </View>
                        )}
                    </View>
                </TouchableOpacity>
            </View>

            {/* Bara de căutare (doar pentru chat-uri) */}
            {activeTab === 'chats' && (
                <View style={[styles.searchContainer, { backgroundColor: colors.background }]}>
                    <Ionicons name="search" size={20} color={colors.secondaryText} style={styles.searchIcon} />
                    <TextInput
                        style={[styles.searchInput, { color: colors.text }]}
                        placeholder="Caută în chat-uri..."
                        placeholderTextColor={colors.secondaryText}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity
                            style={styles.clearButton}
                            onPress={() => setSearchQuery('')}
                        >
                            <Ionicons name="close-circle" size={20} color={colors.secondaryText} />
                        </TouchableOpacity>
                    )}
                </View>
            )}

            {/* Conținutul tab-urilor */}
            {activeTab === 'chats' ? (
                <FlatList
                    data={filteredChats}
                    renderItem={renderChatItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.chatList}
                />
            ) : (
                <View style={[styles.notificationsContainer, { backgroundColor: colors.background }]}>
                    {loading ? (
                        <Text style={{ color: colors.text }}>Se încarcă...</Text>
                    ) : (notifications.length > 0 || friendRequests.length > 0) ? (
                        <FlatList
                            data={[...friendRequests, ...notifications]}
                            renderItem={({ item }) => {
                                if (item.type) {
                                    return renderNotification(item);
                                } else {
                                    return renderFriendRequest({ item });
                                }
                            }}
                            keyExtractor={item => item.id}
                            contentContainerStyle={styles.requestsList}
                        />
                    ) : (
                        <View style={styles.emptyContainer}>
                            <Text style={[styles.emptyText, { color: colors.secondaryText }]}>Nu ai nicio notificare</Text>
                        </View>
                    )}
                </View>
            )}

            <Modal
                visible={showNotifications}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowNotifications(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Notificări</Text>
                            <TouchableOpacity
                                onPress={() => setShowNotifications(false)}
                                style={styles.closeButton}
                            >
                                <Ionicons name="close" size={24} color="#333" />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.notificationsList}>
                            {notifications.map(notification => (
                                <View key={notification.id}>
                                    {renderNotification(notification)}
                                </View>
                            ))}
                        </ScrollView>
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
        backgroundColor: '#556B2F',
        height: 120,
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
        padding: 10,
        marginRight: 10,
    },
    headerTitle: {
        color: '#fff',
        fontSize: 24,
        fontWeight: 'bold',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        marginHorizontal: 20,
        marginTop: 20,
        paddingHorizontal: 15,
        borderRadius: 25,
        height: 45,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#333',
    },
    clearButton: {
        padding: 5,
    },
    chatList: {
        padding: 15,
    },
    chatItem: {
        flexDirection: 'row',
        padding: 15,
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    chatImage: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: 15,
    },
    chatInfo: {
        flex: 1,
    },
    chatName: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
        color: '#333',
    },
    lastMessage: {
        fontSize: 14,
        color: '#666',
    },
    timestamp: {
        fontSize: 12,
        color: '#999',
        marginLeft: 10,
    },
    tabsContainer: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        paddingHorizontal: 20,
        paddingTop: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    activeTab: {
        borderBottomColor: '#556B2F',
    },
    tabText: {
        fontSize: 16,
        color: '#666',
        fontWeight: '500',
    },
    activeTabText: {
        color: '#556B2F',
        fontWeight: 'bold',
    },
    notificationTab: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    notificationBadge: {
        backgroundColor: '#ff4444',
        borderRadius: 10,
        minWidth: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 5,
    },
    notificationBadgeText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    requestItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#fff',
        borderRadius: 12,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
    },
    requestPhoto: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: 12,
    },
    requestInfo: {
        flex: 1,
    },
    requestName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#000',
    },
    requestText: {
        fontSize: 14,
        color: '#666',
    },
    requestActions: {
        flexDirection: 'row',
    },
    requestButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        marginLeft: 8,
    },
    acceptButton: {
        backgroundColor: '#556B2F',
    },
    declineButton: {
        backgroundColor: '#ff4444',
    },
    buttonText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
    },
    notificationsContainer: {
        flex: 1,
        padding: 16,
    },
    requestsList: {
        paddingVertical: 10,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 16,
        color: '#666',
    },
    notificationItem: {
        backgroundColor: '#fff',
        padding: 15,
        marginBottom: 10,
        borderRadius: 10,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
    },
    notificationContent: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    notificationPhoto: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: 15,
    },
    notificationTextContainer: {
        flex: 1,
    },
    notificationTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 5,
    },
    notificationText: {
        fontSize: 14,
        marginBottom: 10,
    },
    notificationActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 10,
    },
    notificationButton: {
        padding: 8,
        borderRadius: 5,
        minWidth: 80,
        alignItems: 'center',
    },
    profileButton: {
        backgroundColor: '#4a90e2',
    },
    acceptButton: {
        backgroundColor: '#4CAF50',
    },
    rejectButton: {
        backgroundColor: '#f44336',
    },
    buttonText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '500',
    },
    modalContainer: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        height: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#333',
    },
    closeButton: {
        padding: 5,
    },
    notificationsList: {
        flex: 1,
        padding: 15,
    },
}); 