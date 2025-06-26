import React, { createContext, useState, useContext, useEffect } from 'react';
import { auth, db } from '../config/firebase';
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [role, setRole] = useState(null);
    const [loading, setLoading] = useState(true);
    const [offlineUpdates, setOfflineUpdates] = useState([]);
    const [showOfflineUpdates, setShowOfflineUpdates] = useState(false);

    const getLastLoginTime = async () => {
        try {
            const lastLogin = await AsyncStorage.getItem('lastLoginTime');
            return lastLogin ? new Date(lastLogin) : null;
        } catch (error) {
            console.error('Error getting last login time:', error);
            return null;
        }
    };

    const setLastLoginTime = async () => {
        try {
            await AsyncStorage.setItem('lastLoginTime', new Date().toISOString());
        } catch (error) {
            console.error('Error setting last login time:', error);
        }
    };

    const fetchOfflineUpdates = async (userId, lastLoginTime) => {
        // Date dummy pentru testare
        return [
            {
                title: "Traseul Bucegi a fost actualizat",
                description: "Noua durată estimată: 4 ore. Traseul a fost marcat ca fiind dificil.",
                time: new Date().toLocaleString(),
                type: 'event_update'
            },
            {
                title: "Eveniment de drumeție în Retezat",
                description: "S-a adăugat un nou punct de întâlnire pentru grupul de drumeție.",
                time: new Date(Date.now() - 3600000).toLocaleString(),
                type: 'event_update'
            },
            {
                title: "Modificare la traseul Piatra Craiului",
                description: "S-a modificat punctul de întâlnire pentru acest traseu. Verifică detaliile actualizate în eveniment!",
                time: new Date(Date.now() - 7200000).toLocaleString(),
                type: 'event_update'
            }
        ];

        // Comentăm codul original pentru moment
        /*
        if (!lastLoginTime) return [];

        try {
            const updates = [];
            
            // Verifică actualizările la evenimentele la care utilizatorul este înscris
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                const registeredEvents = userData.registeredEvents || [];

                for (const eventId of registeredEvents) {
                    const eventDoc = await getDoc(doc(db, 'events', eventId));
                    if (eventDoc.exists()) {
                        const eventData = eventDoc.data();
                        const lastUpdate = eventData.lastUpdate?.toDate();
                        
                        if (lastUpdate && lastUpdate > lastLoginTime) {
                            updates.push({
                                title: `Update for ${eventData.title}`,
                                description: eventData.lastUpdateDescription || 'Event details have been updated',
                                time: lastUpdate.toLocaleString(),
                                type: 'event_update'
                            });
                        }
                    }
                }
            }

            return updates;
        } catch (error) {
            console.error('Error fetching offline updates:', error);
            return [];
        }
        */
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            setUser(firebaseUser);
            if (firebaseUser) {
                const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
                if (userDoc.exists()) {
                    setRole(userDoc.data().role || 'user');
                } else {
                    setRole('user');
                }

                // Verifică actualizările offline
                const lastLoginTime = await getLastLoginTime();
                const updates = await fetchOfflineUpdates(firebaseUser.uid, lastLoginTime);
                setOfflineUpdates(updates);
                setShowOfflineUpdates(updates.length > 0);

                // Actualizează timpul ultimei autentificări
                await setLastLoginTime();
            } else {
                setRole(null);
                setOfflineUpdates([]);
                setShowOfflineUpdates(false);
            }
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    const login = async (email, password) => {
        setLoading(true);
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        setUser(userCredential.user);
        const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
        if (userDoc.exists()) {
            setRole(userDoc.data().role || 'user');
        } else {
            setRole('user');
        }
        setLoading(false);
    };

    const logout = async () => {
        await signOut(auth);
        setUser(null);
        setRole(null);
        setOfflineUpdates([]);
        setShowOfflineUpdates(false);
    };

    const dismissOfflineUpdates = () => {
        setShowOfflineUpdates(false);
    };

    return (
        <AuthContext.Provider value={{
            user,
            role,
            isAdmin: role === 'admin',
            loading,
            login,
            logout,
            offlineUpdates,
            showOfflineUpdates,
            dismissOfflineUpdates
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    return useContext(AuthContext);
} 