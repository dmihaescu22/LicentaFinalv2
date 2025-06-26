import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    Alert,
    Animated,
} from 'react-native';
import { auth, db } from '../config/firebase';
import { doc, getDoc, updateDoc, setDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

const BADGES = {
    firstHike: {
        id: 'firstHike',
        title: 'First Hike',
        description: 'Complete your first hike',
        iconName: 'directions-walk',
        iconLib: 'MaterialIcons',
        iconColor: '#388e3c',
        gradient: ['#a8e063', '#56ab2f'],
        requirement: 1,
        type: 'hikes',
        level: 'Hiking Novice'
    },
    beginnerHiker: {
        id: 'beginnerHiker',
        title: 'Beginner Hiker',
        description: 'Complete 5 hikes',
        iconName: 'hiking',
        iconLib: 'FontAwesome5',
        iconColor: '#1976d2',
        gradient: ['#43cea2', '#185a9d'],
        requirement: 5,
        type: 'hikes',
        level: 'Hiking Enthusiast'
    },
    intermediateHiker: {
        id: 'intermediateHiker',
        title: 'Intermediate Hiker',
        description: 'Complete 15 hikes',
        iconName: 'terrain',
        iconLib: 'MaterialIcons',
        iconColor: '#8e24aa',
        gradient: ['#c471f5', '#fa71cd'],
        requirement: 15,
        type: 'hikes',
        level: 'Hiking Explorer'
    },
    expertHiker: {
        id: 'expertHiker',
        title: 'Expert Hiker',
        description: 'Complete 30 hikes',
        iconName: 'mountain',
        iconLib: 'FontAwesome5',
        iconColor: '#fff',
        iconEarnedColor: '#ff9800',
        gradient: ['#f7971e', '#ffd200'],
        requirement: 30,
        type: 'hikes',
        level: 'Hiking Master'
    },
    firstDistance: {
        id: 'firstDistance',
        title: 'First Kilometer',
        description: 'Hike your first kilometer',
        iconName: 'straighten',
        iconLib: 'MaterialIcons',
        iconColor: '#009688',
        gradient: ['#43e97b', '#38f9d7'],
        requirement: 1,
        type: 'distance',
        level: 'Hiking Novice'
    },
    distanceMaster: {
        id: 'distanceMaster',
        title: 'Distance Master',
        description: 'Hike 50 kilometers',
        iconName: 'road',
        iconLib: 'FontAwesome5',
        iconColor: '#fff',
        iconEarnedColor: '#e53935',
        gradient: ['#f85032', '#e73827'],
        requirement: 50,
        type: 'distance',
        level: 'Hiking Explorer'
    },
    marathonMaster: {
        id: 'marathonMaster',
        title: 'Marathon Master',
        description: 'Hike 100 kilometers',
        iconName: 'running',
        iconLib: 'FontAwesome5',
        iconColor: '#3949ab',
        gradient: ['#4e54c8', '#8f94fb'],
        requirement: 100,
        type: 'distance',
        level: 'Hiking Master'
    },
    ultraMaster: {
        id: 'ultraMaster',
        title: 'Ultra Master',
        description: 'Hike 200 kilometers',
        iconName: 'medal',
        iconLib: 'FontAwesome5',
        iconColor: '#fff',
        iconEarnedColor: '#ffd600',
        gradient: ['#f7971e', '#ffd200'],
        requirement: 200,
        type: 'distance',
        level: 'Hiking Master'
    }
};

const LEVELS = {
    'Hiking Novice': {
        title: 'Hiking Novice',
        description: 'Just starting your hiking journey',
        color: '#9E9E9E',
        requiredBadges: ['firstHike', 'firstDistance']
    },
    'Hiking Enthusiast': {
        title: 'Hiking Enthusiast',
        description: 'You\'re getting the hang of hiking',
        color: '#4CAF50',
        requiredBadges: ['beginnerHiker']
    },
    'Hiking Explorer': {
        title: 'Hiking Explorer',
        description: 'You\'re becoming a seasoned hiker',
        color: '#2196F3',
        requiredBadges: ['intermediateHiker', 'distanceMaster']
    },
    'Hiking Master': {
        title: 'Hiking Master',
        description: 'You\'re a true hiking expert',
        color: '#9C27B0',
        requiredBadges: ['expertHiker', 'marathonMaster', 'ultraMaster']
    }
};

const LEVEL_ICONS = {
    'Hiking Novice': { lib: 'FontAwesome5', name: 'seedling', color: '#9E9E9E', bg: ['#e0e0e0', '#f5f5f5'] },
    'Hiking Enthusiast': { lib: 'MaterialIcons', name: 'hiking', color: '#4CAF50', bg: ['#a8e063', '#56ab2f'] },
    'Hiking Explorer': { lib: 'FontAwesome5', name: 'compass', color: '#2196F3', bg: ['#43cea2', '#185a9d'] },
    'Hiking Master': { lib: 'FontAwesome5', name: 'medal', color: '#9C27B0', bg: ['#c471f5', '#fa71cd'] },
};

export default function BadgesScreen() {
    const { isDarkMode, colors } = useTheme();
    const [userStats, setUserStats] = useState({
        hikes: 0,
        distance: 0,
        badges: [],
        level: 'Hiking Novice'
    });
    const [selectedTab, setSelectedTab] = useState('badges');
    const fadeAnim = new Animated.Value(1);

    useEffect(() => {
        if (!auth.currentUser) return;

        const fetchUserStats = async () => {
            const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
            if (userDoc.exists()) {
                const data = userDoc.data();
                // Preluăm statisticile din activități
                const activitiesQuery = query(
                    collection(db, 'activities'),
                    where('userId', '==', auth.currentUser.uid)
                );
                const activitiesSnapshot = await getDocs(activitiesQuery);
                let totalDistance = 0;
                activitiesSnapshot.forEach((doc) => {
                    if (doc.data().distance) {
                        totalDistance += parseFloat(doc.data().distance);
                    }
                });

                setUserStats({
                    hikes: activitiesSnapshot.size,
                    distance: Math.round(totalDistance),
                    badges: data.badges || [],
                    level: data.level || 'Hiking Novice'
                });
            }
        };

        fetchUserStats();
    }, []);

    useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
        }).start();
    }, [selectedTab]);

    const checkAndUpdateBadges = async () => { //#1
        const newBadges = [...userStats.badges];
        let hasNewBadges = false;

        Object.values(BADGES).forEach(badge => {
            if (!newBadges.includes(badge.id)) {
                if (badge.type === 'hikes' && userStats.hikes >= badge.requirement) {
                    newBadges.push(badge.id);
                    hasNewBadges = true;
                } else if (badge.type === 'distance' && userStats.distance >= badge.requirement) {
                    newBadges.push(badge.id);
                    hasNewBadges = true;
                }
            }
        });

        if (hasNewBadges) {
            // Verificăm dacă utilizatorul a atins un nou nivel
            let newLevel = userStats.level;
            Object.entries(LEVELS).forEach(([level, levelData]) => {
                if (levelData.requiredBadges.every(badge => newBadges.includes(badge))) {
                    newLevel = level;
                }
            });

            // Actualizăm în baza de date
            await updateDoc(doc(db, 'users', auth.currentUser.uid), {
                badges: newBadges,
                level: newLevel
            });

            setUserStats(prev => ({
                ...prev,
                badges: newBadges,
                level: newLevel
            }));

            Alert.alert('New Badges!', 'You have earned new badges! Check them out!');
        }
    };

    useEffect(() => {
        checkAndUpdateBadges();
    }, [userStats.hikes, userStats.distance]);

    const renderBadge = (badge) => {
        const isEarned = userStats.badges.includes(badge.id);
        let IconComponent = MaterialIcons;
        if (badge.iconLib === 'FontAwesome5') IconComponent = FontAwesome5;
        return (
            <Animated.View
                key={badge.id}
                style={[
                    styles.badgeContainer,
                    {
                        borderColor: isEarned ? '#4CAF50' : colors.border,
                        borderWidth: 2,
                        opacity: isEarned ? 1 : 0.5,
                    },
                    { opacity: fadeAnim }
                ]}
            >
                <LinearGradient
                    colors={badge.gradient}
                    style={styles.badgeIconModern}
                >
                    <IconComponent
                        name={badge.iconName}
                        size={38}
                        color={isEarned && badge.iconEarnedColor ? badge.iconEarnedColor : '#fff'}
                        style={{ textShadowColor: 'transparent', textShadowRadius: 0 }}
                    />
                </LinearGradient>
                <View style={styles.badgeInfo}>
                    <View style={styles.badgeTitleRow}>
                        <Text style={[styles.badgeTitle, { color: colors.text }]}> {badge.title} </Text>
                        <View style={{ flex: 1 }} />
                        {isEarned && (
                            <FontAwesome5 name="check" size={16} color="#4CAF50" style={styles.badgeCheckRight} />
                        )}
                    </View>
                    <Text style={[styles.badgeDescription, { color: colors.secondaryText }]}> {badge.description} </Text>
                    {!isEarned && (
                        <View style={styles.progressContainer}>
                            <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                                <View
                                    style={[
                                        styles.progressFill,
                                        {
                                            width: `${(badge.type === 'hikes' ? userStats.hikes : userStats.distance) / badge.requirement * 100}%`,
                                            backgroundColor: colors.primary
                                        }
                                    ]}
                                />
                            </View>
                            <Text style={[styles.progressText, { color: colors.secondaryText }]}>
                                {badge.type === 'hikes' ? userStats.hikes : userStats.distance} / {badge.requirement}
                            </Text>
                        </View>
                    )}
                </View>
            </Animated.View>
        );
    };

    const renderLevel = (level) => {
        const levelData = LEVELS[level];
        const isUnlocked = levelData.requiredBadges.every(badge => userStats.badges.includes(badge));
        const isCurrentLevel = level === userStats.level;
        const isPreviousLevel = Object.keys(LEVELS).indexOf(level) < Object.keys(LEVELS).indexOf(userStats.level);
        const isLocked = !isUnlocked && !isCurrentLevel && !isPreviousLevel;
        const iconMeta = LEVEL_ICONS[level];
        let IconComponent = MaterialIcons;
        if (iconMeta.lib === 'FontAwesome5') IconComponent = FontAwesome5;
        return (
            <View key={level} style={[
                styles.levelContainer,
                {
                    borderColor: isCurrentLevel ? iconMeta.color : (isUnlocked || isPreviousLevel) ? iconMeta.color : '#bbb',
                    borderWidth: 2,
                    backgroundColor: isCurrentLevel ? undefined : colors.secondary,
                    opacity: isLocked ? 0.5 : 1,
                    shadowColor: isCurrentLevel ? iconMeta.color : '#000',
                    shadowOpacity: isCurrentLevel ? 0.25 : 0.1,
                    shadowRadius: isCurrentLevel ? 12 : 3,
                    elevation: isCurrentLevel ? 8 : 3,
                },
            ]}>
                <LinearGradient
                    colors={isCurrentLevel ? iconMeta.bg : ['#fff', '#f5f5f5']}
                    style={styles.levelIcon}
                >
                    <IconComponent
                        name={iconMeta.name}
                        size={32}
                        color={isLocked ? '#bbb' : iconMeta.color}
                    />
                </LinearGradient>
                <View style={styles.levelInfo}>
                    <View style={styles.levelTitleRow}>
                        <Text style={[styles.levelTitle, { color: isLocked ? colors.secondaryText : colors.text }]}> {levelData.title} </Text>
                        {isCurrentLevel && (
                            <View style={styles.currentLevelBadge}><Text style={styles.currentLevelBadgeText}>Current Level</Text></View>
                        )}
                        {isPreviousLevel && (
                            <View style={styles.levelCheckWrap}><FontAwesome5 name="check-circle" size={18} color="#4CAF50" /></View>
                        )}
                    </View>
                    <Text style={[styles.levelDescription, { color: colors.secondaryText }]}> {levelData.description} </Text>
                    <View style={styles.levelBadgesRow}>
                        {levelData.requiredBadges.map(badgeId => {
                            const badge = BADGES[badgeId];
                            const earned = userStats.badges.includes(badgeId);
                            let BadgeIcon = MaterialIcons;
                            if (badge.iconLib === 'FontAwesome5') BadgeIcon = FontAwesome5;
                            return (
                                <View key={badgeId} style={styles.levelBadgeIconWrap}>
                                    <LinearGradient colors={badge.gradient} style={styles.levelBadgeIconBg}>
                                        <BadgeIcon name={badge.iconName} size={18} color={earned ? (badge.iconEarnedColor || badge.iconColor) : '#fff'} />
                                    </LinearGradient>
                                    {earned && <FontAwesome5 name="check" size={12} color="#4CAF50" style={styles.levelBadgeCheck} />}
                                </View>
                            );
                        })}
                    </View>
                </View>
            </View>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <LinearGradient
                colors={['#556B2F', '#3d4a21']}
                style={styles.header}
            >
                <Text style={styles.headerTitle}>Your Progress</Text>
                <View style={styles.statsContainer}>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{userStats.hikes}</Text>
                        <Text style={styles.statLabel}>Hikes</Text>
                    </View>
                    <View style={styles.statItem}>
                        <Text style={styles.statValue}>{userStats.distance}</Text>
                        <Text style={styles.statLabel}>km</Text>
                    </View>
                </View>
            </LinearGradient>

            <View style={[styles.tabContainer, { backgroundColor: colors.secondary }]}>
                <TouchableOpacity
                    style={[
                        styles.tab,
                        selectedTab === 'badges' && [styles.activeTab, { backgroundColor: colors.primary }]
                    ]}
                    onPress={() => setSelectedTab('badges')}
                >
                    <Text style={[
                        styles.tabText,
                        { color: colors.text },
                        selectedTab === 'badges' && { color: '#FFF' }
                    ]}>
                        Badges
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[
                        styles.tab,
                        selectedTab === 'levels' && [styles.activeTab, { backgroundColor: colors.primary }]
                    ]}
                    onPress={() => setSelectedTab('levels')}
                >
                    <Text style={[
                        styles.tabText,
                        { color: colors.text },
                        selectedTab === 'levels' && { color: '#FFF' }
                    ]}>
                        Levels
                    </Text>
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 80 }}>
                {selectedTab === 'badges' ? (
                    Object.values(BADGES).map(renderBadge)
                ) : (
                    Object.keys(LEVELS).map(renderLevel)
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        padding: 20,
        paddingTop: 60,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#FFF',
        marginBottom: 15,
        textAlign: 'center',
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 15,
        padding: 15,
        marginHorizontal: 20,
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#FFF',
    },
    statLabel: {
        fontSize: 16,
        color: '#FFF',
        opacity: 0.9,
    },
    tabContainer: {
        flexDirection: 'row',
        padding: 10,
        marginTop: -20,
        marginHorizontal: 20,
        borderRadius: 15,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderRadius: 10,
    },
    activeTab: {},
    tabText: {
        fontSize: 16,
        fontWeight: '600',
    },
    content: {
        flex: 1,
        padding: 20,
    },
    badgeContainer: {
        flexDirection: 'row',
        borderRadius: 15,
        padding: 15,
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    badgeIconModern: {
        width: 70,
        height: 70,
        borderRadius: 35,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
        borderWidth: 3,
        borderColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 8,
    },
    badgeInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    badgeTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 5,
    },
    badgeDescription: {
        fontSize: 14,
        marginBottom: 10,
    },
    progressContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    progressBar: {
        flex: 1,
        height: 6,
        borderRadius: 3,
        marginRight: 10,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 3,
    },
    progressText: {
        fontSize: 12,
        fontWeight: '500',
    },
    levelContainer: {
        flexDirection: 'row',
        borderRadius: 15,
        padding: 15,
        marginBottom: 15,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        elevation: 3,
    },
    levelIcon: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 15,
    },
    levelIconText: {
        fontSize: 30,
    },
    levelInfo: {
        flex: 1,
    },
    levelTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 5,
    },
    levelDescription: {
        fontSize: 14,
        marginBottom: 5,
    },
    levelProgress: {
        fontSize: 12,
    },
    currentLevelText: {
        fontWeight: 'bold',
        marginTop: 5,
    },
    previousLevelText: {
        fontWeight: '500',
    },
    currentLevelBadge: {
        backgroundColor: '#4CAF50',
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 2,
        marginLeft: 8,
        alignSelf: 'center',
        marginTop: -4,
    },
    currentLevelBadgeText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 12,
        paddingTop: 0,
        marginTop: -1,
    },
    levelBadgesRow: {
        flexDirection: 'row',
        marginTop: 8,
        gap: 8,
    },
    levelBadgeIconWrap: {
        position: 'relative',
        marginRight: 8,
    },
    levelBadgeIconBg: {
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    levelBadgeCheck: {
        position: 'absolute',
        bottom: -4,
        right: -4,
        backgroundColor: '#fff',
        borderRadius: 8,
        padding: 1,
        elevation: 2,
    },
    levelTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    levelCheckWrap: {
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 6,
        height: 22,
        width: 22,
        marginTop: -4,
    },
    badgeCheckRight: {
        marginLeft: 256,
        alignSelf: 'center',
    },
});

