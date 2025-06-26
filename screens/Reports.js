import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, Alert } from 'react-native';
import { db } from '../config/firebase';
import { collection, getDocs, doc, deleteDoc } from 'firebase/firestore';

export default function Reports({ navigation }) {
    const [reports, setReports] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchReports();
    }, []);

    const fetchReports = async () => {
        setLoading(true);
        try {
            // Feedback
            const feedbackSnapshot = await getDocs(collection(db, 'feedback'));
            const feedbacks = feedbackSnapshot.docs.map(doc => ({ id: doc.id, type: 'feedback', ...doc.data() }));
            // Bug reports (dacă există o colecție separată)
            let bugReports = [];
            try {
                const bugSnapshot = await getDocs(collection(db, 'bugReports'));
                bugReports = bugSnapshot.docs.map(doc => ({ id: doc.id, type: 'bug', ...doc.data() }));
            } catch { }
            setReports([...feedbacks, ...bugReports]);
        } catch (e) {
            Alert.alert('Eroare', 'Nu s-au putut încărca rapoartele.');
        }
        setLoading(false);
    };

    const handleDelete = async (item) => {
        Alert.alert('Confirmare', 'Sigur vrei să ștergi acest raport?', [
            { text: 'Anulează', style: 'cancel' },
            {
                text: 'Șterge', style: 'destructive', onPress: async () => {
                    try {
                        await deleteDoc(doc(db, item.type === 'bug' ? 'bugReports' : 'feedback', item.id));
                        fetchReports();
                    } catch (e) {
                        Alert.alert('Eroare', 'Nu s-a putut șterge raportul.');
                    }
                }
            }
        ]);
    };

    const filteredReports = reports.filter(item =>
        (item.message || item.subject || '').toLowerCase().includes(search.toLowerCase()) ||
        (item.email || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Text style={styles.backText}>←</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Rapoarte & Feedback</Text>
            </View>
            <View style={styles.statsRow}>
                <StatCard label="Total rapoarte" value={reports.length} color="#00ACC1" />
                <StatCard label="Feedback" value={reports.filter(i => i.type === 'feedback').length} color="#4CAF50" />
                <StatCard label="Bug reports" value={reports.filter(i => i.type === 'bug').length} color="#E53935" />
            </View>
            <TextInput
                style={styles.search}
                placeholder="Caută după mesaj, subiect sau email..."
                value={search}
                onChangeText={setSearch}
            />
            <FlatList
                data={filteredReports}
                keyExtractor={item => item.id}
                refreshing={loading}
                onRefresh={fetchReports}
                renderItem={({ item }) => (
                    <View style={styles.reportCard}>
                        <Text style={styles.reportType}>{item.type === 'bug' ? 'Bug report' : 'Feedback'}</Text>
                        <Text style={styles.reportSubject}>{item.subject || '-'}</Text>
                        <Text style={styles.reportMessage}>{item.message || '-'}</Text>
                        <Text style={styles.reportEmail}>Email: {item.email || '-'}</Text>
                        <Text style={styles.reportDate}>Trimis: {item.createdAt?.toDate?.().toLocaleDateString?.() || '-'}</Text>
                        <TouchableOpacity
                            style={[styles.actionBtn, { backgroundColor: '#E53935', alignSelf: 'flex-end', marginTop: 6 }]}
                            onPress={() => handleDelete(item)}
                        >
                            <Text style={styles.actionText}>Șterge</Text>
                        </TouchableOpacity>
                    </View>
                )}
                ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 40, color: '#888' }}>Niciun raport găsit.</Text>}
            />
        </View>
    );
}

function StatCard({ label, value, color }) {
    return (
        <View style={[styles.statCard, { borderColor: color }]}>
            <Text style={[styles.statValue, { color }]}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F5F5F5', padding: 12, paddingTop: 70 },
    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, marginTop: 10 },
    backButton: { marginRight: 10, padding: 6 },
    backText: { fontSize: 26, color: '#556B2F' },
    title: { fontSize: 22, fontWeight: 'bold', color: '#333' },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    statCard: { flex: 1, borderWidth: 2, borderRadius: 10, padding: 12, marginHorizontal: 4, backgroundColor: '#fff', alignItems: 'center' },
    statValue: { fontSize: 18, fontWeight: 'bold' },
    statLabel: { fontSize: 12, color: '#666' },
    search: { backgroundColor: '#fff', borderRadius: 8, padding: 10, marginBottom: 10, borderWidth: 1, borderColor: '#ddd' },
    reportCard: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 10, elevation: 2 },
    reportType: { fontWeight: 'bold', fontSize: 14, color: '#00ACC1' },
    reportSubject: { fontSize: 15, color: '#333', fontWeight: 'bold' },
    reportMessage: { fontSize: 14, color: '#333', marginBottom: 4 },
    reportEmail: { fontSize: 12, color: '#888' },
    reportDate: { fontSize: 12, color: '#aaa' },
    actionBtn: { borderRadius: 6, paddingVertical: 6, paddingHorizontal: 12, marginRight: 8 },
    actionText: { color: '#fff', fontWeight: 'bold' },
}); 