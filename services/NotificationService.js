import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { auth, db } from '../config/firebase';
import { doc, updateDoc, getDoc } from 'firebase/firestore';

// Configurare notificări
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

export const NotificationService = {
    // Inițializare notificări
    async init() {
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            console.log('Permisiune pentru notificări refuzată!');
            return false;
        }

        // Obținem token-ul pentru notificări
        const token = await Notifications.getExpoPushTokenAsync({
            projectId: 'hikelinkapp', // ID-ul proiectului tău Expo
        });

        // Salvăm token-ul în Firestore
        if (auth.currentUser) {
            await updateDoc(doc(db, 'users', auth.currentUser.uid), {
                pushToken: token.data,
            });
        }

        return true;
    },

    // Trimite notificare pentru cerere de prietenie
    async sendFriendRequestNotification(userId, senderName) {
        try {
            // Obținem token-ul utilizatorului care primește notificarea
            const userDoc = await getDoc(doc(db, 'users', userId));
            const pushToken = userDoc.data()?.pushToken;

            if (!pushToken) {
                console.log('Utilizatorul nu are token pentru notificări');
                return;
            }

            // Trimitem notificarea
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: 'Cerere de prietenie nouă',
                    body: `${senderName} vrea să fie prietenul tău`,
                    data: { type: 'friend_request', userId: auth.currentUser.uid },
                },
                trigger: null, // Notificare imediată
            });
        } catch (error) {
            console.error('Eroare la trimiterea notificării:', error);
        }
    },

    // Funcție de test pentru notificări
    async sendTestNotification() {
        try {
            await Notifications.scheduleNotificationAsync({
                content: {
                    title: 'Test Notificare',
                    body: 'Aceasta este o notificare de test!',
                    data: { type: 'test' },
                },
                trigger: null, // Notificare imediată
            });
            console.log('Notificare de test trimisă cu succes!');
        } catch (error) {
            console.error('Eroare la trimiterea notificării de test:', error);
        }
    },

    // Ascultă pentru notificări
    addNotificationListener(callback) {
        return Notifications.addNotificationReceivedListener(callback);
    },

    // Ascultă pentru acțiuni pe notificări
    addNotificationResponseListener(callback) {
        return Notifications.addNotificationResponseReceivedListener(callback);
    },
}; 