import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Dimensions,
  Image,
  Alert,
  Platform,
  TextInput,
  Modal,
} from 'react-native';
import MapView, { PROVIDER_GOOGLE, Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
import { StatusBar } from 'expo-status-bar';
import Svg, { Polyline as SvgPolyline } from 'react-native-svg';
import { auth } from '../config/firebase';
import { signOut } from 'firebase/auth';
import { db } from '../config/firebase';
import { collection, addDoc, updateDoc } from 'firebase/firestore';
import polyline from '@mapbox/polyline';
import { GOOGLE_API_KEY } from '../config/config';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';




function encodeRoute(coords) {
  // coords = [ { latitude, longitude }, { latitude, longitude }, ... ]
  const latLngArray = coords.map((p) => [p.latitude, p.longitude]);
  return polyline.encode(latLngArray);
}

function buildStaticMapUrl(encodedPolyline, googleApiKey) {
  // Ex: https://maps.googleapis.com/maps/api/staticmap?size=400x400&path=enc:<poly>&key=...
  return `https://maps.googleapis.com/maps/api/staticmap?size=400x400&path=enc:${encodedPolyline}&key=${googleApiKey}`;
}


//#6
async function uploadToCloudinary(staticMapUrl) {
  console.log('[Cloudinary] Attempt upload, staticMapUrl:', staticMapUrl);

  const CLOUD_NAME = 'dludchtxw';
  const UPLOAD_PRESET = 'unsigned_preset';

  try {
    const response = await fetch(staticMapUrl);
    const blob = await response.blob();

    console.log('[Cloudinary] Blob created, size:', blob.size);

    const formData = new FormData();
    formData.append('file', {
      uri: staticMapUrl,
      type: 'image/png',
      name: 'map.png',
    });
    formData.append('upload_preset', UPLOAD_PRESET);

    console.log('[Cloudinary] FormData constructed');

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


async function testUploadToImgur() {
  // Pasul 1: Client ID de la Imgur (din screenshot-ul tău):
  const IMGUR_CLIENT_ID = '8d55ff16fa3d572'; // exemplu din screenshot

  try {
    // Pasul 2: Descarcă o imagine dummy (mică)
    const testImageUrl = 'https://via.placeholder.com/150';
    const r = await fetch(testImageUrl);
    const b = await r.blob();

    // Pasul 3: Construiește formData
    const formData = new FormData();
    formData.append('image', b, 'test.jpg');
    // "image" e param. cerut de Imgur
    // 'test.jpg' e un nume generic

    // Pasul 4: Trimite upload-ul la Imgur
    const resp = await fetch('https://api.imgur.com/3/image', {
      method: 'POST',
      headers: {
        // Cheia Client-ID
        'Authorization': 'Client-ID ' + IMGUR_CLIENT_ID,
      },
      body: formData,
    });

    const data = await resp.json();
    console.log('[testUploadToImgur] response data:', data);

    if (data.success) {
      // DACA reuseste: data.data.link contine link-ul la imagine
      console.log('Imgur link:', data.data.link);
    } else {
      console.log('Imgur upload not successful:', data);
    }
  } catch (err) {
    console.log('[testUploadToImgur] error:', err);
  }
}


export default function ExploreScreen({ navigation }) {
  const { isDarkMode, toggleDarkMode, colors } = useTheme();
  const { offlineUpdates, showOfflineUpdates, dismissOfflineUpdates } = useAuth();
  const [location, setLocation] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [region, setRegion] = useState(null);
  const [trails, setTrails] = useState([]);
  const windowHeight = Dimensions.get('window').height;

  // For selected trail and route
  const [selectedTrail, setSelectedTrail] = useState(null);
  const [routeCoords, setRouteCoords] = useState([]);

  // Timing and stats
  const [elapsedTime, setElapsedTime] = useState(0);
  const timer = useRef(null);
  const [speed, setSpeed] = useState(0);
  const [distance, setDistance] = useState(0);
  const previousLocation = useRef(null);

  const apiKey = GOOGLE_API_KEY;

  const mapRef = useRef(null);
  const defaultRegion = {
    latitude: 44.4268,
    longitude: 26.1025,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  };

  const [isSearchModalVisible, setIsSearchModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredTrails, setFilteredTrails] = useState([]);

  const flatListRef = useRef(null);

  // Track auth changes (optional logging)
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        console.log('User is signed in:', user.uid);
      } else {
        console.log('No user is signed in');
      }
    });
    return () => unsubscribe();
  }, []);

  // Request location and watch user position #1
  useEffect(() => {
    let locationSubscription;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }

      // Obținem locația inițială pentru centrarea hărții
      const initialLocation = await Location.getCurrentPositionAsync({});
      setLocation(initialLocation);
      setRegion({
        latitude: initialLocation.coords.latitude,
        longitude: initialLocation.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });

      locationSubscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 1000,
          distanceInterval: 1,
        },
        (loc) => {
          setLocation(loc);

          if (isTracking) {
            setRegion({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            });
          }

          // Update speed doar dacă tracking-ul este activ
          if (isTracking && loc.coords.speed !== null) {
            const speedInKmH = loc.coords.speed * 3.6;
            setSpeed(speedInKmH >= 0 ? speedInKmH.toFixed(2) : "0.00");
          }

          // Update distance
          if (isTracking && previousLocation.current) {
            const newDistance = getDistanceFromLatLonInKm(
              previousLocation.current.latitude,
              previousLocation.current.longitude,
              loc.coords.latitude,
              loc.coords.longitude
            );
            setDistance((prevDistance) => prevDistance + newDistance);
          }
          previousLocation.current = loc.coords;

          // Fetch trails each update (you may want to throttle)
          fetchTrails(loc.coords.latitude, loc.coords.longitude);
        }
      );
    })();

    return () => {
      if (locationSubscription) {
        locationSubscription.remove();
      }
      clearInterval(timer.current);
    };
  }, []);

  // Fetch trails from Google Places #2
  const fetchTrails = async (latitude, longitude) => {
    const radius = 200000;
    const keyword = 'hiking trail';
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&radius=${radius}&keyword=${keyword}&key=${apiKey}`;

    try {
      const response = await fetch(url);
      const data = await response.json();
      if (data.results) {
        setTrails(data.results || []);
      }
    } catch (error) {
      console.error('Error fetching hiking trails:', error);
    }
  };

  // Save activity to Firestore #5
  const saveActivity = async (activity) => {
    try {
      if (!auth.currentUser) {
        console.error('User not authenticated');
        Alert.alert('Error', 'You must be logged in to save activities.');
        return;
      }

      let imageUrl = null;
      let activityWithUserId = {
        ...activity,
        userId: auth.currentUser.uid,
      };

      // Salvăm mai întâi activitatea fără imagine
      console.log('Saving activity without image first...');
      const docRef = await addDoc(collection(db, 'activities'), activityWithUserId);
      console.log('Activity saved successfully without image');

      // Încercăm să adăugăm imaginea separat
      if (routeCoords && routeCoords.length > 1) {
        try {
          console.log('Starting image upload process...');
          const encodedRoute = encodeRoute(routeCoords);
          const staticMapUrl = buildStaticMapUrl(encodedRoute, apiKey);

          console.log('Uploading to Cloudinary...');
          imageUrl = await uploadToCloudinary(staticMapUrl);
          console.log('Image uploaded successfully:', imageUrl);

          // Actualizăm documentul cu URL-ul imaginii
          if (imageUrl) {
            await updateDoc(docRef, { imageUrl: imageUrl });
            console.log('Activity updated with image URL');
          }
        } catch (err) {
          console.error('Error in image upload process:', err);
          // Continuăm chiar dacă upload-ul imaginii eșuează
          // Activitatea este deja salvată, doar fără imagine
        }
      }

      return true; // Returnăm true pentru a indica succesul
    } catch (error) {
      console.error('Error saving activity:', error);
      Alert.alert('Error', 'Failed to save activity. Please try again.');
      return false;
    }
  };

  // Format time in mm:ss
  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Handle selecting a trail
  const handleTrailSelection = (trail) => {
    if (
      trail &&
      trail.geometry &&
      trail.geometry.location &&
      typeof trail.geometry.location.lat === 'number' &&
      typeof trail.geometry.location.lng === 'number'
    ) {
      setSelectedTrail(trail);
    } else {
      console.error('Invalid trail data:', trail);
      Alert.alert('Error', 'Invalid trail data. Please select another trail.');
    }
  };

  // Toggle tracking (start/stop)
  const toggleTracking = async () => {
    if (isTracking) {
      // ---------- STOP ----------
      // Oprim mai întâi tracking-ul
      setIsTracking(false);

      try {
        // Oprim timer-ul
        if (timer.current) {
          clearInterval(timer.current);
          timer.current = null;
        }

        // Verificăm dacă avem date valide pentru salvare
        if (!selectedTrail || !auth.currentUser) {
          console.log('No trail or user data to save');
          resetStates();
          return;
        }

        // Construim obiectul activity
        const activity = {
          trailName: selectedTrail.name || 'Unknown Trail',
          distance: distance.toFixed(2),
          elapsedTime: formatTime(elapsedTime),
          date: new Date().toISOString().split('T')[0],
        };

        // Încercăm să salvăm activitatea
        try {
          const saved = await saveActivity(activity);
          if (saved) {
            Alert.alert('Success', 'Activity saved successfully!');
          }
        } catch (err) {
          console.error('Error saving activity:', err);
          Alert.alert('Warning', 'Could not save activity, but tracking was stopped.');
        }

        // Resetăm stările la final
        resetStates();

      } catch (error) {
        console.error('Error in stop tracking:', error);
        Alert.alert('Error', 'An error occurred while stopping tracking.');
        resetStates();
      }
    } else {
      // --- START ---
      if (!selectedTrail) {
        Alert.alert('Error', 'Please select a trail before starting.');
        return;
      }

      try {
        await getDirections(selectedTrail.geometry.location);
        timer.current = setInterval(() => {
          setElapsedTime((prevTime) => prevTime + 1);
        }, 1000);
        setIsTracking(true);
      } catch (error) {
        console.error('Error starting tracking:', error);
        Alert.alert('Error', 'Could not start tracking. Please try again.');
      }
    }
  };

  // Funcție separată pentru resetarea stărilor
  const resetStates = () => {
    setElapsedTime(0);
    setSpeed(0);
    setDistance(0);
    previousLocation.current = null;
    setRouteCoords([]);
    setSelectedTrail(null);
  };

  // Logout user
  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigation.reset({
        index: 0,
        routes: [{ name: 'Auth' }],
      });
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Google Directions fetch #3
  const getDirections = async (destination) => {
    if (!location) {
      Alert.alert('Error', 'Location is not available. Check location permissions.');
      return;
    }
    if (!destination || !destination.lat || !destination.lng) {
      Alert.alert('Error', 'Invalid destination selected. Please select a valid trail.');
      return;
    }

    const origin = `${location.coords.latitude},${location.coords.longitude}`;
    const dest = `${destination.lat},${destination.lng}`;

    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${dest}&mode=walking&key=${apiKey}`
      );
      const data = await response.json();

      if (
        data.routes &&
        data.routes.length > 0 &&
        data.routes[0].overview_polyline &&
        data.routes[0].overview_polyline.points
      ) {
        const decodedPoints = decodePolyline(data.routes?.[0]?.overview_polyline?.points || '');
        if (decodedPoints.length < 2) {
          Alert.alert('Error', 'Could not create a route. Please try another trail.');
          return;
        }
        setRouteCoords(decodedPoints);
      } else {
        Alert.alert('No Route Found', 'Could not find a route to this trail. Try another trail.');
        setRouteCoords([]);
      }
    } catch (error) {
      console.error('Error fetching directions:', error);
      Alert.alert('Error', 'Failed to fetch directions. Check your internet connection.');
    }
  };

  // Polyline decoder #4
  const decodePolyline = (poly) => {
    if (!poly || typeof poly !== 'string') {
      return [];
    }
    let points = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < poly.length) {
      let b, shift = 0,
        result = 0;
      do {
        b = poly.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      let dlat = result & 1 ? ~(result >> 1) : result >> 1;
      lat += dlat;

      shift = result = 0;
      do {
        b = poly.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      let dlng = result & 1 ? ~(result >> 1) : result >> 1;
      lng += dlng;

      points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
    }
    return points;
  };

  // Distance calc 
  const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const deg2rad = (deg) => deg * (Math.PI / 180);

  // Convert route coords to SVG
  const convertToSvgPoints = (coords, region, width, height) => {
    if (!coords || coords.length < 2 || !region) {
      return '';
    }
    try {
      return coords
        .map((point) => {
          if (!point || typeof point.latitude !== 'number' || typeof point.longitude !== 'number') {
            return null;
          }
          const x = ((point.longitude - region.longitude) / region.longitudeDelta) * width;
          const y = ((region.latitude - point.latitude) / region.latitudeDelta) * height;
          return `${x},${y}`;
        })
        .filter((pt) => pt !== null)
        .join(' ');
    } catch (error) {
      console.error('Error in convertToSvgPoints:', error);
      return '';
    }
  };

  const centerOnUser = () => {
    if (location) {
      mapRef.current?.animateToRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 1000);
    }
  };

  const handleTrailItemPress = (trail) => {
    // Selectăm trail-ul
    handleTrailSelection(trail);

    // Centrăm harta pe locația trail-ului
    if (mapRef.current && trail.geometry?.location) {
      mapRef.current.animateToRegion({
        latitude: trail.geometry.location.lat,
        longitude: trail.geometry.location.lng,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 1000);
    }

    // Găsim indexul trail-ului în lista de trail-uri
    const trailIndex = trails.findIndex(t => t.place_id === trail.place_id);
    if (trailIndex !== -1 && flatListRef.current) {
      // Facem scroll la trail-ul selectat
      flatListRef.current.scrollToIndex({
        index: trailIndex,
        animated: true,
        viewPosition: 0.5
      });
    }
  };

  // Filter trails based on search query 
  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredTrails(trails);
    } else {
      const filtered = trails.filter(trail =>
        trail.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredTrails(filtered);
    }
  }, [searchQuery, trails]);

  const handleTrailSelect = (trail) => {
    setIsSearchModalVisible(false);
    handleTrailItemPress(trail);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDarkMode ? "light" : "dark"} />
      <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />

      {/* Center on User Button */}
      <TouchableOpacity
        style={[styles.centerButton, { backgroundColor: colors.background }]}
        onPress={centerOnUser}
      >
        <Text style={styles.centerButtonText}>📍</Text>
      </TouchableOpacity>

      {/* Stats (Speed, Time, Distance) */}
      <View style={[styles.statsContainer, { backgroundColor: colors.background }]}>
        <View style={styles.stat}>
          <Text style={[styles.statLabel, { color: colors.text }]}>Speed</Text>
          <Text style={[styles.statValue, { color: colors.text }]}>{speed}</Text>
          <Text style={[styles.unitLabel, { color: colors.text }]}>km/h</Text>
        </View>
        <View style={styles.statCenter}>
          <Text style={[styles.statLabel, { color: colors.text }]}>Time</Text>
          <Text style={[styles.statValue, { color: colors.text }]}>{formatTime(elapsedTime)}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={[styles.statLabel, { color: colors.text }]}>Distance</Text>
          <Text style={[styles.statValue, { color: colors.text }]}>{distance.toFixed(2)}</Text>
          <Text style={[styles.unitLabel, { color: colors.text }]}>km</Text>
        </View>
      </View>

      {/* Start/Stop Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[
            isTracking ? styles.stopButton : styles.startButton,
            { backgroundColor: isTracking ? '#FF0000' : colors.primary }
          ]}
          onPress={toggleTracking}
        >
          <Text style={styles.buttonText}>{isTracking ? 'Stop' : 'Start'}</Text>
        </TouchableOpacity>
      </View>

      {/* Map */}
      <View style={styles.shadowContainer}>
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={[styles.map, { height: windowHeight * 0.4 }]}
            initialRegion={region || defaultRegion}
            region={null}
            showsUserLocation
            followsUserLocation={isTracking}
            showsMyLocationButton={true}
            onRegionChangeComplete={setRegion}
            toolbarEnabled={false}
            moveOnMarkerPress={false}
            pitchEnabled={false}
            rotateEnabled={false}
            zoomEnabled={true}
            scrollEnabled={true}
            onPress={() => {
              if (routeCoords.length > 0) {
                setSelectedTrail(null);
                setRouteCoords([]);
              }
            }}
          >
            {trails.map((trail, index) => (
              trail.geometry?.location && (
                <Marker
                  key={`marker-${trail.place_id || index}`}
                  coordinate={{
                    latitude: trail.geometry.location.lat,
                    longitude: trail.geometry.location.lng,
                  }}
                  onPress={() => handleTrailItemPress(trail)}
                />
              )
            ))}

            {selectedTrail && routeCoords.length > 1 && (
              <Polyline
                coordinates={routeCoords}
                strokeColor="#007AFF"
                strokeWidth={6}
                geodesic
              />
            )}
          </MapView>
        </View>
      </View>

      {/* Trails List */}
      <View style={styles.trailsContainer}>
        <View style={styles.trailsHeader}>
          <Text style={[styles.trailsTitle, { color: colors.text }]}>Hiking trails near you</Text>
          <TouchableOpacity
            style={[styles.searchButton, { backgroundColor: colors.primary }]}
            onPress={() => setIsSearchModalVisible(true)}
          >
            <Text style={styles.searchButtonText}>🔍</Text>
          </TouchableOpacity>
        </View>
        <FlatList
          ref={flatListRef}
          data={trails}
          horizontal
          keyExtractor={(item) => item.place_id.toString()}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.trailItem,
                selectedTrail?.place_id === item.place_id && [styles.selectedTrailItem, { backgroundColor: colors.secondary }]
              ]}
              onPress={() => handleTrailItemPress(item)}
            >
              <Text style={[
                styles.trailName,
                { color: colors.text },
                selectedTrail?.place_id === item.place_id && { color: colors.primary }
              ]}>
                {item.name.split(' ').slice(0, 3).join(' ')}
              </Text>
              {item.photos ? (
                <Image
                  source={{
                    uri: `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${item.photos[0].photo_reference}&key=${apiKey}`,
                  }}
                  style={[
                    styles.trailImage,
                    selectedTrail?.place_id === item.place_id && [styles.selectedTrailImage, { borderColor: colors.primary }]
                  ]}
                />
              ) : (
                <View style={[
                  styles.noImagePlaceholder,
                  { backgroundColor: colors.secondary },
                  selectedTrail?.place_id === item.place_id && [styles.selectedTrailImage, { borderColor: colors.primary }]
                ]}>
                  <Text style={[styles.noImageText, { color: colors.secondaryText }]}>No Image</Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Search Modal */}
      <Modal
        visible={isSearchModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsSearchModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Search Trails</Text>
              <TouchableOpacity
                style={[styles.closeButton, { backgroundColor: colors.secondary }]}
                onPress={() => setIsSearchModalVisible(false)}
              >
                <Text style={[styles.closeButtonText, { color: colors.text }]}>✕</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.modalSearchInput, {
                backgroundColor: colors.secondary,
                color: colors.text,
                borderColor: colors.border
              }]}
              placeholder="Search trails..."
              placeholderTextColor={colors.secondaryText}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            <FlatList
              data={filteredTrails}
              keyExtractor={(item) => item.place_id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.modalTrailItem, { borderBottomColor: colors.border }]}
                  onPress={() => handleTrailSelect(item)}
                >
                  <Text style={[styles.modalTrailName, { color: colors.text }]}>{item.name}</Text>
                  {item.photos && (
                    <Image
                      source={{
                        uri: `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${item.photos[0].photo_reference}&key=${apiKey}`,
                      }}
                      style={styles.modalTrailImage}
                    />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ----- Styles -----
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingTop: StatusBar.currentHeight || 20,
  },
  dividerLine: {
    position: 'absolute',
    top: 35,
    width: '100%',
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    position: 'absolute',
    top: 80,
    left: 0,
    right: 0,
    backgroundColor: '#000000',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 15,
    marginHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statCenter: {
    alignItems: 'center',
    marginLeft: 12,
  },
  stat: {
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  unitLabel: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  buttonContainer: {
    alignItems: 'center',
    marginTop: 125,
    marginBottom: 20,
  },
  startButton: {
    paddingVertical: 10,
    paddingHorizontal: 40,
    borderRadius: 20,
  },
  stopButton: {
    paddingVertical: 10,
    paddingHorizontal: 40,
    borderRadius: 20,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  shadowContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    marginBottom: -15,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  mapContainer: {
    backgroundColor: 'white',
    borderRadius: 10,
    marginBottom: -15,
    paddingBottom: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 6,
  },
  map: {
    width: '100%',
    height: Dimensions.get('window').height * 0.35,
    borderRadius: 10,
  },
  trailsContainer: {
    paddingHorizontal: 20,
    marginTop: 40,
    marginBottom: 20,
  },
  trailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    marginTop: 10,
  },
  trailsTitle: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  trailItem: {
    padding: 10,
    alignItems: 'center',
    borderRadius: 10,
    marginRight: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedTrailItem: {
    borderColor: '#556B2F',
    backgroundColor: '#F0F4E8',
  },
  trailName: {
    fontSize: 14,
    color: '#333',
    fontWeight: 'bold',
    marginTop: 5,
    textAlign: 'center',
  },
  selectedTrailName: {
    color: '#556B2F',
  },
  trailImage: {
    width: 130,
    height: 130,
    borderRadius: 15,
    marginBottom: 5,
  },
  selectedTrailImage: {
    borderWidth: 2,
    borderColor: '#556B2F',
  },
  noImagePlaceholder: {
    width: 130,
    height: 130,
    borderRadius: 15,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 5,
  },
  noImageText: {
    color: '#888',
    fontSize: 12,
  },
  centerButton: {
    position: 'absolute',
    right: 20,
    bottom: 360,
    backgroundColor: 'white',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 999,
  },
  centerButtonText: {
    fontSize: 20,
  },
  searchButton: {
    backgroundColor: '#556B2F',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  searchButtonText: {
    fontSize: 20,
    color: 'white',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    height: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#333',
  },
  modalSearchInput: {
    backgroundColor: '#f0f0f0',
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
    marginBottom: 20,
  },
  modalTrailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTrailName: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginRight: 10,
  },
  modalTrailImage: {
    width: 60,
    height: 60,
    borderRadius: 10,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});
