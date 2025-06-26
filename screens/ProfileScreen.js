import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    Image,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    Alert,
    Modal,
    TextInput,
    ScrollView,
    useColorScheme,
    Dimensions,
    StatusBar,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { auth, db } from '../config/firebase';
import { doc, onSnapshot, updateDoc, collection, query, where, orderBy, getDocs, addDoc, serverTimestamp, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';
import { AirbnbRating } from 'react-native-ratings';
import { signOut } from 'firebase/auth';
import { CommonActions, useFocusEffect } from '@react-navigation/native';
import moment from 'moment';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { NotificationService } from '../services/NotificationService';
import { useTheme } from '../context/ThemeContext';

// Import opțional - doar dacă dorești să copiezi "ph://"
import * as FileSystem from 'expo-file-system';

async function getLocalPathForIOSAsset(uri) {
    const fileName = `temp_image_${Date.now()}.jpg`;
    const dest = FileSystem.cacheDirectory + fileName;
    console.log('[DEBUG] Copying iOS asset from:', uri, 'to:', dest);
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
}

async function uploadToCloudinary(localUri) {
    console.log('[Cloudinary] Attempt upload, localUri:', localUri);

    const CLOUD_NAME = 'dludchtxw';
    const UPLOAD_PRESET = 'unsigned_preset';

    try {
        const response = await fetch(localUri);
        const blob = await response.blob();

        console.log('[Cloudinary] Blob created, size:', blob.size);

        const formData = new FormData();
        formData.append('file', {
            uri: localUri,
            type: 'image/jpeg', // explicit tip imagine
            name: 'photo.jpg',  // obligatoriu
        });
        formData.append('upload_preset', UPLOAD_PRESET);

        console.log('[Cloudinary] FormData constructed:', formData);

        const url = `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`;
        console.log('[Cloudinary] POST url:', url);

        const resp = await fetch(url, {
            method: 'POST',
            body: formData,
        });

        const responseText = await resp.text();
        console.log('[Cloudinary] Raw response:', responseText);

        let data;
        try {
            data = JSON.parse(responseText);
        } catch (jsonErr) {
            throw new Error('Invalid JSON response: ' + responseText);
        }

        if (data.secure_url) {
            console.log('[Cloudinary] Upload success, secure_url:', data.secure_url);
            return data.secure_url;
        } else {
            console.error('[Cloudinary] Upload error:', data);
            throw new Error('Cloudinary upload error: ' + JSON.stringify(data));
        }
    } catch (err) {
        console.error('[Cloudinary] Exception:', err);
        throw err;
    }
}

const handleLogout = async (navigation) => {
    try {
        await signOut(auth);
        // Nu mai este nevoie să resetăm manual navigarea
        // AppNavigator se va ocupa de redirecționare
    } catch (error) {
        console.error('Error signing out:', error);
        Alert.alert('Error', 'Could not sign out. Please try again.');
    }
};

export default function ProfileScreen({ route, navigation }) {
    const { isDarkMode, toggleDarkMode, colors } = useTheme();
    const [username, setUsername] = useState('John Doe');
    const [hikesCount, setHikesCount] = useState(0);
    const [totalKm, setTotalKm] = useState(0);
    const [followers, setFollowers] = useState(0);
    const [recentHikes, setRecentHikes] = useState([]);
    const [postedEvents, setPostedEvents] = useState([]);
    const [userReviews, setUserReviews] = useState([]);
    const [profileUri, setProfileUri] = useState('https://via.placeholder.com/80');
    const [visibleHikes, setVisibleHikes] = useState(2);
    const [visibleEvents, setVisibleEvents] = useState(1);
    const [visibleReviews, setVisibleReviews] = useState(2);
    const [userLocation, setUserLocation] = useState('');
    const [userCounty, setUserCounty] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [editedUsername, setEditedUsername] = useState('');
    const [editedPhone, setEditedPhone] = useState('');
    const [editedEmail, setEditedEmail] = useState('');
    const [editedLocation, setEditedLocation] = useState('');
    const [editedCounty, setEditedCounty] = useState('');
    const [averageRating, setAverageRating] = useState(0);
    const [isReviewModalVisible, setIsReviewModalVisible] = useState(false);
    const [newReviewRating, setNewReviewRating] = useState(3);
    const [newReviewComment, setNewReviewComment] = useState('');
    const [isQRModalVisible, setIsQRModalVisible] = useState(false);
    const [friendStatus, setFriendStatus] = useState(null);
    const [friendsList, setFriendsList] = useState([]);
    const [isFriendsModalVisible, setIsFriendsModalVisible] = useState(false);

    // Verificăm dacă suntem în modul de vizualizare a altui profil
    const isViewingOtherProfile = route.params?.userId !== undefined && route.params.userId !== auth.currentUser?.uid;
    const viewedUserId = isViewingOtherProfile ? route.params.userId : auth.currentUser?.uid;
    const isOwnProfile = !isViewingOtherProfile;

    useEffect(() => {
        // Configurăm header-ul și navigarea
        if (isViewingOtherProfile) {
            navigation.setOptions({
                headerShown: true,
                headerTitle: '',
                headerTransparent: true,
                headerLeft: () => (
                    <TouchableOpacity
                        style={styles.backButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Text style={styles.backButtonText}>←</Text>
                    </TouchableOpacity>
                ),
            });
        } else {
            navigation.setOptions({
                headerShown: false,
                tabBarVisible: true
            });
        }
    }, [navigation, isViewingOtherProfile]);

    // Când se schimbă focus-ul pe ecran, verificăm dacă trebuie să resetăm la profilul propriu
    useEffect(() => {
        const unsubscribe = navigation.addListener('focus', () => {
            // Dacă nu avem parametri în rută sau dacă userId este undefined, 
            // înseamnă că am ajuns aici prin tab navigation și trebuie să arătăm profilul propriu
            if (!route.params?.userId) {
                navigation.setParams({ userId: auth.currentUser?.uid });
            }
        });

        return unsubscribe;
    }, [navigation, route]);

    useEffect(() => {
        loadLocalData();

        if (viewedUserId) {
            const userDocRef = doc(db, 'users', viewedUserId);
            const reviewsRef = collection(db, 'reviews');

            // Preluăm datele utilizatorului
            const unsubscribeUser = onSnapshot(userDocRef, (snap) => {
                if (snap.exists()) {
                    const data = snap.data();
                    console.log('[ProfileScreen] Firestore user data:', data);
                    setUsername(data.displayName || 'John Doe');
                    setProfileUri(data.profilePhotoUrl || 'https://via.placeholder.com/80');
                    setUserLocation(data.location || '');
                    setUserCounty(data.county || '');
                    setPhone(data.phone || '');
                    setEmail(data.email || '');
                }
            });

            // Preluăm activitățile și evenimentele
            const activitiesQuery = query(
                collection(db, 'activities'),
                where('userId', '==', viewedUserId),
                orderBy('date', 'desc')
            );

            const eventsQuery = query(
                collection(db, 'posts'),
                where('userId', '==', viewedUserId),
                where('isEvent', '==', true),
                orderBy('date', 'desc')
            );

            const unsubscribeActivities = onSnapshot(activitiesQuery, (snapshot) => {
                const hikes = [];
                let totalDistance = 0;

                snapshot.forEach((doc) => {
                    const activityData = { id: doc.id, ...doc.data() };
                    hikes.push(activityData);
                    if (activityData.distance) {
                        totalDistance += parseFloat(activityData.distance);
                    }
                });

                setRecentHikes(hikes);
                setHikesCount(hikes.length);
                setTotalKm(Math.round(totalDistance));
            });

            const unsubscribeEvents = onSnapshot(eventsQuery, (snapshot) => {
                const events = [];
                snapshot.forEach((doc) => {
                    events.push({ id: doc.id, ...doc.data() });
                });
                setPostedEvents(events);
            });

            // Preluăm numărul de followers (prieteni)
            const friendsRef = collection(db, 'users', viewedUserId, 'friends');
            const unsubscribeFriends = onSnapshot(friendsRef, (snapshot) => {
                setFollowers(snapshot.size);
            });

            // Preluăm review-urile
            const reviewsQuery = query(
                reviewsRef,
                where('targetUserId', '==', viewedUserId),
                orderBy('createdAt', 'desc')
            );

            const unsubscribeReviews = onSnapshot(reviewsQuery, (snapshot) => {
                const reviews = [];
                let totalRating = 0;

                snapshot.forEach((doc) => {
                    const reviewData = { id: doc.id, ...doc.data() };
                    reviews.push(reviewData);
                    totalRating += reviewData.rating;
                });

                setUserReviews(reviews);
                setAverageRating(reviews.length > 0 ? totalRating / reviews.length : 0);
            });

            return () => {
                unsubscribeUser();
                unsubscribeActivities();
                unsubscribeEvents();
                unsubscribeReviews();
                unsubscribeFriends();
            };
        }
    }, [viewedUserId]);

    useEffect(() => { //#1
        const checkFriendStatus = async () => {
            try {
                const currentUser = auth.currentUser;
                const currentUserRef = doc(db, 'users', currentUser.uid);
                const viewedUserRef = doc(db, 'users', viewedUserId);

                const [currentUserDoc, viewedUserDoc] = await Promise.all([
                    getDoc(currentUserRef),
                    getDoc(viewedUserRef)
                ]);

                const currentUserData = currentUserDoc.data();
                const viewedUserData = viewedUserDoc.data();

                // Verificăm dacă suntem prieteni
                if (currentUserData.friends?.includes(viewedUserId)) {
                    setFriendStatus('friends');
                }
                // Verificăm dacă am trimis o cerere
                else if (currentUserData.sentFriendRequests?.some(req => req.receiverId === viewedUserId)) {
                    setFriendStatus('requested');
                }
                // Verificăm dacă am primit o cerere
                else if (currentUserData.friendRequests?.some(req => req.senderId === viewedUserId)) {
                    setFriendStatus('pending');
                } else {
                    setFriendStatus(null);
                }

                // Încărcăm lista de prieteni
                if (viewedUserData.friends) {
                    const friendsPromises = viewedUserData.friends.map(async (friendId) => {
                        const friendDoc = await getDoc(doc(db, 'users', friendId));
                        return {
                            id: friendId,
                            ...friendDoc.data()
                        };
                    });
                    const friends = await Promise.all(friendsPromises);
                    setFriendsList(friends);
                }
            } catch (error) {
                console.error('Error checking friend status:', error);
            }
        };

        checkFriendStatus();
    }, [viewedUserId]);

    const loadLocalData = async () => {
        try {
            const storedUsername = await AsyncStorage.getItem('username');
            if (storedUsername) setUsername(storedUsername);

            const storedActivities = await AsyncStorage.getItem('activities');
            if (storedActivities) {
                setRecentHikes(JSON.parse(storedActivities));
            }
        } catch (error) {
            console.error('Error loading data:', error);
        }
    };

    const handleChangeProfilePhoto = async () => {
        console.log('[ProfileScreen] Pressed +');

        if (!auth.currentUser) {
            Alert.alert('Not logged in', 'You must be logged in.');
            return;
        }

        console.log('[ProfileScreen] Requesting permission...');
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        console.log('[ProfileScreen] Perm status =>', status);

        if (status !== 'granted') {
            Alert.alert('Permission needed', 'We need gallery permission to set your profile photo.');
            return;
        }

        console.log('[ProfileScreen] Launching image library...');

        // Folosim sintaxa "deprecated" MediaTypeOptions.Images, dar care funcționează
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 1,
        });

        console.log('[ProfileScreen] Picker result:', result);

        if (!result.canceled && !result.cancelled) {
            try {
                // 'canceled' e nou, 'cancelled' e vechi, le testăm pe ambele
                // poate fi 'result.uri' sau 'result.assets[0].uri'
                let selectedUri;

                if (result.assets) {
                    // vers. nouă
                    selectedUri = result.assets[0].uri;
                } else if (result.uri) {
                    // vers. veche
                    selectedUri = result.uri;
                }

                console.log('[ProfileScreen] Selected URI =>', selectedUri);

                if (!selectedUri) {
                    Alert.alert('No image selected', 'No valid URI found.');
                    return;
                }

                if (selectedUri.startsWith('ph://') || selectedUri.startsWith('assets-library://')) {
                    console.log('[ProfileScreen] iOS asset, copying to local...');
                    selectedUri = await getLocalPathForIOSAsset(selectedUri);
                    console.log('[ProfileScreen] New local path:', selectedUri);
                }

                // Upload la Cloudinary
                const uploadedUrl = await uploadToCloudinary(selectedUri);

                // Update Firestore
                const userId = auth.currentUser.uid;
                console.log('[ProfileScreen] Updating Firestore doc with photo:', uploadedUrl);
                await updateDoc(doc(db, 'users', userId), {
                    profilePhotoUrl: uploadedUrl,
                });

                // set local
                setProfileUri(uploadedUrl);
                Alert.alert('Success', 'Profile photo updated!');
            } catch (err) {
                console.error('[ProfileScreen] handleChangeProfilePhoto error:', err);
                Alert.alert('Upload error', err.message);
            }
        } else {
            console.log('[ProfileScreen] User canceled picking an image.');
        }
    };

    const handleShowMoreHikes = () => {
        if (visibleHikes < recentHikes.length) {
            setVisibleHikes(prev => prev + 2);
        }
    };

    const handleShowMoreEvents = () => {
        if (visibleEvents < postedEvents.length) {
            setVisibleEvents(prev => prev + 2);
        }
    };

    const handleShowMoreReviews = () => {
        if (visibleReviews < userReviews.length) {
            setVisibleReviews(prev => prev + 2);
        }
    };

    const handleEditProfile = () => {
        setIsEditingProfile(true);
        setEditedUsername(username);
        setEditedPhone(phone);
        setEditedEmail(email);
        setEditedLocation(userLocation);
        setEditedCounty(userCounty);
    };

    const handleSaveProfile = async () => {
        try {
            const userId = auth.currentUser.uid;
            await updateDoc(doc(db, 'users', userId), {
                displayName: editedUsername,
                phone: editedPhone,
                email: editedEmail,
                location: editedLocation,
                county: editedCounty
            });
            setIsEditingProfile(false);
            Alert.alert('Succes', 'Profilul a fost actualizat cu succes!');
        } catch (error) {
            console.error('Error updating profile:', error);
            Alert.alert('Eroare', 'Nu am putut actualiza profilul. Încearcă din nou.');
        }
    };

    const handleAddReview = async () => {
        if (!auth.currentUser) {
            Alert.alert('Error', 'You must be logged in to add a review.');
            return;
        }

        try {
            const reviewData = {
                targetUserId: viewedUserId,
                reviewerId: auth.currentUser.uid,
                rating: newReviewRating,
                comment: newReviewComment,
                createdAt: serverTimestamp(),
                reviewerName: auth.currentUser.displayName || 'Anonymous'
            };

            await addDoc(collection(db, 'reviews'), reviewData);
            setIsReviewModalVisible(false);
            setNewReviewComment('');
            setNewReviewRating(3);
            Alert.alert('Success', 'Review added successfully!');
        } catch (error) {
            console.error('Error adding review:', error);
            Alert.alert('Error', 'Failed to add review. Please try again.');
        }
    };

    const handleToggleDarkMode = () => { //#2
        toggleDarkMode();
    };

    const handleFriendRequest = async () => {
        try {
            const currentUser = auth.currentUser;
            const currentUserRef = doc(db, 'users', currentUser.uid);
            const viewedUserRef = doc(db, 'users', viewedUserId);

            if (friendStatus === null) {
                // Trimitem cerere de prietenie
                const requestId = Date.now().toString();
                const requestData = {
                    id: requestId,
                    senderId: currentUser.uid,
                    receiverId: viewedUserId,
                    timestamp: new Date()
                };

                await updateDoc(currentUserRef, {
                    sentFriendRequests: arrayUnion(requestData)
                });

                await updateDoc(viewedUserRef, {
                    friendRequests: arrayUnion(requestData)
                });

                // Trimitem notificarea
                await NotificationService.sendFriendRequestNotification(
                    viewedUserId,
                    currentUser.displayName || 'Cineva'
                );

                setFriendStatus('requested');
                Alert.alert('Succes', 'Cererea de prietenie a fost trimisă!');
            } else if (friendStatus === 'requested') {
                // Anulăm cererea de prietenie
                const currentUserDoc = await getDoc(currentUserRef);
                const currentUserData = currentUserDoc.data();
                const request = currentUserData.sentFriendRequests.find(
                    req => req.receiverId === viewedUserId
                );

                if (request) {
                    await updateDoc(currentUserRef, {
                        sentFriendRequests: arrayRemove(request)
                    });

                    await updateDoc(viewedUserRef, {
                        friendRequests: arrayRemove(request)
                    });

                    setFriendStatus(null);
                    Alert.alert('Succes', 'Cererea de prietenie a fost anulată!');
                }
            }
        } catch (error) {
            console.error('Error handling friend request:', error);
            Alert.alert('Eroare', 'Nu am putut procesa cererea de prietenie.');
        }
    };

    const handleRemoveFriend = async (friendId) => {
        try {
            const currentUser = auth.currentUser;
            const currentUserRef = doc(db, 'users', currentUser.uid);
            const friendRef = doc(db, 'users', friendId);

            await updateDoc(currentUserRef, {
                friends: arrayRemove(friendId)
            });

            await updateDoc(friendRef, {
                friends: arrayRemove(currentUser.uid)
            });

            setFriendsList(prev => prev.filter(friend => friend.id !== friendId));
            Alert.alert('Succes', 'Prietenul a fost eliminat.');
        } catch (error) {
            console.error('Error removing friend:', error);
            Alert.alert('Eroare', 'Nu am putut elimina prietenul.');
        }
    };

    const renderFriendsModal = () => (
        <Modal
            visible={isFriendsModalVisible}
            transparent={true}
            animationType="slide"
            onRequestClose={() => setIsFriendsModalVisible(false)}
        >
            <View style={styles.modalContainer}>
                <View style={styles.modalContent}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>Lista de prieteni</Text>
                        <TouchableOpacity
                            style={styles.closeButton}
                            onPress={() => setIsFriendsModalVisible(false)}
                        >
                            <Ionicons name="close" size={24} color="#333" />
                        </TouchableOpacity>
                    </View>
                    <FlatList
                        data={friendsList}
                        keyExtractor={item => item.id}
                        renderItem={({ item }) => (
                            <View style={styles.friendItem}>
                                <Image
                                    source={{ uri: item.profilePhotoUrl }}
                                    style={styles.friendPhoto}
                                />
                                <View style={styles.friendInfo}>
                                    <Text style={styles.friendName}>{item.displayName}</Text>
                                    <Text style={styles.friendLevel}>{item.level || 'Hiking Enthusiast'}</Text>
                                </View>
                                <TouchableOpacity
                                    style={styles.removeFriendButton}
                                    onPress={() => handleRemoveFriend(item.id)}
                                >
                                    <Ionicons name="close-circle" size={24} color="#ff4444" />
                                </TouchableOpacity>
                            </View>
                        )}
                    />
                </View>
            </View>
        </Modal>
    );

    const renderProfileHeader = () => (
        <View style={styles.profileHeader}>
            <View style={styles.profileImageContainer}>
                <Image
                    source={{ uri: profileUri }}
                    style={styles.profileImage}
                />
                <TouchableOpacity
                    style={styles.editImageButton}
                    onPress={handleChangeProfilePhoto}
                >
                    <Text style={styles.editImageButtonText}>Change Photo</Text>
                </TouchableOpacity>
            </View>
            <View style={styles.profileInfo}>
                <Text style={styles.username}>{username}</Text>
                <Text style={styles.level}>{userData?.level || 'Hiking Novice'}</Text>
                <View style={styles.statsContainer}>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{hikesCount}</Text>
                        <Text style={styles.statLabel}>Hikes</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{totalKm}</Text>
                        <Text style={styles.statLabel}>km</Text>
                    </View>
                </View>
            </View>
        </View>
    );

    // Resetăm numărul de elemente vizibile când utilizatorul părăsește pagina
    useFocusEffect(
        React.useCallback(() => {
            return () => {
                setVisibleHikes(2);
                setVisibleEvents(1);
                setVisibleReviews(2);
            };
        }, [])
    );

    return (
        <ScrollView
            style={[
                styles.container,
                { backgroundColor: colors.background }
            ]}
            contentContainerStyle={styles.contentContainer}
        >
            <LinearGradient
                colors={['#556B2F', '#3d4a21']}
                style={[styles.header, isDarkMode && styles.darkHeader]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                <View style={styles.headerContent}>
                    <Text style={[styles.pageTitle, { color: '#fff' }]}>
                        {isOwnProfile ? 'Profile page' : `${username}'s Profile`}
                    </Text>
                </View>
            </LinearGradient>

            {/* QR Button */}
            <TouchableOpacity
                style={styles.qrButton}
                onPress={() => setIsQRModalVisible(true)}
            >
                <Text style={styles.qrButtonText}>QR</Text>
            </TouchableOpacity>

            {/* QR Modal */}
            <Modal
                visible={isQRModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setIsQRModalVisible(false)}
            >
                <View style={styles.qrModalContainer}>
                    <View style={styles.qrModalContent}>
                        <Text style={styles.qrModalTitle}>{username}</Text>
                        <View style={styles.qrCodeContainer}>
                            <Image
                                source={require('../assets/dummyqr.png')}
                                style={styles.qrCodeImage}
                                resizeMode="contain"
                            />
                        </View>
                        <Text style={styles.qrDescription}>Scanează pentru a vedea profilul</Text>
                        <TouchableOpacity
                            style={styles.closeQRButton}
                            onPress={() => setIsQRModalVisible(false)}
                        >
                            <Text style={styles.closeQRButtonText}>Închide</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Imagine profil + buton */}
            <View style={styles.profileContainer}>
                <View style={styles.profileImageWrapper}>
                    <Image source={{ uri: profileUri }} style={styles.profileImage} />
                    {isOwnProfile && (
                        <TouchableOpacity
                            style={styles.editPhotoButton}
                            onPress={handleChangeProfilePhoto}
                        >
                            <Text style={styles.editPhotoText}>+</Text>
                        </TouchableOpacity>
                    )}
                </View>
                <View style={styles.nameContainer}>
                    <View style={styles.nameAndLocationContainer}>
                        <View style={styles.nameRow}>
                            {isEditingProfile ? (
                                <TextInput
                                    style={[styles.editNameInput, isDarkMode && styles.darkInput]}
                                    value={editedUsername}
                                    onChangeText={setEditedUsername}
                                    placeholder="Nume utilizator"
                                    placeholderTextColor={isDarkMode ? "#999" : "#000"}
                                />
                            ) : (
                                <Text style={[styles.userName, isDarkMode && styles.darkText]}>{username}</Text>
                            )}
                            {isOwnProfile && (
                                <TouchableOpacity
                                    style={styles.editProfileButton}
                                    onPress={isEditingProfile ? handleSaveProfile : handleEditProfile}
                                >
                                    <Text style={styles.editProfileText}>✎</Text>
                                </TouchableOpacity>
                            )}
                            {!isOwnProfile && (
                                <View style={styles.friendButtonContainer}>
                                    <TouchableOpacity
                                        style={[
                                            styles.friendButton,
                                            friendStatus === 'friends' && styles.friendsButton,
                                            friendStatus === 'pending' && styles.pendingButton,
                                            friendStatus === 'requested' && styles.requestedButton
                                        ]}
                                        onPress={handleFriendRequest}
                                    >
                                        <Text style={[
                                            styles.friendButtonText,
                                            friendStatus === 'friends' && styles.friendsButtonText
                                        ]}>
                                            {friendStatus === 'friends' ? 'Prieteni' :
                                                friendStatus === 'pending' ? 'Acceptă cererea' :
                                                    friendStatus === 'requested' ? 'Anulează cererea' :
                                                        'Adaugă prieten'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            )}
                        </View>
                        <Text style={[styles.userLocation, isDarkMode && styles.darkSecondaryText]}>{userLocation}, {userCounty}</Text>
                    </View>
                </View>
            </View>

            {/* Statistici utilizator */}
            <View style={styles.statsContainer}>
                <View style={styles.statBox}>
                    <Text style={[styles.statNumber, isDarkMode && styles.darkText]}>{hikesCount}</Text>
                    <Text style={[styles.statLabel, isDarkMode && styles.darkSecondaryText]}>Hikes</Text>
                </View>
                <View style={styles.statBox}>
                    <Text style={[styles.statNumber, isDarkMode && styles.darkText]}>{totalKm}</Text>
                    <Text style={[styles.statLabel, isDarkMode && styles.darkSecondaryText]}>Km</Text>
                </View>
                <TouchableOpacity
                    style={styles.statBox}
                    onPress={() => isOwnProfile && setIsFriendsModalVisible(true)}
                >
                    <Text style={[styles.statNumber, isDarkMode && styles.darkText]}>{friendsList.length}</Text>
                    <Text style={[styles.statLabel, isDarkMode && styles.darkSecondaryText]}>Friends</Text>
                </TouchableOpacity>
            </View>

            {renderFriendsModal()}

            {/* Nivel utilizator */}
            <View style={styles.levelContainer}>
                <Image source={require('../assets/levels/hikelevel1.png')} style={styles.levelIcon} />
                <Text style={[styles.levelText, isDarkMode && styles.darkText]}>Hiking Enthusiast</Text>
            </View>

            {/* Ultimele hike-uri */}
            <Text style={[styles.sectionTitle, isDarkMode && styles.darkText]}>{username}'s latest hikes</Text>
            <View style={styles.hikesContainer}>
                {recentHikes.length === 0 ? (
                    <Text style={[styles.emptyText, isDarkMode && styles.darkSecondaryText]}>No hikes available.</Text>
                ) : (
                    <>
                        {recentHikes.slice(0, visibleHikes).map((item, index) => (
                            <View key={item.id || index} style={[styles.hikeItem, isDarkMode && styles.darkItem]}>
                                {item.imageUrl ? (
                                    <Image
                                        source={{ uri: item.imageUrl }}
                                        style={styles.hikeImage}
                                    />
                                ) : (
                                    <View style={[styles.hikeImage, styles.noImagePlaceholder]}>
                                        <Text style={[styles.noImageText, isDarkMode && styles.darkSecondaryText]}>No Map</Text>
                                    </View>
                                )}
                                <View style={styles.hikeInfo}>
                                    <Text style={[styles.hikeTitle, isDarkMode && styles.darkText]}>{item.trailName}</Text>
                                    <Text style={[styles.hikeDetails, isDarkMode && styles.darkSecondaryText]}>
                                        Distance: {item.distance} km
                                    </Text>
                                    {item.elapsedTime && (
                                        <Text style={[styles.hikeDetails, isDarkMode && styles.darkSecondaryText]}>Time: {item.elapsedTime}</Text>
                                    )}
                                    <Text style={[styles.hikeDetails, isDarkMode && styles.darkSecondaryText]}>Date: {item.date}</Text>
                                </View>
                            </View>
                        ))}
                        {recentHikes.length > visibleHikes && (
                            <TouchableOpacity
                                style={styles.showMoreButton}
                                onPress={handleShowMoreHikes}
                            >
                                <Text style={styles.showMoreText}>Show More</Text>
                            </TouchableOpacity>
                        )}
                    </>
                )}
            </View>

            {/* Evenimente postate */}
            <Text style={[styles.sectionTitle, isDarkMode && styles.darkText]}>{username}'s posted events</Text>
            <View style={styles.eventsContainer}>
                {postedEvents.length === 0 ? (
                    <Text style={[styles.emptyText, isDarkMode && styles.darkSecondaryText]}>No events available.</Text>
                ) : (
                    <>
                        {postedEvents.slice(0, visibleEvents).map((item, index) => (
                            <View key={item.id || index} style={[styles.eventItem, isDarkMode && styles.darkItem]}>
                                {item.imageUrl ? (
                                    <Image
                                        source={{ uri: item.imageUrl }}
                                        style={styles.eventImage}
                                    />
                                ) : (
                                    <View style={[styles.eventImage, styles.noImagePlaceholder]}>
                                        <Text style={[styles.noImageText, isDarkMode && styles.darkSecondaryText]}>No Image</Text>
                                    </View>
                                )}
                                <View style={styles.eventInfo}>
                                    <Text style={[styles.eventTitle, isDarkMode && styles.darkText]}>{item.title}</Text>
                                    <Text style={[styles.eventDetails, isDarkMode && styles.darkSecondaryText]}>Location: {item.location}</Text>
                                    <Text style={[styles.eventDetails, isDarkMode && styles.darkSecondaryText]}>Distance: {item.distance} km</Text>
                                    <Text style={[styles.eventDetails, isDarkMode && styles.darkSecondaryText]}>Meeting point: {item.meetingPoint}</Text>
                                    <Text style={[styles.eventDetails, isDarkMode && styles.darkSecondaryText]}>Date: {moment(item.date.toDate()).format('YYYY-MM-DD')}</Text>
                                </View>
                            </View>
                        ))}
                        {postedEvents.length > visibleEvents && (
                            <TouchableOpacity
                                style={styles.showMoreButton}
                                onPress={handleShowMoreEvents}
                            >
                                <Text style={styles.showMoreText}>Show More</Text>
                            </TouchableOpacity>
                        )}
                    </>
                )}
            </View>

            {/* Recenzii */}
            <View style={styles.reviewsHeader}>
                <Text style={[styles.sectionTitle, isDarkMode && styles.darkText]}>{username}'s reviews</Text>
                <View style={[styles.ratingContainer, isDarkMode && styles.darkRatingContainer]}>
                    <View style={styles.ratingContent}>
                        <Text style={[styles.ratingText, isDarkMode && styles.darkText]}>{averageRating.toFixed(1)}</Text>
                        <Text style={styles.starIcon}>★</Text>
                    </View>
                </View>
            </View>

            {!isOwnProfile && (
                <TouchableOpacity
                    style={[styles.addReviewButton, isDarkMode && styles.darkAddReviewButton]}
                    onPress={() => setIsReviewModalVisible(true)}
                >
                    <Text style={styles.addReviewText}>Add Review</Text>
                </TouchableOpacity>
            )}

            <View style={styles.reviewsContainer}>
                {userReviews.length === 0 ? (
                    <View style={[styles.emptyReviewContainer, isDarkMode && styles.darkEmptyReviewContainer]}>
                        <Text style={[styles.emptyText, isDarkMode && styles.darkSecondaryText]}>No reviews available.</Text>
                    </View>
                ) : (
                    <>
                        {userReviews.slice(0, visibleReviews).map((item) => (
                            <View key={item.id} style={[styles.reviewItem, isDarkMode && styles.darkItem]}>
                                <View style={styles.reviewHeader}>
                                    <View style={styles.reviewerInfo}>
                                        <Text style={[styles.reviewerName, isDarkMode && styles.darkText]}>{item.reviewerName}</Text>
                                        <View style={styles.ratingDisplay}>
                                            <Text style={[styles.ratingText, isDarkMode && styles.darkText]}>{item.rating.toFixed(1)}</Text>
                                            <Text style={styles.smallStarIcon}>★</Text>
                                        </View>
                                    </View>
                                </View>
                                <Text style={[styles.reviewComment, isDarkMode && styles.darkSecondaryText]}>{item.comment}</Text>
                            </View>
                        ))}
                        {userReviews.length > visibleReviews && (
                            <TouchableOpacity
                                style={[styles.showMoreButton, isDarkMode && styles.darkShowMoreButton]}
                                onPress={handleShowMoreReviews}
                            >
                                <Text style={styles.showMoreText}>Show More</Text>
                            </TouchableOpacity>
                        )}
                    </>
                )}
            </View>

            {/* Dark Mode Toggle Button */}
            {isOwnProfile && (
                <TouchableOpacity
                    style={[
                        styles.darkModeButton,
                        { backgroundColor: colors.secondary }
                    ]}
                    onPress={handleToggleDarkMode}
                >
                    <Text style={[
                        styles.darkModeText,
                        { color: colors.text }
                    ]}>
                        {isDarkMode ? '☀️ Light Mode' : '🌙 Dark Mode'}
                    </Text>
                </TouchableOpacity>
            )}

            {/* Logout Button */}
            {isOwnProfile && (
                <>
                    <TouchableOpacity
                        style={styles.logoutButton}
                        onPress={() => handleLogout(navigation)}
                    >
                        <Text style={styles.logoutText}>Logout</Text>
                    </TouchableOpacity>
                </>
            )}

            {/* Modal pentru adăugare review */}
            <Modal
                visible={isReviewModalVisible}
                animationType="slide"
                transparent={true}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Add Review</Text>

                        <AirbnbRating
                            count={5}
                            defaultRating={newReviewRating}
                            size={30}
                            onFinishRating={(rating) => setNewReviewRating(rating)}
                        />

                        <TextInput
                            style={styles.reviewInput}
                            placeholder="Write your review here..."
                            multiline
                            value={newReviewComment}
                            onChangeText={setNewReviewComment}
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={() => setIsReviewModalVisible(false)}
                            >
                                <Text style={styles.modalButtonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.submitButton]}
                                onPress={handleAddReview}
                            >
                                <Text style={styles.modalButtonText}>Submit</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Modal pentru editare profil */}
            <Modal
                visible={isEditingProfile}
                animationType="slide"
                transparent={true}
            >
                <View style={styles.modalContainer}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Edit Profile</Text>
                            <TouchableOpacity
                                style={styles.closeButton}
                                onPress={() => setIsEditingProfile(false)}
                            >
                                <Text style={styles.closeButtonText}>✗</Text>
                            </TouchableOpacity>
                        </View>

                        <TextInput
                            style={styles.modalInput}
                            placeholder="Nume utilizator"
                            value={editedUsername}
                            onChangeText={setEditedUsername}
                        />

                        <TextInput
                            style={styles.modalInput}
                            placeholder="Număr de telefon"
                            value={editedPhone}
                            onChangeText={setEditedPhone}
                            keyboardType="phone-pad"
                        />

                        <TextInput
                            style={styles.modalInput}
                            placeholder="Email"
                            value={editedEmail}
                            onChangeText={setEditedEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />

                        <TextInput
                            style={styles.modalInput}
                            placeholder="Localitate"
                            value={editedLocation}
                            onChangeText={setEditedLocation}
                        />

                        <TextInput
                            style={styles.modalInput}
                            placeholder="Județ"
                            value={editedCounty}
                            onChangeText={setEditedCounty}
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={() => setIsEditingProfile(false)}
                            >
                                <Text style={styles.modalButtonText}>Anulează</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.submitButton]}
                                onPress={handleSaveProfile}
                            >
                                <Text style={styles.modalButtonText}>Salvează</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
}

//
// STILURI
//
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFF',
    },
    contentContainer: {
        paddingBottom: 100,
    },
    header: {
        height: 120,
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
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    pageTitle: {
        fontSize: 20,
        color: 'white',
        fontWeight: 'bold',
        marginTop: 45,
    },
    profileContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginTop: -40,
        paddingLeft: 20,
    },
    profileImageWrapper: {
        width: 85,
        height: 85,
        borderRadius: 42.5,
        backgroundColor: 'white',
        borderWidth: 3,
        borderColor: 'gray',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    profileImage: {
        width: 75,
        height: 75,
        borderRadius: 37.5,
    },
    editPhotoButton: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 25,
        height: 25,
        borderRadius: 12.5,
        backgroundColor: '#556B2F',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#FFF',
    },
    editPhotoText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 16,
        lineHeight: 16,
    },
    nameContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginLeft: 15,
        marginTop: 45,
        flex: 1,
    },
    nameAndLocationContainer: {
        flex: 1,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
        width: '100%',
    },
    userName: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    userLocation: {
        fontSize: 14,
        color: '#666',
        marginTop: 0,
    },
    editProfileButton: {
        marginLeft: 8,
        padding: 5,
    },
    editProfileText: {
        fontSize: 20,
        color: '#556B2F',
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        marginTop: 20,
    },
    statBox: {
        alignItems: 'center',
    },
    statNumber: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    statLabel: {
        fontSize: 14,
        color: 'gray',
    },
    levelContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
        marginVertical: 15,
        paddingLeft: 30,
    },
    levelIcon: {
        width: 60,
        height: 60,
        marginRight: 12,
    },
    levelText: {
        fontSize: 16,
        color: '#556B2F',
        fontWeight: 'bold',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginLeft: 35,
        marginTop: 20,
    },
    hikesContainer: {
        marginHorizontal: 15,
        marginTop: 10,
        marginBottom: 20,
    },
    hikeItem: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        padding: 12,
        borderRadius: 12,
        marginBottom: 12,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#E8E8E8',
    },
    hikeImage: {
        width: 80,
        height: 80,
        borderRadius: 8,
        marginRight: 15,
        borderWidth: 1,
        borderColor: '#E8E8E8',
    },
    noImagePlaceholder: {
        backgroundColor: '#E0E0E0',
        justifyContent: 'center',
        alignItems: 'center',
    },
    noImageText: {
        color: '#888',
        fontSize: 12,
    },
    hikeInfo: {
        flex: 1,
    },
    hikeTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 4,
    },
    hikeDetails: {
        fontSize: 14,
        color: '#666',
        marginBottom: 2,
    },
    showMoreButton: {
        backgroundColor: '#556B2F',
        padding: 10,
        borderRadius: 20,
        alignItems: 'center',
        marginTop: 10,
    },
    showMoreText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    emptyText: {
        textAlign: 'center',
        color: '#999',
        marginTop: 20,
        marginBottom: 20,
        fontSize: 16,
    },
    reviewsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginLeft: 5,
        marginTop: 20,
        marginBottom: 15,
        marginRight: 35,
    },
    ratingContainer: {
        backgroundColor: '#E8F5E9',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 15,
        minWidth: 60,
        alignItems: 'center',
        marginTop: 20,
    },
    darkRatingContainer: {
        backgroundColor: '#2D2D2D',
    },
    ratingContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    ratingText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#556B2F',
        marginRight: 2,
    },
    starIcon: {
        fontSize: 16,
        color: '#FFD700',
    },
    addReviewButton: {
        backgroundColor: '#556B2F',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 25,
        alignSelf: 'center',
        marginVertical: 15,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
    },
    darkAddReviewButton: {
        backgroundColor: '#3d4a21',
    },
    addReviewText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    reviewsContainer: {
        marginHorizontal: 15,
        marginBottom: 20,
    },
    reviewItem: {
        backgroundColor: '#FFFFFF',
        padding: 16,
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
        borderWidth: 1,
        borderColor: '#E8E8E8',
    },
    reviewHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    reviewerInfo: {
        flex: 1,
    },
    reviewerName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 4,
    },
    ratingDisplay: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    smallStarIcon: {
        fontSize: 16,
        color: '#FFD700',
        marginLeft: 4,
    },
    reviewComment: {
        fontSize: 14,
        color: '#666',
        lineHeight: 20,
    },
    emptyReviewContainer: {
        backgroundColor: '#FFFFFF',
        padding: 20,
        borderRadius: 12,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#E8E8E8',
    },
    darkEmptyReviewContainer: {
        backgroundColor: '#2D2D2D',
        borderColor: '#404040',
    },
    darkShowMoreButton: {
        backgroundColor: '#3d4a21',
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
    closeButton: {
        padding: 5,
    },
    closeButtonText: {
        fontSize: 24,
        color: '#666',
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 20,
    },
    cancelButton: {
        backgroundColor: '#ff4444',
        flex: 1,
        marginRight: 10,
        padding: 12,
        borderRadius: 10,
        alignItems: 'center',
    },
    submitButton: {
        backgroundColor: '#556B2F',
        flex: 1,
        marginLeft: 10,
        padding: 12,
        borderRadius: 10,
        alignItems: 'center',
    },
    modalButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    logoutButton: {
        backgroundColor: '#ff4444',
        padding: 15,
        borderRadius: 20,
        alignItems: 'center',
        marginHorizontal: 35,
        marginTop: 20,
        marginBottom: 80,
    },
    logoutText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    darkContainer: {
        backgroundColor: '#1a1a1a',
    },
    darkModeButton: {
        backgroundColor: '#f0f0f0',
        padding: 15,
        borderRadius: 20,
        alignItems: 'center',
        marginHorizontal: 35,
        marginTop: 20,
        marginBottom: 20,
    },
    darkModeButtonActive: {
        backgroundColor: '#333333',
    },
    darkModeText: {
        color: '#333333',
        fontSize: 16,
        fontWeight: 'bold',
    },
    darkModeTextActive: {
        color: '#ffffff',
    },
    darkText: {
        color: '#ffffff',
    },
    darkSecondaryText: {
        color: '#cccccc',
    },
    darkItem: {
        backgroundColor: '#2d2d2d',
    },
    darkInput: {
        backgroundColor: '#2d2d2d',
        color: '#ffffff',
        borderBottomColor: '#ffffff',
    },
    qrButton: {
        position: 'absolute',
        top: 60,
        right: 20,
        backgroundColor: '#556B2F',
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    qrButtonText: {
        color: 'white',
        fontSize: 14,
        fontWeight: 'bold',
    },
    qrModalContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    qrModalContent: {
        backgroundColor: 'white',
        padding: 20,
        borderRadius: 15,
        width: '80%',
        alignItems: 'center',
    },
    qrModalTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 20,
        color: '#556B2F',
    },
    qrCodeContainer: {
        padding: 20,
        backgroundColor: 'white',
        borderRadius: 10,
        marginBottom: 20,
    },
    qrDescription: {
        fontSize: 14,
        color: '#666',
        marginBottom: 20,
        textAlign: 'center'
    },
    closeQRButton: {
        backgroundColor: '#556B2F',
        paddingHorizontal: 30,
        paddingVertical: 10,
        borderRadius: 20,
    },
    closeQRButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    qrCodeImage: {
        width: 300,
        height: 300,
    },
    darkHeader: {
        backgroundColor: '#556B2F',
    },
    eventsContainer: {
        marginHorizontal: 15,
        marginTop: 10,
        marginBottom: 20,
    },
    eventItem: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        padding: 12,
        borderRadius: 12,
        marginBottom: 12,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#E8E8E8',
    },
    eventImage: {
        width: 80,
        height: 80,
        borderRadius: 8,
        marginRight: 15,
        borderWidth: 1,
        borderColor: '#E8E8E8',
    },
    eventInfo: {
        flex: 1,
    },
    eventTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333',
        marginBottom: 4,
    },
    eventDetails: {
        fontSize: 14,
        color: '#666',
        marginBottom: 2,
    },
    modalInput: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 10,
        padding: 12,
        marginBottom: 15,
        fontSize: 16,
        backgroundColor: '#f9f9f9',
        color: '#333',
        width: '100%',
        height: 50,
    },
    friendButtonContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 5,
    },
    friendButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 15,
        backgroundColor: '#556B2F',
    },
    friendsButton: {
        backgroundColor: '#E8E8E8',
    },
    pendingButton: {
        backgroundColor: '#FFA500',
    },
    requestedButton: {
        backgroundColor: '#E8E8E8',
    },
    friendButtonText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '500',
    },
    friendsButtonText: {
        color: '#666',
    },
    friendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#eee',
    },
    friendPhoto: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginRight: 15,
    },
    friendInfo: {
        flex: 1,
    },
    friendName: {
        fontSize: 16,
        fontWeight: '500',
        marginBottom: 4,
    },
    friendLevel: {
        fontSize: 14,
        color: '#666',
    },
    removeFriendButton: {
        padding: 5,
    },
    testNotificationButton: {
        backgroundColor: '#556B2F',
        padding: 15,
        borderRadius: 20,
        alignItems: 'center',
        marginHorizontal: 35,
        marginTop: 10,
        marginBottom: 10,
    },
    testNotificationButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
});