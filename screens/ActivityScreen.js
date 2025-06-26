// ActivityScreen.js
import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    FlatList,
    Image,
    Alert,
    Modal,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import moment from 'moment';
import { useTheme } from '../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

// Importuri Firebase
import { auth, db } from '../config/firebase';
import { collection, query, where, onSnapshot, orderBy, doc, deleteDoc, updateDoc, arrayRemove, getDocs, getDoc } from 'firebase/firestore';

export default function ActivityScreen() {
    const { isDarkMode, colors } = useTheme();
    const [selectedTab, setSelectedTab] = useState('recent');
    const [recentHikes, setRecentHikes] = useState([]);
    const [upcomingEvents, setUpcomingEvents] = useState([]);
    const [showInfoModal, setShowInfoModal] = useState(false);
    const [showAllUpdatesModal, setShowAllUpdatesModal] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [userData, setUserData] = useState({
        name: 'John Doe',
        level: 'Hiking Enthusiast',
        photo: 'https://via.placeholder.com/80'
    });
    const [liveUpdates, setLiveUpdates] = useState([]);
    const [isLoadingUpdates, setIsLoadingUpdates] = useState(false);
    const [userNames, setUserNames] = useState({});
    const navigation = useNavigation();

    const getDifficultyLevel = (distance) => {
        if (distance <= 5) return 'Ușor';
        if (distance <= 10) return 'Mediu';
        if (distance <= 15) return 'Moderat';
        return 'Greu';
    };

    const getEstimatedTime = (distance) => {
        // Presupunem o viteză medie de 3 km/h pentru drumeție
        const hours = Math.floor(distance / 3);
        const minutes = Math.round((distance % 3) * 20);
        if (hours === 0) return `${minutes} minute`;
        if (minutes === 0) return `${hours} ore`;
        return `${hours} ore și ${minutes} minute`;
    };

    const getRecommendedEquipment = (distance) => {
        const baseEquipment = [
            'Încălțăminte de drumeție',
            'Rucsac cu apă (minim 1L)',
            'Haine potrivite pentru vreme',
            'Crema de soare și ochelari de soare',
            'Trusă de prim ajutor'
        ];

        if (distance > 10) {
            baseEquipment.push('Lanternă sau front lampă');
            baseEquipment.push('Hărți sau GPS');
            baseEquipment.push('Snacks și mâncare ușoară');
        }

        if (distance > 15) {
            baseEquipment.push('Bastoni de drumeție');
            baseEquipment.push('Haine de schimb');
            baseEquipment.push('Cort (în caz de urgență)');
        }

        return baseEquipment;
    };

    const getSafetyTips = (distance) => {
        const baseTips = [
            'Verifică vremea înainte de plecare',
            'Păstrează un ritm constant',
            'Rămâi pe traseul marcat',
            'Informează pe cineva despre ruta ta'
        ];

        if (distance > 10) {
            baseTips.push('Planifică-ți ruta în avans');
            baseTips.push('Verifică condițiile de teren');
            baseTips.push('Asigură-te că ai suficientă apă și mâncare');
        }

        if (distance > 15) {
            baseTips.push('Verifică ora răsăritului și apusului');
            baseTips.push('Asigură-te că ai echipament de urgență');
            baseTips.push('Verifică semnalul de telefon pe traseu');
        }

        return baseTips;
    };

    const getPhysicalPreparation = (distance) => {
        if (distance <= 5) {
            return 'Nu necesită pregătire specială, potrivit pentru începători';
        } else if (distance <= 10) {
            return 'Recomandat să faci plimbări regulate înainte';
        } else if (distance <= 15) {
            return 'Necesită condiție fizică bună și antrenament regulat';
        } else {
            return 'Necesită pregătire intensivă și experiență în drumeții lungi';
        }
    };

    const renderLiveUpdate = (update) => (
        <View key={update.id} style={styles.updateItem}>
            <View style={styles.updateHeader}>
                <Text style={styles.updateAuthor}>
                    {userNames[update.userId] || 'Se încarcă...'}
                </Text>
                {update.userId === auth.currentUser?.uid && (
                    <TouchableOpacity
                        style={styles.deleteButton}
                        onPress={() => {
                            Alert.alert(
                                'Șterge actualizarea',
                                'Ești sigur că vrei să ștergi această actualizare?',
                                [
                                    { text: 'Anulează', style: 'cancel' },
                                    {
                                        text: 'Șterge',
                                        style: 'destructive',
                                        onPress: () => handleDeleteUpdate(update.id)
                                    }
                                ]
                            );
                        }}
                    >
                        <Ionicons name="close-circle" size={20} color={colors.error} />
                    </TouchableOpacity>
                )}
            </View>
            <Text style={styles.updateTime}>
                {moment(update.timestamp.toDate()).format('DD/MM/YYYY HH:mm')}
            </Text>
            <Text style={styles.updateText}>{update.message}</Text>
            {update.imageUrl && (
                <Image
                    source={{ uri: update.imageUrl }}
                    style={styles.updateImage}
                    resizeMode="cover"
                />
            )}
        </View>
    );
    //#1
    const loadLiveUpdates = async (eventId) => {
        try {
            console.log('Loading live updates for event:', eventId);
            setIsLoadingUpdates(true);

            // Încărcăm actualizările pentru evenimentul specific
            const updatesQuery = query(
                collection(db, 'liveUpdates'),
                where('eventId', '==', eventId),
                orderBy('timestamp', 'desc')
            );

            return onSnapshot(updatesQuery, async (snapshot) => {
                const updates = [];
                const userIds = new Set();

                snapshot.forEach((doc) => {
                    const data = doc.data();
                    updates.push({ id: doc.id, ...data });
                    userIds.add(data.userId);
                });

                // Încărcăm numele utilizatorilor
                const names = {};
                for (const userId of userIds) {
                    if (!userNames[userId]) {
                        const userDoc = await getDoc(doc(db, 'users', userId));
                        if (userDoc.exists()) {
                            names[userId] = userDoc.data().displayName || 'Utilizator necunoscut';
                        }
                    }
                }

                setUserNames(prev => ({ ...prev, ...names }));
                setLiveUpdates(updates);
                setIsLoadingUpdates(false);
            });
        } catch (error) {
            console.error('Error loading live updates:', error);
            setIsLoadingUpdates(false);
            return () => { };
        }
    };

    const handleDeleteUpdate = async (updateId) => {
        try {
            await deleteDoc(doc(db, 'liveUpdates', updateId));
            Alert.alert('Succes', 'Actualizarea a fost ștearsă cu succes!');
        } catch (error) {
            console.error('Error deleting update:', error);
            Alert.alert('Eroare', 'Nu am putut șterge actualizarea. Te rugăm să încerci din nou.');
        }
    };

    const handleCancelRequest = async (eventId) => {
        try {
            // Găsim documentul din upcomingEvents
            const upcomingQuery = query(
                collection(db, 'upcomingEvents'),
                where('eventId', '==', eventId),
                where('userId', '==', auth.currentUser.uid)
            );
            const snapshot = await getDocs(upcomingQuery);

            if (!snapshot.empty) {
                const upcomingEvent = snapshot.docs[0];

                // Ștergem evenimentul din upcomingEvents
                await deleteDoc(upcomingEvent.ref);

                // Găsim și ștergem notificarea asociată
                const notificationQuery = query(
                    collection(db, 'notifications'),
                    where('eventId', '==', eventId),
                    where('senderId', '==', auth.currentUser.uid),
                    where('type', '==', 'event_join_request')
                );
                const notificationSnapshot = await getDocs(notificationQuery);

                if (!notificationSnapshot.empty) {
                    await deleteDoc(notificationSnapshot.docs[0].ref);
                }

                // Actualizăm starea locală
                setUpcomingEvents(prevEvents =>
                    prevEvents.filter(event => event.eventId !== eventId)
                );

                // Actualizăm și în colecția posts pentru a reflecta schimbarea în Feed
                const postRef = doc(db, 'posts', eventId);
                const postDoc = await getDoc(postRef);

                if (postDoc.exists()) {
                    await updateDoc(postRef, {
                        participants: arrayRemove(auth.currentUser.uid)
                    });
                }

                Alert.alert(
                    'Success',
                    'Your participation request has been cancelled.',
                    [{ text: 'OK' }]
                );
            }
        } catch (error) {
            console.error('Error cancelling request:', error);
            Alert.alert('Error', 'Could not cancel the request. Please try again.');
        }
    };

    useEffect(() => {
        if (!auth.currentUser) return;

        // Preluăm datele utilizatorului
        const userDocRef = doc(db, 'users', auth.currentUser.uid);
        const unsubscribeUser = onSnapshot(userDocRef, (docSnapshot) => {
            if (docSnapshot.exists()) {
                const data = docSnapshot.data();
                setUserData({
                    name: data.displayName || 'John Doe',
                    level: data.level || 'Hiking Enthusiast',
                    photo: data.profilePhotoUrl || 'https://via.placeholder.com/80'
                });
            }
        });

        // Preluăm activitățile
        const q = query(
            collection(db, 'activities'),
            where('userId', '==', auth.currentUser.uid),
            orderBy('date', 'desc')
        );

        const unsubscribeActivities = onSnapshot(q, (snapshot) => {
            const hikes = [];
            snapshot.forEach((doc) => {
                hikes.push({ id: doc.id, ...doc.data() });
            });
            setRecentHikes(hikes);
        });

        // Preluăm evenimentele viitoare
        const upcomingEventsQuery = query(
            collection(db, 'upcomingEvents'),
            where('userId', '==', auth.currentUser.uid),
            orderBy('eventDate', 'desc')
        );

        const unsubscribeUpcoming = onSnapshot(upcomingEventsQuery, async (snapshot) => {
            const events = [];
            for (const docSnap of snapshot.docs) {
                const eventData = { id: docSnap.id, ...docSnap.data() };
                let distance = eventData.distance;
                // Dacă nu avem distance sau e 0, încercăm să-l luăm din posts
                if (!distance && eventData.eventId) {
                    try {
                        const postDoc = await getDoc(doc(db, 'posts', eventData.eventId));
                        if (postDoc.exists()) {
                            const postData = postDoc.data();
                            distance = postData.distance;
                        }
                    } catch (e) {
                        console.log('Eroare la preluarea distance din posts:', e);
                    }
                }
                events.push({ ...eventData, distance });
            }
            setUpcomingEvents(events);
        });

        return () => {
            unsubscribeUser();
            unsubscribeActivities();
            unsubscribeUpcoming();
        };
    }, []);

    useEffect(() => {
        let unsubscribe = () => { };
        if (selectedEvent && showInfoModal) {
            console.log('Opening modal for event:', selectedEvent.id);
            loadLiveUpdates(selectedEvent.id).then(unsub => {
                unsubscribe = unsub;
            });
        }
        return () => {
            console.log('Cleaning up live updates subscription');
            unsubscribe();
        };
    }, [selectedEvent, showInfoModal]);

    const handleLeaveEvent = async (eventId) => {
        try {
            console.log('Attempting to leave event:', eventId);

            if (!eventId) {
                console.error('Missing eventId');
                Alert.alert('Error', 'Could not find the necessary information to leave the event.');
                return;
            }

            // Ștergem din upcomingEvents
            const q = query(
                collection(db, 'upcomingEvents'),
                where('eventId', '==', eventId),
                where('userId', '==', auth.currentUser.uid)
            );
            const snapshot = await getDocs(q);

            if (!snapshot.empty) {
                await deleteDoc(snapshot.docs[0].ref);
            }

            // Eliminăm din chat
            const chatQuery = query(
                collection(db, 'groupChats'),
                where('eventId', '==', eventId)
            );
            const chatSnapshot = await getDocs(chatQuery);

            if (!chatSnapshot.empty) {
                const chatDoc = chatSnapshot.docs[0];
                await updateDoc(chatDoc.ref, {
                    participants: arrayRemove(auth.currentUser.uid)
                });
            }

            // Verificăm dacă postul există înainte de a încerca să-l actualizăm
            const postRef = doc(db, 'posts', eventId);
            const postDoc = await getDoc(postRef);

            if (postDoc.exists()) {
                await updateDoc(postRef, {
                    participants: arrayRemove(auth.currentUser.uid)
                });
            }

            // Actualizăm starea locală
            setUpcomingEvents(prevEvents =>
                prevEvents.filter(event => event.eventId !== eventId)
            );

            Alert.alert('Success', 'You have successfully left the event.');
        } catch (error) {
            console.error('Error leaving event:', error);
            Alert.alert('Error', 'Could not process your request. Please try again.');
        }
    };

    const renderHikeItem = ({ item }) => (
        <View style={[styles.hikeItem, { backgroundColor: colors.background }]}>
            {item.imageUrl ? (
                <Image
                    source={{ uri: item.imageUrl }}
                    style={styles.hikeImage}
                />
            ) : (
                <View style={[styles.hikeImage, styles.noImagePlaceholder, { backgroundColor: colors.secondary }]}>
                    <Text style={[styles.noImageText, { color: colors.secondaryText }]}>No Map</Text>
                </View>
            )}
            <View style={styles.hikeInfo}>
                <Text style={[styles.hikeTitle, { color: colors.text }]}>{item.trailName}</Text>
                <Text style={[styles.hikeDetails, { color: colors.secondaryText }]}>
                    Distance: {item.distance} km
                </Text>
                {item.elapsedTime && (
                    <Text style={[styles.hikeDetails, { color: colors.secondaryText }]}>Time: {item.elapsedTime}</Text>
                )}
                <Text style={[styles.hikeDetails, { color: colors.secondaryText }]}>Date: {item.date}</Text>
            </View>
        </View>
    );

    const renderEventItem = ({ item }) => (
        <View style={[styles.hikeItem, { backgroundColor: colors.background }]}>
            {item.imageUrl ? (
                <Image
                    source={{ uri: item.imageUrl }}
                    style={styles.hikeImage}
                />
            ) : (
                <View style={[styles.hikeImage, styles.noImagePlaceholder, { backgroundColor: colors.secondary }]}>
                    <Text style={[styles.noImageText, { color: colors.secondaryText }]}>No Image</Text>
                </View>
            )}
            <View style={styles.hikeInfo}>
                <View style={styles.eventHeader}>
                    <View style={styles.eventTitleContainer}>
                        <Text style={[styles.hikeTitle, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">
                            {item.eventTitle}
                        </Text>
                    </View>
                    <View style={styles.eventButtons}>
                        {item.status !== 'rejected' && (
                            <TouchableOpacity
                                style={styles.infoButton}
                                onPress={() => {
                                    console.log('Event data:', item);
                                    const eventData = {
                                        ...item,
                                        distance: Number(item.distance) || 0,
                                        meetingPoint: item.meetingPoint || 'Nespecificat',
                                        eventTitle: item.eventTitle || 'Hike'
                                    };
                                    console.log('Processed event data:', eventData);
                                    setSelectedEvent(eventData);
                                    setShowInfoModal(true);
                                }}
                            >
                                <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
                            </TouchableOpacity>
                        )}
                        {item.status === 'accepted' && (
                            <TouchableOpacity
                                style={styles.cancelButton}
                                onPress={() => {
                                    Alert.alert(
                                        'Leave Event',
                                        'Are you sure you want to leave this event?',
                                        [
                                            {
                                                text: 'Cancel',
                                                style: 'cancel'
                                            },
                                            {
                                                text: 'Leave',
                                                onPress: () => handleLeaveEvent(item.eventId),
                                                style: 'destructive'
                                            }
                                        ]
                                    );
                                }}
                            >
                                <Ionicons name="exit-outline" size={14} color="#fff" />
                                <Text style={styles.cancelButtonText}>Leave</Text>
                            </TouchableOpacity>
                        )}
                        {item.status === 'pending' && (
                            <TouchableOpacity
                                style={[styles.cancelButton, { backgroundColor: colors.error }]}
                                onPress={() => {
                                    Alert.alert(
                                        'Cancel Request',
                                        'Are you sure you want to cancel your participation request?',
                                        [
                                            {
                                                text: 'No',
                                                style: 'cancel'
                                            },
                                            {
                                                text: 'Yes',
                                                onPress: () => handleCancelRequest(item.eventId),
                                                style: 'destructive'
                                            }
                                        ]
                                    );
                                }}
                            >
                                <Ionicons name="close-circle-outline" size={14} color="#fff" />
                                <Text style={styles.cancelButtonText}>Cancel Request</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
                {item.status !== 'pending' && item.status !== 'rejected' && (
                    <>
                        {console.log('Event data:', item)}
                        <Text style={[styles.hikeDetails, { color: colors.secondaryText }]}>
                            Distance: {item.status === 'accepted' && item.distance ? `${item.distance} km` : 'N/A'}
                        </Text>
                        <Text style={[styles.hikeDetails, { color: colors.secondaryText }]}>
                            Meeting Point: {item.meetingPoint}
                        </Text>
                    </>
                )}
                {item.status !== 'rejected' && (
                    <Text style={[styles.hikeDetails, { color: colors.secondaryText }]}>
                        Date: {moment(item.eventDate.toDate()).format(item.status === 'pending' ? 'DD MMMM YYYY' : 'DD MMMM YYYY HH:mm')}
                    </Text>
                )}
                <View style={styles.statusContainer}>
                    <View style={[
                        styles.statusIndicator,
                        {
                            backgroundColor: item.status === 'accepted' ? '#4CAF50' :
                                item.status === 'pending' ? '#FFC107' :
                                    '#F44336'
                        }
                    ]}>
                        <Ionicons
                            name={
                                item.status === 'accepted' ? 'checkmark' :
                                    item.status === 'pending' ? 'time' :
                                        'close'
                            }
                            size={12}
                            color="#fff"
                        />
                    </View>
                    <Text style={[
                        styles.statusText,
                        {
                            color: item.status === 'accepted' ? '#4CAF50' :
                                item.status === 'pending' ? '#FFC107' :
                                    '#F44336'
                        }
                    ]}>
                        {item.status === 'accepted' ? 'Participation confirmed' :
                            item.status === 'pending' ? 'Request sent, pending' :
                                'Rejected'}
                    </Text>
                </View>
            </View>
        </View>
    );

    const styles = StyleSheet.create({
        container: {
            flex: 1,
        },
        header: {
            height: 150,
            alignItems: 'center',
            justifyContent: 'center',
            borderBottomLeftRadius: 30,
            borderBottomRightRadius: 30,
            shadowColor: '#000',
            shadowOffset: {
                width: 0,
                height: 5,
            },
            shadowOpacity: 0.2,
            shadowRadius: 8,
            elevation: 10,
        },
        headerGradient: {
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            bottom: 0,
            borderBottomLeftRadius: 30,
            borderBottomRightRadius: 30,
        },
        profileContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: 40,
            paddingHorizontal: 20,
        },
        profileImage: {
            width: 50,
            height: 50,
            borderRadius: 25,
            borderWidth: 2,
            borderColor: 'white',
            shadowColor: '#000',
            shadowOffset: {
                width: 0,
                height: 2,
            },
            shadowOpacity: 0.25,
            shadowRadius: 3.84,
            elevation: 5,
        },
        userInfo: {
            marginLeft: 15,
            alignItems: 'center',
        },
        userName: {
            fontSize: 20,
            fontWeight: 'bold',
            textShadowColor: 'rgba(0, 0, 0, 0.3)',
            textShadowOffset: { width: 0, height: 2 },
            textShadowRadius: 3,
        },
        userLevel: {
            fontSize: 14,
            marginTop: 2,
        },
        tabContainer: {
            flexDirection: 'row',
            justifyContent: 'center',
            marginVertical: 20,
            marginHorizontal: 20,
            borderRadius: 12,
            padding: 4,
            shadowColor: '#000',
            shadowOffset: {
                width: 0,
                height: 2,
            },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
        },
        tabButton: {
            flex: 1,
            paddingVertical: 12,
            alignItems: 'center',
            borderRadius: 8,
            backgroundColor: 'transparent',
        },
        activeTab: {},
        tabText: {
            fontSize: 16,
            fontWeight: '600',
        },
        activeTabText: {},
        hikeItem: {
            flexDirection: 'row',
            marginHorizontal: 20,
            marginBottom: 15,
            borderRadius: 12,
            padding: 15,
            shadowColor: '#000',
            shadowOffset: {
                width: 0,
                height: 2,
            },
            shadowOpacity: 0.1,
            shadowRadius: 4,
            elevation: 3,
        },
        hikeImage: {
            width: 80,
            height: 80,
            borderRadius: 8,
            marginRight: 15,
        },
        noImagePlaceholder: {
            justifyContent: 'center',
            alignItems: 'center',
        },
        noImageText: {
            fontSize: 12,
        },
        hikeInfo: {
            flex: 1,
            justifyContent: 'center',
        },
        hikeTitle: {
            fontSize: 16,
            fontWeight: '600',
            marginBottom: 6,
            flexShrink: 1,
        },
        hikeDetails: {
            fontSize: 14,
            marginBottom: 4,
        },
        eventHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
        },
        eventTitleContainer: {
            flex: 1,
            marginRight: 8,
        },
        eventButtons: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            flexShrink: 0,
        },
        infoButton: {
            padding: 4,
        },
        cancelButton: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#ff4444',
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: 12,
            marginLeft: 8,
            shadowColor: '#000',
            shadowOffset: {
                width: 0,
                height: 1,
            },
            shadowOpacity: 0.2,
            shadowRadius: 2,
            elevation: 3,
        },
        cancelButtonText: {
            color: '#fff',
            fontSize: 12,
            fontWeight: '600',
            marginLeft: 2,
        },
        emptyText: {
            textAlign: 'center',
            marginTop: 30,
            fontSize: 16,
            fontStyle: 'italic',
        },
        modalContainer: {
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'center',
            alignItems: 'center',
        },
        modalContent: {
            width: '90%',
            maxHeight: '80%',
            backgroundColor: '#fff',
            borderRadius: 15,
            overflow: 'hidden',
        },
        modalHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 15,
            backgroundColor: colors.primary,
        },
        modalTitle: {
            fontSize: 18,
            fontWeight: 'bold',
            color: '#fff',
            flex: 1,
            marginRight: 10,
        },
        modalScroll: {
            padding: 15,
        },
        infoSection: {
            marginBottom: 20,
        },
        infoTitle: {
            fontSize: 16,
            fontWeight: '600',
            color: colors.primary,
            marginBottom: 10,
        },
        infoText: {
            fontSize: 14,
            color: '#333',
            marginBottom: 8,
            lineHeight: 20,
        },
        closeButton: {
            padding: 5,
        },
        infoItem: {
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 8,
            backgroundColor: '#f5f5f5',
            padding: 10,
            borderRadius: 8,
        },
        bulletPoint: {
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: colors.primary,
            marginRight: 10,
        },
        updateItem: {
            padding: 10,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
            marginBottom: 10,
        },
        updateHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 4,
        },
        updateAuthor: {
            fontSize: 14,
            fontWeight: '600',
            color: colors.primary,
        },
        updateTime: {
            fontSize: 12,
            color: colors.secondaryText,
            marginBottom: 8,
        },
        updateText: {
            fontSize: 14,
            color: colors.text,
            marginBottom: 8,
        },
        updateImage: {
            width: '100%',
            height: 200,
            borderRadius: 8,
            marginTop: 8,
        },
        deleteButton: {
            padding: 4,
        },
        liveUpdatesHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 15,
        },
        addUpdateButton: {
            padding: 5,
        },
        loadingContainer: {
            padding: 20,
            alignItems: 'center',
        },
        noUpdatesText: {
            textAlign: 'center',
            color: colors.secondaryText,
            fontStyle: 'italic',
            marginTop: 10,
        },
        statusContainer: {
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: 4,
        },
        statusIndicator: {
            width: 16,
            height: 16,
            borderRadius: 8,
            justifyContent: 'center',
            alignItems: 'center',
            marginRight: 6,
        },
        statusText: {
            fontSize: 12,
            fontWeight: '500',
        },
        showMoreButton: {
            padding: 10,
            alignItems: 'center',
            backgroundColor: colors.background,
            borderRadius: 8,
            marginTop: 10,
            borderWidth: 1,
            borderColor: colors.primary,
        },
        showMoreText: {
            color: colors.primary,
            fontSize: 14,
            fontWeight: '500',
        },
    });

    const renderAllUpdatesModal = () => (
        <Modal
            visible={showAllUpdatesModal}
            animationType="slide"
            transparent={true}
            onRequestClose={() => setShowAllUpdatesModal(false)}
        >
            <View style={styles.modalContainer}>
                <View style={[styles.modalContent, { maxHeight: '90%' }]}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Toate actualizările</Text>
                        <TouchableOpacity
                            style={styles.closeButton}
                            onPress={() => setShowAllUpdatesModal(false)}
                        >
                            <Ionicons name="close" size={24} color="#fff" />
                        </TouchableOpacity>
                    </View>
                    <ScrollView style={styles.modalScroll}>
                        {isLoadingUpdates ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color={colors.primary} />
                            </View>
                        ) : liveUpdates.length > 0 ? (
                            liveUpdates.map(update => (
                                <View key={update.id} style={styles.updateItem}>
                                    {renderLiveUpdate(update)}
                                </View>
                            ))
                        ) : (
                            <Text style={styles.noUpdatesText}>Nu există actualizări pentru acest eveniment.</Text>
                        )}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );

    const renderModalContent = () => {
        if (!selectedEvent) {
            return <Text style={styles.infoText}>Nu există informații disponibile.</Text>;
        }

        const distance = Number(selectedEvent.distance) || 0;
        const meetingPoint = selectedEvent.meetingPoint || 'Nespecificat';

        const renderInfoItem = (text, key) => (
            <View key={key} style={styles.infoItem}>
                <View style={styles.bulletPoint} />
                <Text style={styles.infoText}>{text}</Text>
            </View>
        );

        return (
            <ScrollView style={styles.modalScroll}>
                <View style={styles.infoSection}>
                    <View style={styles.liveUpdatesHeader}>
                        <Text style={styles.infoTitle}>Actualizări Live</Text>
                        <TouchableOpacity
                            style={styles.addUpdateButton}
                            onPress={() => {
                                setShowInfoModal(false);
                                navigation.navigate('AddLiveUpdate', {
                                    eventId: selectedEvent.id,
                                    eventTitle: selectedEvent.eventTitle
                                });
                            }}
                        >
                            <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
                        </TouchableOpacity>
                    </View>

                    {isLoadingUpdates ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={colors.primary} />
                        </View>
                    ) : liveUpdates.length > 0 ? (
                        <>
                            {renderLiveUpdate(liveUpdates[0])}
                            {liveUpdates.length > 1 && (
                                <TouchableOpacity
                                    style={styles.showMoreButton}
                                    onPress={() => {
                                        setShowInfoModal(false);
                                        setShowAllUpdatesModal(true);
                                    }}
                                >
                                    <Text style={styles.showMoreText}>
                                        Arată toate actualizările ({liveUpdates.length})
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </>
                    ) : (
                        <Text style={styles.noUpdatesText}>Nu există actualizări pentru acest eveniment.</Text>
                    )}
                </View>

                <View style={styles.infoSection}>
                    <Text style={styles.infoTitle}>Detalii Generale</Text>
                    {renderInfoItem(`Distanță: ${distance} km`, 'distance')}
                    {renderInfoItem(`Durată estimată: ${getEstimatedTime(distance)}`, 'duration')}
                    {renderInfoItem(`Nivel de dificultate: ${getDifficultyLevel(distance)}`, 'difficulty')}
                    {renderInfoItem(`Punct de întâlnire: ${meetingPoint}`, 'meeting')}
                    {renderInfoItem(`Pregătire fizică: ${getPhysicalPreparation(distance)}`, 'preparation')}
                </View>

                <View style={styles.infoSection}>
                    <Text style={styles.infoTitle}>Echipament Recomandat</Text>
                    {getRecommendedEquipment(distance).map((item, index) => (
                        renderInfoItem(item, `equipment-${index}`)
                    ))}
                </View>

                <View style={styles.infoSection}>
                    <Text style={styles.infoTitle}>Sfaturi de Siguranță</Text>
                    {getSafetyTips(distance).map((tip, index) => (
                        renderInfoItem(tip, `safety-${index}`)
                    ))}
                </View>
            </ScrollView>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Secțiunea verde cu avatar și nume */}
            <View style={[styles.header, { backgroundColor: colors.primary }]}>
                <View style={[styles.headerGradient, { backgroundColor: colors.primary }]} />
                <View style={styles.profileContainer}>
                    <Image
                        source={{ uri: userData.photo }}
                        style={styles.profileImage}
                    />
                    <View style={styles.userInfo}>
                        <Text style={[styles.userName, { color: '#fff' }]}>{userData.name}</Text>
                        <Text style={[styles.userLevel, { color: 'rgba(255, 255, 255, 0.8)' }]}>{userData.level}</Text>
                    </View>
                </View>
            </View>

            {/* Butoane "Recent Hikes" & "Upcoming Events" */}
            <View style={[styles.tabContainer, { backgroundColor: colors.background }]}>
                <TouchableOpacity
                    style={[
                        styles.tabButton,
                        selectedTab === 'recent' && [styles.activeTab, { backgroundColor: colors.primary }],
                        { borderTopRightRadius: 0, borderBottomRightRadius: 0 },
                    ]}
                    onPress={() => setSelectedTab('recent')}
                >
                    <Text
                        style={[
                            styles.tabText,
                            { color: colors.secondaryText },
                            selectedTab === 'recent' && [styles.activeTabText, { color: colors.text }],
                        ]}
                    >
                        Recent Hikes
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.tabButton,
                        selectedTab === 'upcoming' && [styles.activeTab, { backgroundColor: colors.primary }],
                        { borderTopLeftRadius: 0, borderBottomLeftRadius: 0 },
                    ]}
                    onPress={() => setSelectedTab('upcoming')}
                >
                    <Text
                        style={[
                            styles.tabText,
                            { color: colors.secondaryText },
                            selectedTab === 'upcoming' && [styles.activeTabText, { color: colors.text }],
                        ]}
                    >
                        Upcoming Events
                    </Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={selectedTab === 'recent' ? recentHikes : upcomingEvents}
                keyExtractor={(item) => item.id}
                renderItem={selectedTab === 'recent' ? renderHikeItem : renderEventItem}
                ListEmptyComponent={
                    <Text style={[styles.emptyText, { color: colors.secondaryText }]}>
                        {selectedTab === 'recent' ? 'No hikes available.' : 'No upcoming events.'}
                    </Text>
                }
            />

            <Modal
                visible={showInfoModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowInfoModal(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle} numberOfLines={1}>
                                {selectedEvent ? selectedEvent.eventTitle : 'Informații despre Hike'}
                            </Text>
                            <TouchableOpacity
                                style={styles.closeButton}
                                onPress={() => setShowInfoModal(false)}
                            >
                                <Ionicons name="close" size={24} color="#fff" />
                            </TouchableOpacity>
                        </View>
                        {renderModalContent()}
                    </View>
                </View>
            </Modal>
            {renderAllUpdatesModal()}
        </View>
    );
}
