import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, Dimensions } from 'react-native';
import { db } from '../config/firebase';
import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { PieChart, LineChart } from 'react-native-chart-kit';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';

const screenWidth = Dimensions.get('window').width;

const REPORT_TYPES = ['spam', 'limbaj', 'conținut nepotrivit', 'altul'];

export default function ContentManagement({ navigation }) {
    const [reportedContent, setReportedContent] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState('');

    useEffect(() => {
        fetchContent();
    }, []);

    const fetchContent = async () => {
        setLoading(true);
        try {
            // Postări raportate
            const postsSnapshot = await getDocs(collection(db, 'posts'));
            const reportedPosts = postsSnapshot.docs
                .filter(doc => doc.data().reported)
                .map(doc => ({ id: doc.id, type: 'post', ...doc.data() }));
            // Trasee raportate
            const hikesSnapshot = await getDocs(collection(db, 'hikes'));
            const reportedHikes = hikesSnapshot.docs
                .filter(doc => doc.data().reported)
                .map(doc => ({ id: doc.id, type: 'hike', ...doc.data() }));
            setReportedContent([...reportedPosts, ...reportedHikes]);
        } catch (e) {
            Alert.alert('Eroare', 'Nu s-a putut încărca conținutul raportat.');
        }
        setLoading(false);
    };

    // Statistici: top utilizatori cu conținut raportat
    const userReportCount = {};
    reportedContent.forEach(item => {
        if (item.userId) {
            userReportCount[item.userId] = (userReportCount[item.userId] || 0) + 1;
        }
    });
    const topReportedUsers = Object.entries(userReportCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([userId, count]) => ({ userId, count }));

    // Statistici: distribuție pe tipuri de raportări
    const typeCount = {};
    REPORT_TYPES.forEach(type => (typeCount[type] = 0));
    reportedContent.forEach(item => {
        const t = item.reportType || 'altul';
        typeCount[t] = (typeCount[t] || 0) + 1;
    });
    const pieData = REPORT_TYPES.map(type => ({
        name: type,
        count: typeCount[type],
        color: type === 'spam' ? '#E53935' : type === 'limbaj' ? '#FF9800' : type === 'conținut nepotrivit' ? '#2196F3' : '#9E9E9E',
        legendFontColor: '#333',
        legendFontSize: 13,
    })).filter(d => d.count > 0);

    // Statistici: evoluție raportări pe ultimele 14 zile
    const now = new Date();
    let reportGrowth = Array(14).fill(0);
    reportedContent.forEach(item => {
        if (item.createdAt && item.createdAt.toDate) {
            const daysAgo = Math.floor((now - item.createdAt.toDate()) / (1000 * 60 * 60 * 24));
            if (daysAgo < 14) reportGrowth[13 - daysAgo]++;
        }
    });

    // Filtrare avansată
    const filteredContent = reportedContent.filter(item =>
        ((item.title || item.name || '').toLowerCase().includes(search.toLowerCase())) &&
        (!filterType || (item.reportType || 'altul') === filterType)
    );

    // Acțiuni rapide
    const handleBanUser = async (userId) => {
        try {
            await updateDoc(doc(db, 'users', userId), { banned: true });
            Alert.alert('Succes', 'Utilizatorul a fost banat.');
        } catch (e) {
            Alert.alert('Eroare', 'Nu s-a putut bana utilizatorul.');
        }
    };

    const handleDelete = async (item) => {
        Alert.alert('Confirmare', `Sigur vrei să ștergi acest ${item.type === 'post' ? 'post' : 'traseu'}?`, [
            { text: 'Anulează', style: 'cancel' },
            {
                text: 'Șterge', style: 'destructive', onPress: async () => {
                    try {
                        await deleteDoc(doc(db, item.type === 'post' ? 'posts' : 'hikes', item.id));
                        fetchContent();
                    } catch (e) {
                        Alert.alert('Eroare', 'Nu s-a putut șterge conținutul.');
                    }
                }
            }
        ]);
    };

    const handleResolve = async (item) => {
        try {
            await updateDoc(doc(db, item.type === 'post' ? 'posts' : 'hikes', item.id), { reported: false });
            fetchContent();
        } catch (e) {
            Alert.alert('Eroare', 'Nu s-a putut marca ca rezolvat.');
        }
    };

    return (
        <View style={styles.container}>
            <LinearGradient
                colors={['#556B2F', '#2F4F4F']}
                style={styles.headerGradient}
            >
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                        <MaterialIcons name="arrow-back" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Management Conținut</Text>
                    <View style={{ width: 24 }} />
                </View>
            </LinearGradient>

            <FlatList
                data={filteredContent}
                keyExtractor={item => item.id}
                refreshing={loading}
                onRefresh={fetchContent}
                ListHeaderComponent={
                    <>
                        {/* Filtre și căutare */}
                        <View style={styles.filterContainer}>
                            <View style={styles.searchContainer}>
                                <MaterialIcons name="search" size={24} color="#666" style={styles.searchIcon} />
                                <TextInput
                                    style={styles.search}
                                    placeholder="Caută conținut..."
                                    value={search}
                                    onChangeText={setSearch}
                                    placeholderTextColor="#999"
                                />
                            </View>
                            <FlatList
                                horizontal
                                data={REPORT_TYPES}
                                keyExtractor={item => item}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={[
                                            styles.filterChip,
                                            filterType === item && styles.filterChipActive
                                        ]}
                                        onPress={() => setFilterType(filterType === item ? '' : item)}
                                    >
                                        <Text style={[
                                            styles.filterChipText,
                                            filterType === item && styles.filterChipTextActive
                                        ]}>
                                            {item}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                                showsHorizontalScrollIndicator={false}
                                style={styles.filterList}
                            />
                        </View>

                        {/* Statistici */}
                        <View style={styles.statsContainer}>
                            <View style={styles.statCard}>
                                <MaterialIcons name="warning" size={24} color="#E53935" />
                                <Text style={styles.statValue}>{reportedContent.length}</Text>
                                <Text style={styles.statLabel}>Conținut raportat</Text>
                            </View>
                            <View style={styles.statCard}>
                                <MaterialIcons name="person" size={24} color="#FF9800" />
                                <Text style={styles.statValue}>{topReportedUsers.length}</Text>
                                <Text style={styles.statLabel}>Utilizatori cu raportări</Text>
                            </View>
                        </View>

                        {/* Grafic distribuție raportări */}
                        {pieData.length > 0 && (
                            <View style={styles.chartContainer}>
                                <Text style={styles.sectionTitle}>Distribuție pe tipuri de raportări</Text>
                                <PieChart
                                    data={pieData}
                                    width={screenWidth - 32}
                                    height={220}
                                    chartConfig={{
                                        color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                                    }}
                                    accessor="count"
                                    backgroundColor="transparent"
                                    paddingLeft="15"
                                    absolute
                                />
                            </View>
                        )}
                    </>
                }
                renderItem={({ item }) => (
                    <View style={styles.contentCard}>
                        <View style={styles.contentHeader}>
                            <View style={styles.contentTypeContainer}>
                                <MaterialIcons
                                    name={item.type === 'post' ? 'article' : 'terrain'}
                                    size={20}
                                    color="#556B2F"
                                />
                                <Text style={styles.contentType}>
                                    {item.type === 'post' ? 'Postare' : 'Traseu'}
                                </Text>
                            </View>
                            <View style={styles.reportTypeContainer}>
                                <MaterialIcons name="flag" size={16} color="#E53935" />
                                <Text style={styles.reportType}>{item.reportType || 'altul'}</Text>
                            </View>
                        </View>
                        <Text style={styles.contentTitle}>{item.title || item.name || 'Fără titlu'}</Text>
                        <Text style={styles.contentDate}>
                            Creat: {item.createdAt?.toDate?.().toLocaleDateString?.() || '-'}
                        </Text>
                        <View style={styles.actions}>
                            <TouchableOpacity
                                style={[styles.actionBtn, { backgroundColor: '#4CAF50' }]}
                                onPress={() => handleResolve(item)}
                            >
                                <MaterialIcons name="check" size={20} color="#fff" />
                                <Text style={styles.actionText}>Rezolvat</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.actionBtn, { backgroundColor: '#E53935' }]}
                                onPress={() => handleDelete(item)}
                            >
                                <MaterialIcons name="delete" size={20} color="#fff" />
                                <Text style={styles.actionText}>Șterge</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <MaterialIcons name="content-paste" size={48} color="#ccc" />
                        <Text style={styles.emptyText}>Niciun conținut raportat găsit.</Text>
                    </View>
                }
            />
        </View>
    );
}

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
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#fff',
    },
    filterContainer: {
        padding: 16,
        paddingTop: 20,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        paddingHorizontal: 12,
        marginBottom: 12,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    searchIcon: {
        marginRight: 8,
    },
    search: {
        flex: 1,
        paddingVertical: 12,
        fontSize: 16,
        color: '#333',
    },
    filterList: {
        marginTop: 8,
    },
    filterChip: {
        backgroundColor: '#fff',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        marginRight: 8,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1.41,
    },
    filterChipActive: {
        backgroundColor: '#556B2F',
    },
    filterChipText: {
        color: '#666',
        fontSize: 14,
    },
    filterChipTextActive: {
        color: '#fff',
    },
    statsContainer: {
        flexDirection: 'row',
        padding: 16,
        gap: 16,
    },
    statCard: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
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
        color: '#333',
        marginTop: 8,
    },
    statLabel: {
        fontSize: 13,
        color: '#666',
        marginTop: 4,
    },
    chartContainer: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        margin: 16,
        marginTop: 0,
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
    contentCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        margin: 16,
        marginTop: 0,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    contentHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    contentTypeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    contentType: {
        fontWeight: 'bold',
        fontSize: 14,
        color: '#556B2F',
    },
    reportTypeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    reportType: {
        fontSize: 13,
        color: '#E53935',
    },
    contentTitle: {
        fontSize: 16,
        color: '#333',
        marginBottom: 4,
    },
    contentDate: {
        fontSize: 12,
        color: '#999',
        marginBottom: 12,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 8,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
        gap: 4,
    },
    actionText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 14,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        marginTop: 12,
        fontSize: 16,
        color: '#999',
    },
}); 