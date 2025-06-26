import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    Image,
    TouchableOpacity,
    FlatList,
    Alert,
    StyleSheet,
    Dimensions,
    Modal,
    ScrollView,
    RefreshControl,
    Switch,
    Platform,
} from 'react-native';
import { collection, query, orderBy, onSnapshot, doc, addDoc, updateDoc, arrayUnion, arrayRemove, Timestamp, getDocs, getDoc, where, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import moment from 'moment';
import * as ImagePicker from 'expo-image-picker';
import { uploadToCloudinary } from '../utils/cloudinary';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import DateTimePicker from '@react-native-community/datetimepicker';
//#1
function CreateEventModal({ visible, onClose, currentUserData }) {
    const { colors, isDarkMode } = useTheme();
    const [eventTitle, setEventTitle] = useState('');
    const [eventDescription, setEventDescription] = useState('');
    const [eventDate, setEventDate] = useState('');
    const [eventTime, setEventTime] = useState('');
    const [eventLocation, setEventLocation] = useState('');
    const [imageUri, setImageUri] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [distance, setDistance] = useState('');
    const [meetingPoint, setMeetingPoint] = useState('');

    const handleImagePick = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'We need gallery permissions to add an image.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [16, 9],
            quality: 1,
        });

        if (!result.canceled && result.assets) {
            setImageUri(result.assets[0].uri);
        }
    };

    const handleSubmit = async () => {
        if (!eventTitle || !eventDescription || !eventDate || !eventTime || !eventLocation || !distance || !meetingPoint) {
            Alert.alert('Error', 'Please fill in all fields.');
            return;
        }

        setIsLoading(true);
        try {
            let imageUrl = null;
            if (imageUri) {
                imageUrl = await uploadToCloudinary(imageUri);
            }

            // Combinăm data și ora
            const [year, month, day] = eventDate.split('-');
            const [hours, minutes] = eventTime.split(':');
            const eventDateTime = new Date(year, month - 1, day, hours, minutes);

            const postData = {
                title: eventTitle,
                text: eventDescription,
                date: Timestamp.fromDate(eventDateTime),
                location: eventLocation,
                distance: parseFloat(distance),
                meetingPoint: meetingPoint,
                imageUrl: imageUrl,
                userId: auth.currentUser.uid,
                userName: currentUserData.name,
                userPhoto: currentUserData.photo,
                userLevel: currentUserData.level,
                isEvent: true,
                participants: [auth.currentUser.uid],
                createdAt: Timestamp.now(),
            };

            // Obținem lista de prieteni a utilizatorului curent
            const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
            const userData = userDoc.data();
            const userFriends = userData.friends || [];

            // Adăugăm lista de prieteni la datele postării
            const postWithFriends = {
                ...postData,
                userFriends: userFriends,
                date: Timestamp.now(),
                userId: auth.currentUser.uid,
                userName: currentUserData.name,
                userPhoto: currentUserData.photo,
                userLevel: currentUserData.level,
                likes: [],
                likesCount: 0,
                commentsCount: 0
            };

            const docRef = await addDoc(collection(db, 'posts'), postWithFriends);

            // Adăugăm creatorul în upcomingEvents cu statusul "accepted"
            await addDoc(collection(db, 'upcomingEvents'), {
                userId: auth.currentUser.uid,
                eventId: docRef.id,
                eventTitle: eventTitle,
                eventDate: Timestamp.fromDate(eventDateTime),
                eventLocation: eventLocation,
                distance: parseFloat(distance),
                meetingPoint: meetingPoint,
                imageUrl: imageUrl,
                status: 'accepted',
                joinedAt: Timestamp.now()
            });

            setModalVisible(false);
            Alert.alert('Succes', 'Postarea a fost creată cu succes!');
        } catch (error) {
            console.error('Error creating post:', error);
            Alert.alert('Eroare', 'Nu am putut crea postarea. Încearcă din nou.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.modalContainer}>
                <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
                    <ScrollView>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>Create New Event</Text>

                        <TouchableOpacity
                            style={[styles.imagePickerButton, { backgroundColor: colors.secondary }]}
                            onPress={handleImagePick}
                        >
                            {imageUri ? (
                                <Image
                                    source={{ uri: imageUri }}
                                    style={styles.selectedImage}
                                />
                            ) : (
                                <Text style={[styles.imagePickerText, { color: colors.secondaryText }]}>+ Add Image</Text>
                            )}
                        </TouchableOpacity>

                        <TextInput
                            style={[styles.input, {
                                backgroundColor: colors.background,
                                color: colors.text,
                                borderColor: colors.border
                            }]}
                            placeholder="Event Title"
                            placeholderTextColor={colors.secondaryText}
                            value={eventTitle}
                            onChangeText={setEventTitle}
                        />

                        <TextInput
                            style={[styles.input, styles.textArea, {
                                backgroundColor: colors.background,
                                color: colors.text,
                                borderColor: colors.border
                            }]}
                            placeholder="Event Description"
                            placeholderTextColor={colors.secondaryText}
                            value={eventDescription}
                            onChangeText={setEventDescription}
                            multiline
                            numberOfLines={4}
                        />

                        <TextInput
                            style={[styles.input, {
                                backgroundColor: colors.background,
                                color: colors.text,
                                borderColor: colors.border
                            }]}
                            placeholder="Date (YYYY-MM-DD)"
                            placeholderTextColor={colors.secondaryText}
                            value={eventDate}
                            onChangeText={setEventDate}
                        />

                        <TextInput
                            style={[styles.input, {
                                backgroundColor: colors.background,
                                color: colors.text,
                                borderColor: colors.border
                            }]}
                            placeholder="Time (HH:mm)"
                            placeholderTextColor={colors.secondaryText}
                            value={eventTime}
                            onChangeText={setEventTime}
                        />

                        <TextInput
                            style={[styles.input, {
                                backgroundColor: colors.background,
                                color: colors.text,
                                borderColor: colors.border
                            }]}
                            placeholder="Location"
                            placeholderTextColor={colors.secondaryText}
                            value={eventLocation}
                            onChangeText={setEventLocation}
                        />

                        <TextInput
                            style={[styles.input, {
                                backgroundColor: colors.background,
                                color: colors.text,
                                borderColor: colors.border
                            }]}
                            placeholder="Distance (km)"
                            placeholderTextColor={colors.secondaryText}
                            value={distance}
                            onChangeText={setDistance}
                            keyboardType="numeric"
                        />

                        <TextInput
                            style={[styles.input, {
                                backgroundColor: colors.background,
                                color: colors.text,
                                borderColor: colors.border
                            }]}
                            placeholder="Meeting Point"
                            placeholderTextColor={colors.secondaryText}
                            value={meetingPoint}
                            onChangeText={setMeetingPoint}
                        />

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={onClose}
                            >
                                <Text style={styles.buttonText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.submitButton, { backgroundColor: colors.primary }]}
                                onPress={handleSubmit}
                                disabled={isLoading}
                            >
                                <Text style={styles.buttonText}>
                                    {isLoading ? 'Creating...' : 'Post'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

function FilterModal({ visible, onClose, onApplyFilters, initialFilters }) {
    const { colors } = useTheme();
    const [filters, setFilters] = useState(initialFilters || {
        friendsOnly: false,
        dateRange: {
            start: new Date(),
            end: new Date(new Date().setMonth(new Date().getMonth() + 1))
        },
        minParticipants: 0,
        distance: 0,
        difficulty: 'any',
        useDateFilter: false
    });
    const [showStartDatePicker, setShowStartDatePicker] = useState(false);
    const [showEndDatePicker, setShowEndDatePicker] = useState(false);

    const handleStartDateChange = (event, selectedDate) => {
        const currentDate = selectedDate || filters.dateRange.start;
        setShowStartDatePicker(Platform.OS === 'ios');
        setFilters({
            ...filters,
            dateRange: {
                ...filters.dateRange,
                start: currentDate
            }
        });
    };

    const handleEndDateChange = (event, selectedDate) => {
        const currentDate = selectedDate || filters.dateRange.end;
        setShowEndDatePicker(Platform.OS === 'ios');
        setFilters({
            ...filters,
            dateRange: {
                ...filters.dateRange,
                end: currentDate
            }
        });
    };

    const handleApply = () => {
        onApplyFilters(filters);
        onClose();
    };

    const handleReset = () => {
        setFilters({
            friendsOnly: false,
            dateRange: {
                start: new Date(),
                end: new Date(new Date().setMonth(new Date().getMonth() + 1))
            },
            minParticipants: 0,
            distance: 0,
            difficulty: 'any',
            useDateFilter: false
        });
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.modalContainer}>
                <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
                    <View style={styles.modalHeader}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>Filtrează</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Ionicons name="close" size={24} color={colors.text} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.filterScroll}>
                        {/* Filtru prieteni */}
                        <View style={styles.filterSection}>
                            <Text style={[styles.filterSectionTitle, { color: colors.text }]}>Doar prieteni</Text>
                            <Switch
                                value={filters.friendsOnly}
                                onValueChange={(value) => setFilters({ ...filters, friendsOnly: value })}
                                trackColor={{ false: colors.secondary, true: colors.primary }}
                            />
                        </View>

                        {/* Filtru dată */}
                        <View style={styles.filterSection}>
                            <View style={styles.filterHeader}>
                                <Text style={[styles.filterSectionTitle, { color: colors.text }]}>Perioadă</Text>
                                <Switch
                                    value={filters.useDateFilter}
                                    onValueChange={(value) => setFilters({ ...filters, useDateFilter: value })}
                                    trackColor={{ false: colors.secondary, true: colors.primary }}
                                />
                            </View>
                            {filters.useDateFilter && (
                                <View style={styles.dateContainer}>
                                    <View style={styles.dateInputContainer}>
                                        <Text style={[styles.dateLabel, { color: colors.text }]}>De la:</Text>
                                        <TouchableOpacity
                                            style={[styles.dateButton, { backgroundColor: colors.secondary }]}
                                            onPress={() => setShowStartDatePicker(true)}
                                        >
                                            <Text style={[styles.dateButtonText, { color: colors.text }]}>
                                                {moment(filters.dateRange.start).format('DD/MM/YYYY')}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                    <View style={styles.dateInputContainer}>
                                        <Text style={[styles.dateLabel, { color: colors.text }]}>Până la:</Text>
                                        <TouchableOpacity
                                            style={[styles.dateButton, { backgroundColor: colors.secondary }]}
                                            onPress={() => setShowEndDatePicker(true)}
                                        >
                                            <Text style={[styles.dateButtonText, { color: colors.text }]}>
                                                {moment(filters.dateRange.end).format('DD/MM/YYYY')}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}
                        </View>

                        {/* Filtru distanță */}
                        <View style={styles.filterSection}>
                            <Text style={[styles.filterSectionTitle, { color: colors.text }]}>Distanță maximă (km)</Text>
                            <View style={styles.participantsContainer}>
                                <TouchableOpacity
                                    style={[styles.participantButton, { backgroundColor: colors.secondary }]}
                                    onPress={() => setFilters({ ...filters, distance: Math.max(0, filters.distance - 5) })}
                                >
                                    <Text style={[styles.participantButtonText, { color: colors.text }]}>-</Text>
                                </TouchableOpacity>
                                <Text style={[styles.participantCount, { color: colors.text }]}>{filters.distance}</Text>
                                <TouchableOpacity
                                    style={[styles.participantButton, { backgroundColor: colors.secondary }]}
                                    onPress={() => setFilters({ ...filters, distance: filters.distance + 5 })}
                                >
                                    <Text style={[styles.participantButtonText, { color: colors.text }]}>+</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Filtru participanți */}
                        <View style={styles.filterSection}>
                            <Text style={[styles.filterSectionTitle, { color: colors.text }]}>Participanți minimi</Text>
                            <View style={styles.participantsContainer}>
                                <TouchableOpacity
                                    style={[styles.participantButton, { backgroundColor: colors.secondary }]}
                                    onPress={() => setFilters({ ...filters, minParticipants: Math.max(0, filters.minParticipants - 1) })}
                                >
                                    <Text style={[styles.participantButtonText, { color: colors.text }]}>-</Text>
                                </TouchableOpacity>
                                <Text style={[styles.participantCount, { color: colors.text }]}>{filters.minParticipants}</Text>
                                <TouchableOpacity
                                    style={[styles.participantButton, { backgroundColor: colors.secondary }]}
                                    onPress={() => setFilters({ ...filters, minParticipants: filters.minParticipants + 1 })}
                                >
                                    <Text style={[styles.participantButtonText, { color: colors.text }]}>+</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Filtru dificultate */}
                        <View style={styles.filterSection}>
                            <Text style={[styles.filterSectionTitle, { color: colors.text }]}>Nivel de dificultate</Text>
                            <View style={styles.difficultyContainer}>
                                {['any', 'easy', 'medium', 'hard'].map((level) => (
                                    <TouchableOpacity
                                        key={level}
                                        style={[
                                            styles.difficultyButton,
                                            { backgroundColor: filters.difficulty === level ? colors.primary : colors.secondary }
                                        ]}
                                        onPress={() => setFilters({ ...filters, difficulty: level })}
                                    >
                                        <Text style={[styles.difficultyButtonText, { color: colors.text }]}>
                                            {level === 'any' ? 'Orice' :
                                                level === 'easy' ? 'Ușor' :
                                                    level === 'medium' ? 'Mediu' : 'Greu'}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    </ScrollView>

                    <View style={styles.filterButtons}>
                        <TouchableOpacity
                            style={[styles.filterButton, { backgroundColor: colors.secondary }]}
                            onPress={handleReset}
                        >
                            <Text style={[styles.filterButtonText, { color: colors.text }]}>Resetează</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.filterButton, { backgroundColor: colors.primary }]}
                            onPress={handleApply}
                        >
                            <Text style={[styles.filterButtonText, { color: '#fff' }]}>Aplică</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            {/* Date Pickers */}
            {(showStartDatePicker || showEndDatePicker) && (
                <View style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    justifyContent: 'center',
                    alignItems: 'center',
                }}>
                    <View style={{
                        width: '100%',
                        padding: 20,
                        backgroundColor: colors.background,
                        borderTopLeftRadius: 20,
                        borderTopRightRadius: 20,
                    }}>
                        <DateTimePicker
                            value={showStartDatePicker ? filters.dateRange.start : filters.dateRange.end}
                            mode="date"
                            display="spinner"
                            onChange={showStartDatePicker ? handleStartDateChange : handleEndDateChange}
                            minimumDate={showStartDatePicker ? new Date() : filters.dateRange.start}
                            maximumDate={showStartDatePicker ? filters.dateRange.end : undefined}
                            textColor={colors.text}
                            style={{ height: 200, width: '100%' }}
                        />
                        <TouchableOpacity
                            style={{
                                marginTop: 10,
                                padding: 15,
                                borderRadius: 10,
                                alignItems: 'center',
                                backgroundColor: colors.primary,
                            }}
                            onPress={() => {
                                setShowStartDatePicker(false);
                                setShowEndDatePicker(false);
                            }}
                        >
                            <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold' }}>OK</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}
        </Modal>
    );
}

export default function FeedScreen() {
    const { colors, isDarkMode } = useTheme();
    const [posts, setPosts] = useState([]);
    const [displayedPosts, setDisplayedPosts] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showAddPost, setShowAddPost] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [currentUserData, setCurrentUserData] = useState({
        photo: 'https://via.placeholder.com/50',
        name: 'John Doe',
        level: 'Hiking Enthusiast'
    });
    const [modalVisible, setModalVisible] = useState(false);
    const [filterModalVisible, setFilterModalVisible] = useState(false);
    const [activeFilters, setActiveFilters] = useState(null);
    const [friends, setFriends] = useState([]);
    const navigation = useNavigation();

    const onRefresh = React.useCallback(() => {
        setRefreshing(true);
        // Re-fetch posts
        fetchPosts().finally(() => setRefreshing(false));
    }, []);

    const fetchPosts = async () => { //#2
        const qPosts = query(collection(db, 'posts'), orderBy('date', 'desc'));
        const snapshot = await getDocs(qPosts);
        const fetched = [];
        snapshot.forEach(doc => {
            fetched.push({ id: doc.id, ...doc.data() });
        });
        setPosts(fetched);
        setDisplayedPosts(fetched);
    };

    const fetchFriends = async () => {
        try {
            const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
            if (userDoc.exists()) {
                setFriends(userDoc.data().friends || []);
            }
        } catch (error) {
            console.error('Error fetching friends:', error);
        }
    };

    const applyFilters = async (filters) => {
        setActiveFilters(filters);
        let filtered = [...posts];

        // Filtrare după prieteni
        if (filters.friendsOnly) {
            try {
                // Obținem lista de prieteni a utilizatorului curent
                const currentUserDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
                const currentUserData = currentUserDoc.data();
                const currentUserFriends = currentUserData.friends || [];

                // Filtram postările
                filtered = filtered.filter(post => {
                    // Verificăm dacă utilizatorul care a creat postarea este prieten
                    const isCreatorFriend = currentUserFriends.includes(post.userId);

                    // Verificăm dacă utilizatorul curent este prieten cu creatorul postării
                    const isCurrentUserFriend = post.userFriends?.includes(auth.currentUser.uid);

                    return isCreatorFriend || isCurrentUserFriend;
                });
            } catch (error) {
                console.error('Error filtering friends:', error);
                Alert.alert('Eroare', 'Nu am putut aplica filtrul de prieteni. Încearcă din nou.');
            }
        }

        // Filtrare după număr de participanți
        if (filters.minParticipants > 0) {
            filtered = filtered.filter(post =>
                (post.participantsCount || 0) >= filters.minParticipants
            );
        }

        setDisplayedPosts(filtered);
    };

    const removeFilter = (filterType) => {
        const newFilters = { ...activeFilters };
        switch (filterType) {
            case 'friendsOnly':
                newFilters.friendsOnly = false;
                break;
            case 'minParticipants':
                newFilters.minParticipants = 0;
                break;
            case 'distance':
                newFilters.distance = 0;
                break;
            case 'difficulty':
                newFilters.difficulty = 'any';
                break;
            case 'dateRange':
                newFilters.useDateFilter = false;
                break;
        }
        setActiveFilters(newFilters);
        applyFilters(newFilters);
    };

    const renderFilterChips = () => {
        if (!activeFilters) return null;

        const chips = [];

        if (activeFilters.friendsOnly) {
            chips.push(
                <View key="friends" style={[styles.filterChip, { backgroundColor: colors.secondary }]}>
                    <Text style={[styles.filterChipText, { color: colors.text }]}>Doar prieteni</Text>
                    <TouchableOpacity onPress={() => removeFilter('friendsOnly')}>
                        <Ionicons name="close-circle" size={20} color={colors.text} />
                    </TouchableOpacity>
                </View>
            );
        }

        if (activeFilters.minParticipants > 0) {
            chips.push(
                <View key="participants" style={[styles.filterChip, { backgroundColor: colors.secondary }]}>
                    <Text style={[styles.filterChipText, { color: colors.text }]}>Min {activeFilters.minParticipants} participanți</Text>
                    <TouchableOpacity onPress={() => removeFilter('minParticipants')}>
                        <Ionicons name="close-circle" size={20} color={colors.text} />
                    </TouchableOpacity>
                </View>
            );
        }

        if (activeFilters.distance > 0) {
            chips.push(
                <View key="distance" style={[styles.filterChip, { backgroundColor: colors.secondary }]}>
                    <Text style={[styles.filterChipText, { color: colors.text }]}>Distanță max. {activeFilters.distance} km</Text>
                    <TouchableOpacity onPress={() => removeFilter('distance')}>
                        <Ionicons name="close-circle" size={20} color={colors.text} />
                    </TouchableOpacity>
                </View>
            );
        }

        if (activeFilters.difficulty && activeFilters.difficulty !== 'any') {
            let diffLabel = 'Dificultate: ';
            if (activeFilters.difficulty === 'easy') diffLabel += 'Ușor';
            else if (activeFilters.difficulty === 'medium') diffLabel += 'Mediu';
            else if (activeFilters.difficulty === 'hard') diffLabel += 'Greu';
            chips.push(
                <View key="difficulty" style={[styles.filterChip, { backgroundColor: colors.secondary }]}>
                    <Text style={[styles.filterChipText, { color: colors.text }]}>{diffLabel}</Text>
                    <TouchableOpacity onPress={() => removeFilter('difficulty')}>
                        <Ionicons name="close-circle" size={20} color={colors.text} />
                    </TouchableOpacity>
                </View>
            );
        }

        if (activeFilters.useDateFilter && activeFilters.dateRange) {
            chips.push(
                <View key="dateRange" style={[styles.filterChip, { backgroundColor: colors.secondary }]}>
                    <Text style={[styles.filterChipText, { color: colors.text }]}>Perioadă: {moment(activeFilters.dateRange.start).format('DD/MM/YYYY')} - {moment(activeFilters.dateRange.end).format('DD/MM/YYYY')}</Text>
                    <TouchableOpacity onPress={() => removeFilter('dateRange')}>
                        <Ionicons name="close-circle" size={20} color={colors.text} />
                    </TouchableOpacity>
                </View>
            );
        }

        return chips.length > 0 ? (
            <View style={styles.filterChipsContainer}>
                {chips}
            </View>
        ) : null;
    };

    // Preluăm datele utilizatorului curent
    useEffect(() => {
        if (auth.currentUser) {
            const userDocRef = doc(db, 'users', auth.currentUser.uid);
            const unsubscribeUser = onSnapshot(userDocRef, (docSnapshot) => {
                if (docSnapshot.exists()) {
                    const userData = docSnapshot.data();
                    setCurrentUserData({
                        photo: userData.profilePhotoUrl || 'https://via.placeholder.com/50',
                        name: userData.displayName || 'John Doe',
                        level: userData.level || 'Hiking Enthusiast'
                    });
                }
            });

            return () => unsubscribeUser();
        }
    }, []);

    // Citește colecția 'posts'
    useEffect(() => {
        const qPosts = query(collection(db, 'posts'), orderBy('date', 'desc'));
        const unsub = onSnapshot(qPosts, (snapshot) => {
            const fetched = [];
            snapshot.forEach(doc => {
                fetched.push({ id: doc.id, ...doc.data() });
            });
            setPosts(fetched);
            setDisplayedPosts(fetched);
        }, (error) => {
            console.error('Error loading posts:', error);
            Alert.alert('Error', error.message);
        });
        return () => unsub();
    }, []);

    // Filtrare locală
    const filteredPosts = posts.filter((p) => {
        const combined = (p.text || '') + ' ' + ((p.tags || []).join(' ') || '');
        return combined.toLowerCase().includes(searchTerm.toLowerCase());
    });

    // Mânuire buton Join (ex.) #3
    const handleJoinEvent = async (post) => {
        if (!auth.currentUser) {
            Alert.alert('Eroare', 'Trebuie să fii autentificat pentru a participa la un eveniment.');
            return;
        }

        try {
            // Obținem datele utilizatorului curent
            const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
            if (!userDoc.exists()) {
                Alert.alert('Eroare', 'Nu am putut găsi datele utilizatorului.');
                return;
            }
            const userData = userDoc.data();

            // Adăugăm evenimentul în upcomingEvents cu status pending
            await addDoc(collection(db, 'upcomingEvents'), {
                userId: auth.currentUser.uid,
                eventId: post.id,
                eventTitle: post.title,
                eventDate: post.date,
                eventLocation: post.location,
                distance: post.distance || 0,
                meetingPoint: post.meetingPoint,
                imageUrl: post.imageUrl,
                status: 'pending',
                postId: post.id,
                createdAt: serverTimestamp()
            });

            // Creăm notificare pentru organizatorul evenimentului
            await addDoc(collection(db, 'notifications'), {
                type: 'event_join_request',
                eventId: post.id,
                eventTitle: post.title,
                senderId: auth.currentUser.uid,
                senderName: userData.displayName,
                senderRating: userData.rating || 0,
                receiverId: post.userId,
                status: 'pending',
                createdAt: serverTimestamp(),
                read: false
            });

            Alert.alert(
                'Cerere trimisă',
                'Cererea ta de participare a fost trimisă organizatorului evenimentului.',
                [{ text: 'OK' }]
            );
        } catch (error) {
            console.error('Error joining event:', error);
            Alert.alert('Eroare', 'Nu am putut procesa cererea de participare. Te rugăm să încerci din nou.');
        }
    };

    // Adăugăm un "onScroll" la listă, ca să detectăm poziția
    const handleScroll = (event) => {
        const offsetY = event.nativeEvent.contentOffset.y;
        // Dacă userul e în primele 10px de scroll => showAddPost = true
        if (offsetY < 10) {
            setShowAddPost(true);
        } else {
            setShowAddPost(false);
        }
    };

    // Funție custom de "Add New Post"
    const handleAddNewPost = () => {
        Alert.alert('Add Post', 'Here you can implement an Add New Post screen...');
    };

    // Randăm fiecare post sub formă de card
    const renderPostItem = ({ item }) => (
        <PostCard post={item} onJoinEvent={handleJoinEvent} />
    );

    const handleChatPress = () => {
        navigation.navigate('ChatsScreen');
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Bara verde */}
            <View style={[styles.header, { backgroundColor: colors.primary }]}>
                <View style={[styles.headerGradient, { backgroundColor: colors.primary }]} />
                <View style={styles.headerContent}>
                    {/* User photo (stânga) */}
                    <View style={styles.userPhotoContainer}>
                        <Image
                            source={{ uri: currentUserData.photo }}
                            style={styles.userPhoto}
                        />
                    </View>

                    {/* Search (mijloc) */}
                    <View style={styles.searchContainer}>
                        <TextInput
                            style={[styles.searchInput, {
                                backgroundColor: isDarkMode ? '#2d2d2d' : '#fff',
                                color: colors.text
                            }]}
                            placeholder="Search..."
                            placeholderTextColor={colors.secondaryText}
                            value={searchTerm}
                            onChangeText={setSearchTerm}
                        />
                    </View>

                    {/* Filter button (dreapta) */}
                    <TouchableOpacity
                        style={[styles.filterButton]}
                        onPress={() => setFilterModalVisible(true)}
                    >
                        <Ionicons
                            name="options-outline"
                            size={30}
                            color={activeFilters ? colors.secondary : '#fff'}
                        />
                    </TouchableOpacity>

                    {/* Chat button (dreapta) */}
                    <TouchableOpacity
                        style={[styles.chatButton]}
                        onPress={handleChatPress}
                    >
                        <Ionicons name="chatbubble-ellipses" size={30} color={isDarkMode ? '#2d2d2d' : '#fff'} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Filter Chips */}
            {renderFilterChips()}

            {/* Posts */}
            {displayedPosts.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Text style={[styles.emptyText, { color: colors.secondaryText }]}>No posts available.</Text>
                </View>
            ) : (
                <FlatList
                    data={displayedPosts}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={{ paddingBottom: 120 }}
                    renderItem={renderPostItem}
                    onScroll={handleScroll}
                    scrollEventThrottle={16}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            colors={[colors.primary]}
                            tintColor={colors.primary}
                        />
                    }
                />
            )}

            {/* Butonul de Add New Post */}
            {showAddPost && (
                <TouchableOpacity
                    style={[styles.addNewPostButton, { backgroundColor: colors.primary }]}
                    onPress={() => setModalVisible(true)}
                >
                    <Text style={styles.addNewPostText}>+ New Post</Text>
                </TouchableOpacity>
            )}

            {/* Modals */}
            <CreateEventModal
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
                currentUserData={currentUserData}
            />

            <FilterModal
                visible={filterModalVisible}
                onClose={() => setFilterModalVisible(false)}
                onApplyFilters={applyFilters}
                initialFilters={activeFilters}
            />
        </View>
    );
}

/* Un card pentru fiecare postare */
function PostCard({ post, onJoinEvent }) {
    const { colors } = useTheme();
    const [isLiked, setIsLiked] = useState(false);
    const [showComments, setShowComments] = useState(false);
    const [comment, setComment] = useState('');
    const [comments, setComments] = useState([]);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editedTitle, setEditedTitle] = useState(post.title || '');
    const [editedText, setEditedText] = useState(post.text || '');
    const [editedLocation, setEditedLocation] = useState(post.location || '');
    const [editedDistance, setEditedDistance] = useState(post.distance?.toString() || '');
    const [editedMeetingPoint, setEditedMeetingPoint] = useState(post.meetingPoint || '');
    const [editedImageUri, setEditedImageUri] = useState(null);
    const [isJoining, setIsJoining] = useState(false);
    const [joinStatus, setJoinStatus] = useState(null);
    const navigation = useNavigation();

    const isOwnPost = auth.currentUser?.uid === post.userId;

    useEffect(() => {
        if (!auth.currentUser) return;

        // Verificăm dacă utilizatorul a trimis deja o cerere pentru acest eveniment
        const checkJoinStatus = async () => {
            const upcomingQuery = query(
                collection(db, 'upcomingEvents'),
                where('eventId', '==', post.id),
                where('userId', '==', auth.currentUser.uid)
            );

            const snapshot = await getDocs(upcomingQuery);
            if (!snapshot.empty) {
                const eventData = snapshot.docs[0].data();
                setJoinStatus(eventData.status);
            }
        };

        checkJoinStatus();
    }, [post.id]);

    useEffect(() => {
        if (showComments) {
            const commentsQuery = query(
                collection(db, `posts/${post.id}/comments`),
                orderBy('createdAt', 'desc')
            );

            const unsubscribe = onSnapshot(commentsQuery, (snapshot) => {
                const commentsList = [];
                snapshot.forEach((doc) => {
                    commentsList.push({ id: doc.id, ...doc.data() });
                });
                setComments(commentsList);
            }, (error) => {
                console.error('Error loading comments:', error);
            });

            return () => unsubscribe();
        }
    }, [showComments, post.id]);

    const handleLike = async () => { //#4
        if (!auth.currentUser) {
            Alert.alert('Error', 'Trebuie să fii autentificat pentru a da like.');
            return;
        }

        const postRef = doc(db, 'posts', post.id);
        try {
            if (isLiked) {
                await updateDoc(postRef, {
                    likes: arrayRemove(auth.currentUser.uid),
                    likesCount: (post.likesCount || 1) - 1
                });
            } else {
                await updateDoc(postRef, {
                    likes: arrayUnion(auth.currentUser.uid),
                    likesCount: (post.likesCount || 0) + 1
                });
            }
            setIsLiked(!isLiked);
        } catch (error) {
            console.error('Error updating like:', error);
            Alert.alert('Error', 'Nu am putut actualiza like-ul. Încearcă din nou.');
        }
    };

    const handleImagePick = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission needed', 'We need gallery permissions to add an image.');
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [16, 9],
            quality: 1,
        });

        if (!result.canceled && result.assets) {
            setEditedImageUri(result.assets[0].uri);
        }
    };

    const handleEdit = async () => {
        if (!editedText.trim()) {
            Alert.alert('Eroare', 'Descrierea nu poate fi goală.');
            return;
        }

        if (post.isEvent && !editedTitle.trim()) {
            Alert.alert('Eroare', 'Titlul evenimentului nu poate fi gol.');
            return;
        }

        setIsJoining(true);
        try {
            let updateData = {
                title: editedTitle,
                text: editedText,
                location: editedLocation,
                distance: parseFloat(editedDistance) || 0,
                meetingPoint: editedMeetingPoint,
                lastEdited: Timestamp.now()
            };

            if (editedImageUri) {
                const imageUrl = await uploadToCloudinary(editedImageUri);
                updateData.imageUrl = imageUrl;
            }

            // Actualizăm postarea
            await updateDoc(doc(db, 'posts', post.id), updateData);

            // Dacă este un eveniment, actualizăm și în upcomingEvents
            if (post.isEvent) {
                const upcomingEventsQuery = query(
                    collection(db, 'upcomingEvents'),
                    where('eventId', '==', post.id)
                );
                const snapshot = await getDocs(upcomingEventsQuery);

                const updatePromises = snapshot.docs.map(doc =>
                    updateDoc(doc.ref, {
                        eventTitle: editedTitle,
                        eventLocation: editedLocation,
                        distance: parseFloat(editedDistance) || 0,
                        meetingPoint: editedMeetingPoint,
                        imageUrl: updateData.imageUrl || post.imageUrl
                    })
                );

                await Promise.all(updatePromises);
            }

            setShowEditModal(false);
            Alert.alert('Succes', 'Postarea a fost actualizată cu succes!');
        } catch (error) {
            console.error('Error updating post:', error);
            Alert.alert('Eroare', 'Nu am putut actualiza postarea. Încearcă din nou.');
        } finally {
            setIsJoining(false);
        }
    };

    const handleAddComment = async () => { //#5
        if (!comment.trim() || !auth.currentUser) return;

        try {
            const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
            const userData = userDoc.data();

            await addDoc(collection(db, `posts/${post.id}/comments`), {
                text: comment.trim(),
                userId: auth.currentUser.uid,
                userName: userData?.displayName || 'User',
                userPhoto: userData?.profilePhotoUrl || 'https://via.placeholder.com/40',
                createdAt: Timestamp.now()
            });

            await updateDoc(doc(db, 'posts', post.id), {
                commentsCount: (post.commentsCount || 0) + 1
            });

            setComment('');
        } catch (error) {
            console.error('Error adding comment:', error);
            Alert.alert('Error', 'Nu am putut adăuga comentariul. Încearcă din nou.');
        }
    };

    const handleJoinToggle = async () => {
        if (!auth.currentUser) {
            Alert.alert('Eroare', 'Trebuie să fii autentificat pentru a participa la evenimente.');
            return;
        }

        if (post.userId === auth.currentUser.uid) {
            Alert.alert('Informație', 'Nu poți participa la propriul eveniment.');
            return;
        }

        try {
            setIsJoining(true);

            if (joinStatus === 'accepted') {
                // Adăugăm confirmare pentru Leave
                Alert.alert(
                    'Confirmare',
                    'Sigur dorești să părăsești acest eveniment?',
                    [
                        {
                            text: 'Anulează',
                            style: 'cancel',
                            onPress: () => {
                                setIsJoining(false);
                            }
                        },
                        {
                            text: 'Da, părăsește',
                            style: 'destructive',
                            onPress: async () => {
                                try {
                                    // Dacă suntem deja participanți, ieșim din eveniment
                                    const upcomingQuery = query(
                                        collection(db, 'upcomingEvents'),
                                        where('eventId', '==', post.id),
                                        where('userId', '==', auth.currentUser.uid)
                                    );
                                    const snapshot = await getDocs(upcomingQuery);
                                    if (!snapshot.empty) {
                                        await deleteDoc(snapshot.docs[0].ref);
                                    }

                                    // Eliminăm din chat
                                    const chatQuery = query(
                                        collection(db, 'groupChats'),
                                        where('eventId', '==', post.id)
                                    );
                                    const chatSnapshot = await getDocs(chatQuery);
                                    if (!chatSnapshot.empty) {
                                        const chatDoc = chatSnapshot.docs[0];
                                        await updateDoc(chatDoc.ref, {
                                            participants: arrayRemove(auth.currentUser.uid)
                                        });
                                    }

                                    // Eliminăm din lista de participanți
                                    const postRef = doc(db, 'posts', post.id);
                                    await updateDoc(postRef, {
                                        participants: arrayRemove(auth.currentUser.uid)
                                    });

                                    setJoinStatus(null);
                                } catch (error) {
                                    console.error('Error leaving event:', error);
                                    Alert.alert('Eroare', 'Nu am putut părăsi evenimentul. Te rugăm să încerci din nou.');
                                }
                            }
                        }
                    ]
                );
                return;
            } else if (joinStatus === 'pending') {
                // Dacă cererea este în așteptare, o anulăm
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
                            onPress: async () => {
                                try {
                                    const upcomingQuery = query(
                                        collection(db, 'upcomingEvents'),
                                        where('eventId', '==', post.id),
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
                                            where('eventId', '==', post.id),
                                            where('senderId', '==', auth.currentUser.uid),
                                            where('type', '==', 'event_join_request')
                                        );
                                        const notificationSnapshot = await getDocs(notificationQuery);

                                        if (!notificationSnapshot.empty) {
                                            await deleteDoc(notificationSnapshot.docs[0].ref);
                                        }

                                        // Actualizăm și în colecția posts
                                        const postRef = doc(db, 'posts', post.id);
                                        const postDoc = await getDoc(postRef);

                                        if (postDoc.exists()) {
                                            await updateDoc(postRef, {
                                                participants: arrayRemove(auth.currentUser.uid)
                                            });
                                        }

                                        setJoinStatus(null);
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
                            },
                            style: 'destructive'
                        }
                    ]
                );
            } else {
                // Trimitem cerere de participare
                const upcomingEventRef = await addDoc(collection(db, 'upcomingEvents'), {
                    eventId: post.id,
                    userId: auth.currentUser.uid,
                    eventTitle: post.title,
                    eventDate: post.date,
                    imageUrl: post.imageUrl,
                    status: 'pending',
                    createdAt: serverTimestamp()
                });

                // Creăm notificare pentru creatorul evenimentului
                await addDoc(collection(db, 'notifications'), {
                    type: 'event_join_request',
                    senderId: auth.currentUser.uid,
                    senderName: auth.currentUser.displayName,
                    senderPhoto: auth.currentUser.photoURL,
                    senderRating: 4.5,
                    eventId: post.id,
                    eventTitle: post.title,
                    receiverId: post.userId,
                    createdAt: serverTimestamp(),
                    read: false
                });

                setJoinStatus('pending');
            }
        } catch (error) {
            console.error('Error handling join request:', error);
            Alert.alert('Eroare', 'Nu am putut procesa cererea. Te rugăm să încerci din nou.');
        } finally {
            setIsJoining(false);
        }
    };

    const getJoinButtonStyle = () => {
        if (post.userId === auth.currentUser?.uid) {
            return { display: 'none' }; // Ascundem butonul pentru creatorul evenimentului
        }

        switch (joinStatus) {
            case 'accepted':
                return {
                    backgroundColor: '#F44336', // Roșu pentru Leave
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 15,
                    paddingVertical: 8,
                    borderRadius: 20,
                    marginLeft: 10
                };
            case 'pending':
                return {
                    backgroundColor: '#FFC107',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 15,
                    paddingVertical: 8,
                    borderRadius: 20,
                    marginLeft: 10
                };
            case 'rejected':
                return {
                    backgroundColor: '#F44336',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 15,
                    paddingVertical: 8,
                    borderRadius: 20,
                    marginLeft: 10
                };
            default:
                return {
                    backgroundColor: '#4CAF50',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 15,
                    paddingVertical: 8,
                    borderRadius: 20,
                    marginLeft: 10
                };
        }
    };

    const getJoinButtonText = () => {
        if (post.userId === auth.currentUser?.uid) {
            return '';
        }

        switch (joinStatus) {
            case 'accepted':
                return 'Leave';
            case 'pending':
                return 'Pending';
            case 'rejected':
                return 'Rejected';
            default:
                return 'Join Event';
        }
    };

    // Adăugăm o funcție pentru a afișa statusul participării
    const renderParticipationStatus = () => {
        if (joinStatus === 'accepted') {
            return (
                <Text style={{ color: '#4CAF50', fontSize: 12, marginLeft: 10 }}>
                    Participation confirmed
                </Text>
            );
        }
        return null;
    };

    let timeAgo = 'now';
    if (post.date) {
        timeAgo = moment(post.date.toDate()).fromNow();
    }
    const userPhoto = post.userPhoto || 'https://via.placeholder.com/40';
    const userName = post.userName || 'Person name';
    const userLevel = post.userLevel || 'Hiking Enthusiast';
    const title = post.title || '';
    const text = post.text || '';
    const location = post.location || '';
    const imageUrl = post.imageUrl;
    const likes = post.likesCount || 0;
    const commentsCount = post.commentsCount || 0;
    const isEvent = post.isEvent || false;
    const participantsCount = post.participantsCount || (post.participants ? post.participants.length : 0);

    const handleUserPress = (userId) => {
        // Verificăm dacă este profilul propriu
        if (userId === auth.currentUser?.uid) {
            navigation.navigate('MainTabs', { screen: 'Profile' }); // Mergem la tab-ul de profil
        } else {
            navigation.navigate('Profile', { userId }); // Mergem la profilul altui utilizator
        }
    };

    return (
        <View style={[styles.postCard, { backgroundColor: colors.background }]}>
            {/* Header with Edit button */}
            <View style={styles.postHeader}>
                <TouchableOpacity
                    style={styles.userInfoContainer}
                    onPress={() => handleUserPress(post.userId)}
                >
                    <Image
                        source={{ uri: userPhoto }}
                        style={styles.postAvatar}
                    />
                    <View style={styles.userInfo}>
                        <Text style={[styles.personName, { color: colors.text }]}>{userName} <Text style={[styles.dot, { color: colors.secondaryText }]}>•</Text> {timeAgo}</Text>
                        <Text style={[styles.personLevel, { color: colors.secondaryText }]}>{userLevel}</Text>
                    </View>
                </TouchableOpacity>
                {isOwnPost && (
                    <TouchableOpacity
                        onPress={() => setShowEditModal(true)}
                        style={styles.editButton}
                    >
                        <Text style={[styles.editButtonText, { color: colors.primary, fontSize: 13, fontWeight: '600' }]}>Edit</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Title pentru evenimente */}
            {isEvent && title && (
                <Text style={[styles.eventTitle, { color: colors.text }]}>{title}</Text>
            )}

            {/* Text */}
            {text && (
                <Text style={[
                    styles.postText,
                    { color: colors.text },
                    (!location && !imageUrl) && { marginBottom: 8 }
                ]}>{text}</Text>
            )}

            {/* Location pentru evenimente */}
            {isEvent && location && (
                <View>
                    <Text style={[
                        styles.eventLocation,
                        { color: colors.secondaryText },
                        !imageUrl && { marginBottom: 4 }
                    ]}>📍 {location}</Text>
                    {post.date && (
                        <Text style={[
                            styles.eventDate,
                            { color: colors.secondaryText },
                            !imageUrl && { marginBottom: 8 }
                        ]}>📅 {moment(post.date.toDate()).format('DD MMMM YYYY')}</Text>
                    )}
                </View>
            )}

            {/* Imagine */}
            {imageUrl && (
                <Image
                    source={{ uri: imageUrl }}
                    style={[
                        styles.postImage,
                        { height: 200 }
                    ]}
                    resizeMode="cover"
                />
            )}

            {/* Footer (like, comment, join) */}
            <View style={styles.postFooter}>
                <View style={styles.footerActions}>
                    <TouchableOpacity onPress={handleLike} style={styles.actionButton}>
                        <Text style={[styles.footerText, { color: colors.secondaryText }]}>
                            {formatNumber(likes)} {isLiked ? '❤️' : '🤍'}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setShowComments(!showComments)}
                        style={[styles.actionButton, { marginLeft: 15 }]}
                    >
                        <Text style={[styles.footerText, { color: colors.secondaryText }]}>{formatNumber(commentsCount)} 💬</Text>
                    </TouchableOpacity>

                    {isEvent && (
                        <Text style={[styles.footerText, { color: colors.secondaryText, marginLeft: 15 }]}>
                            {formatNumber(participantsCount)} 👥
                        </Text>
                    )}
                </View>
                {isEvent && !isOwnPost && (
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        {renderParticipationStatus()}
                        <TouchableOpacity
                            style={getJoinButtonStyle()}
                            onPress={handleJoinToggle}
                            disabled={isJoining}
                        >
                            <Text style={styles.joinButtonText}>{getJoinButtonText()}</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* Comentarii */}
            {showComments && (
                <View style={styles.commentsSection}>
                    {/* Secțiunea de adăugare comentariu */}
                    <View style={[styles.addCommentContainer, { backgroundColor: colors.secondary }]}>
                        <TextInput
                            style={[styles.commentInput, { color: colors.text }]}
                            placeholder="Add a comment..."
                            placeholderTextColor={colors.secondaryText}
                            value={comment}
                            onChangeText={setComment}
                        />
                        <TouchableOpacity
                            style={[styles.postCommentButton, { backgroundColor: colors.primary }]}
                            onPress={handleAddComment}
                        >
                            <Text style={styles.postCommentText}>Post</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Lista de comentarii */}
                    {comments.map((comment, index) => (
                        <View key={index} style={[styles.commentItem, { backgroundColor: colors.secondary }]}>
                            <View style={styles.commentHeader}>
                                <Image
                                    source={{ uri: comment.userPhoto || 'https://via.placeholder.com/30' }}
                                    style={styles.commentUserPhoto}
                                />
                                <View style={styles.commentContent}>
                                    <Text style={[styles.commentUserName, { color: colors.text }]}>{comment.userName}</Text>
                                    <Text style={[styles.commentText, { color: colors.secondaryText }]}>{comment.text}</Text>
                                    <Text style={[styles.commentTime, { color: colors.secondaryText }]}>
                                        {moment(comment.createdAt.toDate()).fromNow()}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    ))}
                </View>
            )}

            {/* Edit Modal */}
            <Modal
                visible={showEditModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowEditModal(false)}
            >
                <View style={styles.modalContainer}>
                    <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
                        <ScrollView>
                            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                                <Text style={[styles.modalTitle, { color: colors.text }]}>Editare Postare</Text>
                                <TouchableOpacity
                                    style={styles.closeButton}
                                    onPress={() => setShowEditModal(false)}
                                >
                                    <Text style={[styles.closeButtonText, { color: colors.text }]}>✕</Text>
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity
                                style={[styles.imagePickerButton, { backgroundColor: colors.secondary }]}
                                onPress={handleImagePick}
                            >
                                {editedImageUri ? (
                                    <Image
                                        source={{ uri: editedImageUri }}
                                        style={styles.selectedImage}
                                    />
                                ) : post.imageUrl ? (
                                    <Image
                                        source={{ uri: post.imageUrl }}
                                        style={styles.selectedImage}
                                    />
                                ) : (
                                    <View style={[styles.imagePlaceholder, { backgroundColor: colors.secondary }]}>
                                        <Text style={[styles.imagePickerText, { color: colors.secondaryText }]}>+ Schimbă imaginea</Text>
                                    </View>
                                )}
                            </TouchableOpacity>

                            {post.isEvent && (
                                <TextInput
                                    style={[styles.input, {
                                        backgroundColor: colors.background,
                                        color: colors.text,
                                        borderColor: colors.border
                                    }]}
                                    placeholder="Titlul evenimentului"
                                    placeholderTextColor={colors.secondaryText}
                                    value={editedTitle}
                                    onChangeText={setEditedTitle}
                                />
                            )}

                            <TextInput
                                style={[styles.input, styles.textArea, {
                                    backgroundColor: colors.background,
                                    color: colors.text,
                                    borderColor: colors.border
                                }]}
                                placeholder="Descriere"
                                placeholderTextColor={colors.secondaryText}
                                value={editedText}
                                onChangeText={setEditedText}
                                multiline
                                numberOfLines={4}
                            />

                            {post.isEvent && (
                                <>
                                    <TextInput
                                        style={[styles.input, {
                                            backgroundColor: colors.background,
                                            color: colors.text,
                                            borderColor: colors.border
                                        }]}
                                        placeholder="Locație"
                                        placeholderTextColor={colors.secondaryText}
                                        value={editedLocation}
                                        onChangeText={setEditedLocation}
                                    />

                                    <TextInput
                                        style={[styles.input, {
                                            backgroundColor: colors.background,
                                            color: colors.text,
                                            borderColor: colors.border
                                        }]}
                                        placeholder="Distanță (km)"
                                        placeholderTextColor={colors.secondaryText}
                                        value={editedDistance}
                                        onChangeText={setEditedDistance}
                                        keyboardType="numeric"
                                    />

                                    <TextInput
                                        style={[styles.input, {
                                            backgroundColor: colors.background,
                                            color: colors.text,
                                            borderColor: colors.border
                                        }]}
                                        placeholder="Punct de întâlnire"
                                        placeholderTextColor={colors.secondaryText}
                                        value={editedMeetingPoint}
                                        onChangeText={setEditedMeetingPoint}
                                    />
                                </>
                            )}

                            <View style={styles.modalButtons}>
                                <TouchableOpacity
                                    style={[styles.modalButton, styles.cancelButton]}
                                    onPress={() => setShowEditModal(false)}
                                    disabled={isJoining}
                                >
                                    <Text style={styles.buttonText}>Anulează</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.modalButton, styles.submitButton, { backgroundColor: colors.primary }]}
                                    onPress={handleEdit}
                                    disabled={isJoining}
                                >
                                    <Text style={styles.buttonText}>
                                        {isJoining ? 'Salvare...' : 'Salvează'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

function formatNumber(num) {
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
}
const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },
    header: {
        height: 150,
        backgroundColor: '#556B2F',
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
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        paddingHorizontal: 20,
        marginTop: 40,
    },
    userPhotoContainer: {
        marginLeft: 10,
    },
    userPhoto: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#ccc',
    },
    searchContainer: {
        flex: 6,
        marginLeft: 15,
        marginRight: 0,
    },
    searchInput: {
        backgroundColor: '#FFF',
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 6,
        height: 36,
    },
    filterButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 15,
    },
    chatButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 15,
    },
    emptyContainer: {
        marginTop: 40,
        alignItems: 'center',
    },
    emptyText: {
        color: '#888',
        fontSize: 16,
    },
    postCard: {
        marginHorizontal: 16,
        marginTop: 16,
        padding: 12,
        backgroundColor: '#fff',
        borderRadius: 8,
    },
    postHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    postAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#f0f0f0',
    },
    personName: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 4,
    },
    personLevel: {
        fontSize: 13,
        color: '#888',
    },
    eventTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 8,
        marginTop: 10,
    },
    postText: {
        fontSize: 14,
        color: '#333',
        marginBottom: 4,
        lineHeight: 20,
    },
    eventLocation: {
        fontSize: 14,
        color: '#666',
        marginBottom: 8,
    },
    postImage: {
        width: '100%',
        height: 200,
        borderRadius: 10,
        marginBottom: 8,
    },
    postFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
    },
    footerActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 5,
    },
    footerText: {
        color: '#666',
        fontSize: 14,
    },
    joinButton: {
        backgroundColor: '#556B2F',
        borderRadius: 20,
        paddingHorizontal: 15,
        paddingVertical: 8,
    },
    joinButtonText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 14,
    },
    addNewPostButton: {
        position: 'absolute',
        bottom: 120,
        alignSelf: 'center',
        backgroundColor: '#556B2F',
        borderRadius: 20,
        paddingHorizontal: 15,
        paddingVertical: 8,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
        zIndex: 1000,
    },
    addNewPostText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 14,
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
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 20,
        textAlign: 'center',
    },
    imagePickerButton: {
        height: 200,
        backgroundColor: '#f0f0f0',
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    selectedImage: {
        width: '100%',
        height: '100%',
        borderRadius: 10,
    },
    imagePickerText: {
        color: '#666',
        fontSize: 16,
        fontWeight: '500',
    },
    input: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 10,
        padding: 12,
        marginBottom: 15,
        fontSize: 16,
        backgroundColor: '#fff',
        color: '#333',
    },
    textArea: {
        height: 100,
        textAlignVertical: 'top',
        backgroundColor: '#fff',
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 20,
    },
    modalButton: {
        flex: 1,
        padding: 15,
        borderRadius: 10,
        marginHorizontal: 5,
    },
    cancelButton: {
        backgroundColor: '#ff4444',
    },
    submitButton: {
        backgroundColor: '#556B2F',
    },
    buttonText: {
        color: 'white',
        textAlign: 'center',
        fontWeight: 'bold',
        fontSize: 16,
    },
    dot: {
        color: '#666',
    },
    commentsSection: {
        marginTop: 10,
        paddingHorizontal: 15,
    },
    commentItem: {
        backgroundColor: '#f5f5f5',
        padding: 10,
        borderRadius: 8,
        marginBottom: 8,
    },
    commentHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    commentUserPhoto: {
        width: 30,
        height: 30,
        borderRadius: 15,
        marginRight: 10,
    },
    commentContent: {
        flex: 1,
    },
    commentUserName: {
        fontWeight: 'bold',
        fontSize: 14,
        marginBottom: 4,
        color: '#333',
    },
    commentText: {
        fontSize: 14,
        color: '#444',
        marginBottom: 4,
    },
    commentTime: {
        fontSize: 12,
        color: '#888',
    },
    addCommentContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
        backgroundColor: '#f0f0f0',
        borderRadius: 20,
        padding: 5,
    },
    commentInput: {
        flex: 1,
        padding: 8,
        fontSize: 14,
    },
    postCommentButton: {
        backgroundColor: '#556B2F',
        paddingHorizontal: 15,
        paddingVertical: 8,
        borderRadius: 15,
        marginLeft: 10,
    },
    postCommentText: {
        color: 'white',
        fontWeight: 'bold',
    },
    editButton: {
        padding: 8,
        marginLeft: 10,
    },
    editButtonText: {
        color: '#556B2F',
        fontSize: 18,
        fontWeight: 'bold',
    },
    joinedButton: {
        backgroundColor: '#888',
    },
    userInfoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    userInfo: {
        marginLeft: 8,
    },
    timeText: {
        fontSize: 12,
        color: '#666',
    },
    eventDate: {
        fontSize: 14,
        color: '#666',
        marginBottom: 8,
        marginLeft: 4,
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
    closeButton: {
        padding: 5,
    },
    closeButtonText: {
        fontSize: 24,
        color: '#666',
    },
    imagePlaceholder: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f0f0f0',
        borderRadius: 10,
    },
    filterChipsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: 10,
        gap: 8,
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        gap: 6,
    },
    filterChipText: {
        fontSize: 14,
        fontWeight: '500',
    },
    filterScroll: {
        padding: 15,
    },
    filterSection: {
        marginBottom: 20,
    },
    filterSectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 10,
    },
    optionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 10,
    },
    optionText: {
        fontSize: 14,
    },
    participantsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 15,
    },
    participantButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    participantButtonText: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    participantCount: {
        fontSize: 18,
        fontWeight: '600',
        minWidth: 30,
        textAlign: 'center',
    },
    filterButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        padding: 15,
        borderTopWidth: 1,
        borderTopColor: '#eee',
    },
    filterButton: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        marginHorizontal: 5,
    },
    filterButtonText: {
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
    },
    difficultyContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    difficultyButton: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 16,
    },
    difficultyButtonText: {
        fontSize: 14,
        fontWeight: '500',
    },
    activityContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    activityButton: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 16,
    },
    activityButtonText: {
        fontSize: 14,
        fontWeight: '500',
    },
    dateContainer: {
        gap: 10,
    },
    dateInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    dateLabel: {
        fontSize: 14,
        fontWeight: '500',
        flex: 1,
    },
    dateButton: {
        flex: 2,
        padding: 10,
        borderRadius: 8,
        alignItems: 'center',
    },
    dateButtonText: {
        fontSize: 14,
    },
    filterHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    pendingButton: {
        backgroundColor: '#FFC107', // Galben pentru pending
    },
});

