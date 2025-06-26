import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, FlatList, Alert, Dimensions, ImageBackground } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { db } from '../config/firebase';
import { collection, getDocs, query, orderBy, limit, where, Timestamp } from 'firebase/firestore';
import { LineChart, PieChart } from 'react-native-chart-kit';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';

const screenWidth = Dimensions.get('window').width;

export default function AdminDashboard({ navigation }) {
    const { logout } = useAuth();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalUsers: 0,
        newUsers: 0,
        totalHikes: 0,
        totalPosts: 0,
        userGrowth: [],
        topUsers: [],
        topHikes: [],
        recentActivity: [],
        reportedContent: 0,
        feedbackCount: 0,
    });

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            setLoading(true);

            // Preluăm toți utilizatorii
            const usersSnapshot = await getDocs(collection(db, 'users'));
            const totalUsers = usersSnapshot.size;
            const usersData = usersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Calculăm utilizatorii noi din ultimele 7 zile
            const sevenDaysAgo = Timestamp.fromDate(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
            const newUsersQuery = query(
                collection(db, 'users'),
                where('createdAt', '>=', sevenDaysAgo)
            );
            const newUsersSnapshot = await getDocs(newUsersQuery);
            const newUsers = newUsersSnapshot.size;

            // Preluăm toate traseele
            const hikesSnapshot = await getDocs(collection(db, 'activities'));
            const totalHikes = hikesSnapshot.size;
            const hikesData = hikesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            console.log('First hike data:', JSON.stringify(hikesData[0], null, 2));

            // Preluăm toate postările
            const postsSnapshot = await getDocs(collection(db, 'posts'));
            const totalPosts = postsSnapshot.size;

            // Calculăm creșterea utilizatorilor pe ultimele 7 zile
            const userGrowth = [];
            for (let i = 6; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const startOfDay = Timestamp.fromDate(new Date(date.setHours(0, 0, 0, 0)));
                const endOfDay = Timestamp.fromDate(new Date(date.setHours(23, 59, 59, 999)));

                const dailyUsersQuery = query(
                    collection(db, 'users'),
                    where('createdAt', '>=', startOfDay),
                    where('createdAt', '<=', endOfDay)
                );
                const dailyUsersSnapshot = await getDocs(dailyUsersQuery);
                userGrowth.push(dailyUsersSnapshot.size);
            }

            // Calculăm top utilizatori (cei cu cele mai multe trasee create)
            const userHikesCount = {};
            hikesData.forEach(hike => {
                const creatorId = hike.userId;
                if (creatorId) {
                    userHikesCount[creatorId] = (userHikesCount[creatorId] || 0) + 1;
                }
            });

            const topUsers = usersData
                .map(user => {
                    const hikesCount = userHikesCount[user.id] || 0;
                    return {
                        id: user.id,
                        displayName: user.displayName || 'Anonim',
                        hikesCount: hikesCount
                    };
                })
                .sort((a, b) => b.hikesCount - a.hikesCount)
                .slice(0, 5);

            // Calculăm top trasee (cele mai populare după numărul de creări)
            const hikePopularity = {};
            hikesData.forEach(hike => {
                const trailName = hike.trailName;
                if (trailName) {
                    hikePopularity[trailName] = (hikePopularity[trailName] || 0) + 1;
                }
            });

            // Grupăm traseele după nume și calculăm popularitatea
            const topHikes = Object.entries(hikePopularity)
                .map(([trailName, count]) => ({
                    id: trailName, // Folosim numele ca ID pentru grupare
                    trailName: trailName,
                    participants: count,
                    createdAt: null
                }))
                .sort((a, b) => b.participants - a.participants)
                .slice(0, 5);

            console.log('Top hikes:', topHikes);

            setStats({
                totalUsers,
                newUsers,
                totalHikes,
                totalPosts,
                userGrowth,
                topUsers,
                topHikes,
                recentActivity: [],
                reportedContent: 0,
                feedbackCount: 0,
            });
        } catch (error) {
            console.error('Error fetching stats:', error);
            Alert.alert('Error', 'Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    };

    const renderItem = ({ item }) => (
        <View style={styles.activityCard}>
            <Text style={styles.activityText}>{item.text}</Text>
            <Text style={styles.activityDate}>{item.date}</Text>
        </View>
    );

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#556B2F" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#556B2F', '#2F4F4F']}
                style={styles.headerGradient}
            >
                <View style={styles.header}>
                    <Text style={styles.headerTitle}>Admin Dashboard</Text>
                    <TouchableOpacity style={styles.logoutButton} onPress={logout}>
                        <MaterialIcons name="logout" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            <FlatList
                style={styles.contentContainer}
                contentContainerStyle={styles.contentContainerStyle}
                data={[1]}
                renderItem={() => (
                    <>
                        {/* Statistici generale */}
                        <View style={styles.statsRow}>
                            <StatCard
                                label="Utilizatori"
                                value={stats.totalUsers}
                                color="#556B2F"
                                icon="people"
                            />
                            <StatCard
                                label="Noi (7z)"
                                value={stats.newUsers}
                                color="#4CAF50"
                                icon="person-add"
                            />
                            <StatCard
                                label="Trasee"
                                value={stats.totalHikes}
                                color="#2196F3"
                                icon="terrain"
                            />
                            <StatCard
                                label="Postări"
                                value={stats.totalPosts}
                                color="#FF9800"
                                icon="article"
                            />
                        </View>

                        {/* Grafic evoluție utilizatori */}
                        <View style={styles.chartContainer}>
                            <Text style={styles.sectionTitle}>Evoluție utilizatori (7 zile)</Text>
                            <LineChart
                                data={{
                                    labels: ['-6z', '-5z', '-4z', '-3z', '-2z', '-1z', 'Azi'],
                                    datasets: [{ data: stats.userGrowth }],
                                }}
                                width={screenWidth - 32}
                                height={220}
                                chartConfig={{
                                    backgroundColor: '#fff',
                                    backgroundGradientFrom: '#fff',
                                    backgroundGradientTo: '#fff',
                                    decimalPlaces: 0,
                                    color: (opacity = 1) => `rgba(85, 107, 47, ${opacity})`,
                                    labelColor: (opacity = 1) => `rgba(0,0,0,${opacity})`,
                                    style: { borderRadius: 16 },
                                    propsForDots: {
                                        r: "6",
                                        strokeWidth: "2",
                                        stroke: "#556B2F"
                                    }
                                }}
                                bezier
                                style={styles.chart}
                            />
                        </View>

                        {/* Top utilizatori */}
                        <View style={styles.sectionContainer}>
                            <Text style={styles.sectionTitle}>Top utilizatori (trasee)</Text>
                            <View style={styles.topList}>
                                {stats.topUsers.length > 0 ? (
                                    stats.topUsers.map((user, index) => (
                                        <View key={user.id} style={styles.topCard}>
                                            <MaterialIcons name="person" size={24} color="#556B2F" />
                                            <Text style={styles.topName}>{user.displayName || 'Anonim'}</Text>
                                            <Text style={styles.topValue}>{user.hikesCount || 0} trasee</Text>
                                        </View>
                                    ))
                                ) : (
                                    <View style={styles.emptyState}>
                                        <MaterialIcons name="people" size={32} color="#ccc" />
                                        <Text style={styles.emptyText}>Nu există utilizatori cu trasee</Text>
                                    </View>
                                )}
                            </View>
                        </View>

                        {/* Top trasee */}
                        <View style={styles.sectionContainer}>
                            <Text style={styles.sectionTitle}>Top trasee</Text>
                            <View style={styles.topList}>
                                {stats.topHikes.length > 0 ? (
                                    stats.topHikes.map((hike, index) => (
                                        <View key={hike.id} style={styles.topCard}>
                                            <MaterialIcons name="terrain" size={24} color="#556B2F" />
                                            <Text style={styles.topName}>{hike.trailName || 'Traseu fără nume'}</Text>
                                            <Text style={styles.topValue}>{hike.participants || 0} participanți</Text>
                                        </View>
                                    ))
                                ) : (
                                    <View style={styles.emptyState}>
                                        <MaterialIcons name="terrain" size={32} color="#ccc" />
                                        <Text style={styles.emptyText}>Nu există trasee populare</Text>
                                    </View>
                                )}
                            </View>
                        </View>

                        {/* Link-uri rapide */}
                        <View style={styles.linksRow}>
                            <TouchableOpacity
                                style={styles.linkButton}
                                onPress={() => navigation.navigate('UserManagement')}
                            >
                                <MaterialIcons name="people" size={24} color="#fff" />
                                <Text style={styles.linkText}>Gestionare Utilizatori</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.linkButton}
                                onPress={() => navigation.navigate('ContentManagement')}
                            >
                                <MaterialIcons name="content-paste" size={24} color="#fff" />
                                <Text style={styles.linkText}>Gestionare Conținut</Text>
                            </TouchableOpacity>
                        </View>
                    </>
                )}
                keyExtractor={() => 'dashboard'}
            />
        </View>
    );
}

const StatCard = ({ label, value, color, icon }) => (
    <View style={[styles.statCard, { borderColor: color }]}>
        <MaterialIcons name={icon} size={24} color={color} />
        <Text style={[styles.statValue, { color }]}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
    </View>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },
    headerGradient: {
        paddingTop: 50,
        paddingBottom: 20,
        paddingHorizontal: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#fff',
    },
    logoutButton: {
        padding: 8,
    },
    contentContainer: {
        flex: 1,
    },
    contentContainerStyle: {
        padding: 16,
        paddingBottom: 100,
    },
    statsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    statCard: {
        flex: 1,
        borderWidth: 2,
        borderRadius: 15,
        padding: 15,
        marginHorizontal: 4,
        backgroundColor: '#fff',
        alignItems: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    statValue: {
        fontSize: 24,
        fontWeight: 'bold',
        marginTop: 8,
    },
    statLabel: {
        fontSize: 13,
        color: '#666',
        marginTop: 4,
    },
    chartContainer: {
        backgroundColor: '#fff',
        borderRadius: 15,
        padding: 16,
        marginBottom: 20,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    chart: {
        marginVertical: 8,
        borderRadius: 16,
    },
    sectionContainer: {
        backgroundColor: '#fff',
        borderRadius: 15,
        padding: 16,
        marginBottom: 20,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 12,
    },
    topList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    topCard: {
        backgroundColor: '#f8f8f8',
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
        alignItems: 'center',
        minWidth: '48%',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1.41,
    },
    topName: {
        fontWeight: 'bold',
        fontSize: 14,
        color: '#556B2F',
        marginTop: 8,
        textAlign: 'center',
    },
    topValue: {
        fontSize: 13,
        color: '#666',
        marginTop: 4,
    },
    linksRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    linkButton: {
        flex: 1,
        backgroundColor: '#556B2F',
        borderRadius: 12,
        padding: 16,
        marginHorizontal: 4,
        alignItems: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    linkText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
        marginTop: 8,
    },
    emptyState: {
        width: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    emptyText: {
        marginTop: 8,
        fontSize: 14,
        color: '#999',
        textAlign: 'center',
    },
}); 