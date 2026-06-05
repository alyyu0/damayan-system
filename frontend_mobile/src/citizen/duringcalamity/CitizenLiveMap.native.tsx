import React from "react";
import { View, StyleSheet } from "react-native";
import MapView, { Marker, Polyline } from "react-native-maps";

const SHELTER_SELECTED = "#0F4C81";
const SHELTER_UNSELECTED = "#7D867B";
const ROUTE_COLOR = "#0F4C81";

export interface EvacCenter {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  status: string;
  capacity?: number;
  currentOccupancy?: number;
}

export interface CitizenLiveMapProps {
  mode: "shelter_select" | "navigate";
  userLocation: { latitude: number; longitude: number } | null;
  evacCenters: EvacCenter[];
  selectedCenter: EvacCenter;
  onCenterSelect?: (center: EvacCenter) => void;
  routeCoords?: Array<{ latitude: number; longitude: number }>;
}

function midpointRegion(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
) {
  const latDelta = Math.max(Math.abs(a.latitude - b.latitude) * 3, 0.015);
  const lngDelta = Math.max(Math.abs(a.longitude - b.longitude) * 3, 0.015);
  return {
    latitude: (a.latitude + b.latitude) / 2,
    longitude: (a.longitude + b.longitude) / 2,
    latitudeDelta: latDelta,
    longitudeDelta: lngDelta,
  };
}

function getCapacityLabel(center: EvacCenter): string | null {
  if (center.capacity === undefined || center.currentOccupancy === undefined) return null;
  return `${center.currentOccupancy}/${center.capacity} occupied`;
}

function getMarkerDescription(center: EvacCenter): string {
  const capacity = getCapacityLabel(center);
  return capacity ? `${center.status} | ${capacity}` : center.status;
}

export function CitizenLiveMap({
  mode,
  userLocation,
  evacCenters,
  selectedCenter,
  onCenterSelect,
  routeCoords,
}: CitizenLiveMapProps) {
  const fallbackCoord = { latitude: 14.5995, longitude: 120.9842 };

  const region =
    userLocation && (mode === "navigate" || (routeCoords && routeCoords.length > 1))
      ? midpointRegion(userLocation, {
          latitude: selectedCenter.latitude,
          longitude: selectedCenter.longitude,
        })
      : {
          latitude: userLocation?.latitude ?? fallbackCoord.latitude,
          longitude: userLocation?.longitude ?? fallbackCoord.longitude,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        };

  return (
    <MapView
      key={`${mode}-${selectedCenter.id}-${routeCoords?.length ?? 0}`}
      style={styles.map}
      initialRegion={region}
      showsUserLocation
      showsMyLocationButton={mode === "shelter_select"}
      pitchEnabled={false}
      scrollEnabled
    >
      {/* Blue device dot */}
      {userLocation && (
        <Marker coordinate={userLocation} anchor={{ x: 0.5, y: 0.5 }} title="You">
          <View style={styles.deviceDot} />
        </Marker>
      )}

      {mode === "shelter_select" &&
        evacCenters.map((center) => {
          const isSelected = selectedCenter.id === center.id;
          return isSelected ? (
            <Marker
              key={center.id}
              coordinate={{ latitude: center.latitude, longitude: center.longitude }}
              title={center.name}
              description={getMarkerDescription(center)}
              onPress={() => onCenterSelect?.(center)}
            >
              <View style={styles.selectedPinWrap}>
                <View style={styles.selectedPinGlow} />
                <View style={styles.selectedPin}>
                  <View style={styles.selectedPinCore} />
                </View>
              </View>
            </Marker>
          ) : (
            <Marker
              key={center.id}
              coordinate={{ latitude: center.latitude, longitude: center.longitude }}
              title={center.name}
              description={getMarkerDescription(center)}
              pinColor={SHELTER_UNSELECTED}
              onPress={() => onCenterSelect?.(center)}
            />
          );
        })}

      {mode === "shelter_select" && userLocation && routeCoords && routeCoords.length > 1 && (
        <Polyline
          coordinates={routeCoords}
          strokeColor={ROUTE_COLOR}
          strokeWidth={3}
        />
      )}

      {mode === "navigate" && (
        <>
          <Marker
            coordinate={{ latitude: selectedCenter.latitude, longitude: selectedCenter.longitude }}
            title={selectedCenter.name}
            description={getMarkerDescription(selectedCenter)}
          >
            <View style={styles.selectedPinWrap}>
              <View style={styles.selectedPinGlow} />
              <View style={styles.selectedPin}>
                <View style={styles.selectedPinCore} />
              </View>
            </View>
          </Marker>
          {userLocation && (
            <Polyline
              coordinates={
                routeCoords && routeCoords.length > 1
                  ? routeCoords
                  : [userLocation, { latitude: selectedCenter.latitude, longitude: selectedCenter.longitude }]
              }
              strokeColor={ROUTE_COLOR}
              strokeWidth={3}
              lineDashPattern={routeCoords && routeCoords.length > 1 ? undefined : [8, 4]}
            />
          )}
        </>
      )}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    height: 260,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
  deviceDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#2563EB",
    borderWidth: 2.5,
    borderColor: "#fff",
  },
  selectedPinWrap: {
    width: 40,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  selectedPinGlow: {
    position: "absolute",
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(15, 76, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(15, 76, 129, 0.22)",
  },
  selectedPin: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: SHELTER_SELECTED,
    borderWidth: 3,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  selectedPinCore: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#fff",
  },
});
