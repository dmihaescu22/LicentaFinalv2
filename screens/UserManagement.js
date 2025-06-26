import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert, Image } from 'react-native';
import { db } from '../config/firebase';
import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';

export default function UserManagement({ navigation }) {
    const [users, setUsers] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const usersSnapshot = await getDocs(collection(db, 'users'));
            const usersData = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log('First user complete data:', JSON.stringify(usersData[0], null, 2));
            setUsers(usersData);
        } catch (e) {
            Alert.alert('Eroare', 'Nu s-au putut încărca utilizatorii.');
        }
        setLoading(false);
    };

    const handleRoleChange = async (userId, currentRole) => {
        try {
            await updateDoc(doc(db, 'users', userId), { role: currentRole === 'admin' ? 'user' : 'admin' });
            fetchUsers();
        } catch (e) {
            Alert.alert('Eroare', 'Nu s-a putut schimba rolul.');
        }
    };

    const handleDelete = async (userId) => {
        Alert.alert('Confirmare', 'Sigur vrei să ștergi acest utilizator?', [
            { text: 'Anulează', style: 'cancel' },
            {
                text: 'Șterge', style: 'destructive', onPress: async () => {
                    try {
                        await deleteDoc(doc(db, 'users', userId));
                        fetchUsers();
                    } catch (e) {
                        Alert.alert('Eroare', 'Nu s-a putut șterge utilizatorul.');
                    }
                }
            }
        ]);
    };

    const filteredUsers = users.filter(u =>
        (u.displayName || '').toLowerCase().includes(search.toLowerCase()) ||
        (u.email || '').toLowerCase().includes(search.toLowerCase())
    );

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
                    <Text style={styles.headerTitle}>Management Utilizatori</Text>
                    <View style={{ width: 24 }} />
                </View>
            </LinearGradient>

            <View style={styles.searchContainer}>
                <MaterialIcons name="search" size={24} color="#666" style={styles.searchIcon} />
                <TextInput
                    style={styles.search}
                    placeholder="Caută după nume sau email..."
                    value={search}
                    onChangeText={setSearch}
                    placeholderTextColor="#999"
                />
            </View>

            <FlatList
                data={filteredUsers}
                keyExtractor={item => item.id}
                refreshing={loading}
                onRefresh={fetchUsers}
                contentContainerStyle={styles.listContainer}
                renderItem={({ item }) => {
                    console.log(`User ${item.displayName} photo data:`, {
                        profilePhotoUrl: item.profilePhotoUrl
                    });

                    return (
                        <View style={styles.userCard}>
                            <View style={styles.userInfo}>
                                <View style={styles.avatarContainer}>
                                    {item.profilePhotoUrl ? (
                                        <Image
                                            source={{ uri: item.profilePhotoUrl }}
                                            style={styles.avatar}
                                        />
                                    ) : (
                                        <MaterialIcons
                                            name="person"
                                            size={32}
                                            color={item.role === 'admin' ? '#556B2F' : '#666'}
                                        />
                                    )}
                                </View>
                                <View style={styles.userDetails}>
                                    <Text style={styles.userName}>{item.displayName || 'Anonim'}</Text>
                                    <Text style={styles.userEmail}>{item.email}</Text>
                                    <View style={styles.roleContainer}>
                                        <MaterialIcons
                                            name={item.role === 'admin' ? 'admin-panel-settings' : 'person'}
                                            size={16}
                                            color={item.role === 'admin' ? '#556B2F' : '#666'}
                                        />
                                        <Text style={[
                                            styles.userRole,
                                            { color: item.role === 'admin' ? '#556B2F' : '#666' }
                                        ]}>
                                            {item.role === 'admin' ? 'Administrator' : 'Utilizator'}
                                        </Text>
                                    </View>
                                    <Text style={styles.userDate}>
                                        Creat: {item.createdAt?.toDate?.().toLocaleDateString?.() || '-'}
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.actions}>
                                <TouchableOpacity
                                    style={[
                                        styles.actionBtn,
                                        { backgroundColor: item.role === 'admin' ? '#4CAF50' : '#FF9800' }
                                    ]}
                                    onPress={() => handleRoleChange(item.id, item.role)}
                                >
                                    <MaterialIcons
                                        name={item.role === 'admin' ? 'person' : 'admin-panel-settings'}
                                        size={20}
                                        color="#fff"
                                    />
                                    <Text style={styles.actionText}>
                                        {item.role === 'admin' ? 'Fă user' : 'Fă admin'}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.actionBtn, { backgroundColor: '#E53935' }]}
                                    onPress={() => handleDelete(item.id)}
                                >
                                    <MaterialIcons name="delete" size={20} color="#fff" />
                                    <Text style={styles.actionText}>Șterge</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    );
                }}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <MaterialIcons name="people" size={48} color="#ccc" />
                        <Text style={styles.emptyText}>Niciun utilizator găsit.</Text>
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
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        margin: 16,
        marginTop: 20,
        borderRadius: 12,
        paddingHorizontal: 12,
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
    listContainer: {
        padding: 16,
    },
    userCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    userInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatarContainer: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#f0f0f0',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
        overflow: 'hidden',
    },
    avatar: {
        width: '100%',
        height: '100%',
        borderRadius: 25,
    },
    userDetails: {
        flex: 1,
    },
    userName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#333',
        marginBottom: 4,
    },
    userEmail: {
        fontSize: 14,
        color: '#666',
        marginBottom: 4,
    },
    roleContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    userRole: {
        fontSize: 13,
        marginLeft: 4,
    },
    userDate: {
        fontSize: 12,
        color: '#999',
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        marginTop: 12,
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