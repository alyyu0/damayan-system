// Web fallback — react-native-maps is native-only.
// Metro resolves CitizenLiveMap.native.tsx on iOS/Android and this file on web.
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export interface EvacCenter {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  status: "Open" | "Full" | "Closed";
}

export interface CitizenLiveMapProps {
  mode: "shelter_select" | "navigate";
  userLocation: { latitude: number; longitude: number } | null;
  evacCenters: EvacCenter[];
  selectedCenter: EvacCenter;
  onCenterSelect?: (center: EvacCenter) => void;
}

export function CitizenLiveMap({ mode, userLocation, selectedCenter }: CitizenLiveMapProps) {
  return (
    <View style={styles.container}>
      <Ionicons name="map-outline" size={32} color="#81C784" />
      <Text style={styles.label}>
        {mode === "navigate"
          ? `Navigating to ${selectedCenter.name}`
          : "Interactive map available on mobile"}
      </Text>
      {userLocation && (
        <Text style={styles.coords}>
          {userLocation.latitude.toFixed(5)}° N,{" "}
          {userLocation.longitude.toFixed(5)}° E
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 200,
    borderRadius: 24,
    backgroundColor: "#F1F8E9",
    borderWidth: 1,
    borderColor: "#C8E6C9",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2E7D32",
    textAlign: "center",
  },
  coords: {
    fontSize: 12,
    color: "#558B2F",
    textAlign: "center",
  },
});
