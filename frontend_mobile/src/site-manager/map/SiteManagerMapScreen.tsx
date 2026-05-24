import React from "react";
import { View, Text, StyleSheet, Image, TouchableOpacity, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { fonts, lightTheme, darkTheme } from "../../theme";

const { width } = Dimensions.get("window");

export function SiteManagerMapScreen({ isDarkMode }: { isDarkMode?: boolean }) {
  const theme = isDarkMode ? darkTheme : lightTheme;
  const styles = getStyles(theme);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Regional Site Map</Text>
        <Text style={styles.subtitle}>Live monitoring of active shelters and supply routes.</Text>
      </View>

      <View style={styles.mapContainer}>
        <Image 
          source={{ uri: "https://lh3.googleusercontent.com/aida-public/AB6AXuB3K_4K9H0L_9E_9N_K7L9B8v8V-p_H_p7h-v8r-B7v-v8r-B7v-v8r-B7v-v8r-B7v-v8r-B7v-v8r-B7v-v8r-B7v-v8r-B7v-v8r-B7v-v8r-B7v-v8r-B7v-v8r-B7v-v8r-B7v-v8r-B7v" }} 
          style={styles.mapImage}
          resizeMode="cover"
        />

        {/* Telemetry Overlay */}
        <View style={styles.telemetryCard}>
          <Text style={styles.telemetryLabel}>LIVE TELEMETRY</Text>
          <View style={styles.telemetryRow}>
            <Text style={styles.telemetryKey}>Active Shelters</Text>
            <Text style={[styles.telemetryValue, { color: "#81C784" }]}>14 Locations</Text>
          </View>
          <View style={styles.telemetryRow}>
            <Text style={styles.telemetryKey}>Total Pop.</Text>
            <Text style={styles.telemetryValue}>2,842 pax</Text>
          </View>
        </View>

        {/* Map Marker */}
        <View style={styles.markerContainer}>
           <View style={styles.markerCircle}>
              <Ionicons name="home" size={20} color="#fff" />
           </View>
        </View>

        {/* Map Controls */}
        <View style={styles.controlsContainer}>
           <TouchableOpacity style={styles.controlBtn}>
              <Ionicons name="add" size={24} color={theme.text} />
           </TouchableOpacity>
           <TouchableOpacity style={styles.controlBtn}>
              <Ionicons name="remove" size={24} color={theme.text} />
           </TouchableOpacity>
           <TouchableOpacity style={[styles.controlBtn, { backgroundColor: "#81C784" }]}>
              <Ionicons name="locate" size={24} color="#fff" />
           </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg, padding: 24 },
  header: { marginBottom: 24 },
  title: { fontSize: 32, ...fonts.black, color: theme.text, letterSpacing: -1 },
  subtitle: { fontSize: 14, ...fonts.medium, color: theme.textMuted, marginTop: 4 },

  mapContainer: { 
    flex: 1, 
    borderRadius: 40, 
    overflow: "hidden", 
    backgroundColor: theme.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.line,
    marginBottom: 80, // Space for bottom nav
  },
  mapImage: { width: "100%", height: "100%", opacity: 0.9 },

  telemetryCard: { 
    position: "absolute", 
    top: 24, 
    left: 24, 
    backgroundColor: "#fff", 
    padding: 16, 
    borderRadius: 20, 
    width: 180,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  telemetryLabel: { fontSize: 10, ...fonts.black, color: theme.textLight, letterSpacing: 1, marginBottom: 12 },
  telemetryRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  telemetryKey: { fontSize: 12, ...fonts.medium, color: theme.textMuted },
  telemetryValue: { fontSize: 12, ...fonts.black, color: theme.text },

  markerContainer: { 
    position: "absolute", 
    top: "50%", 
    left: "50%", 
    transform: [{ translateX: -20 }, { translateY: -20 }] 
  },
  markerCircle: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    backgroundColor: "#81C784", 
    alignItems: "center", 
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#81C784",
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },

  controlsContainer: { 
    position: "absolute", 
    bottom: 24, 
    right: 24, 
    gap: 12 
  },
  controlBtn: { 
    width: 56, 
    height: 56, 
    borderRadius: 16, 
    backgroundColor: "#fff", 
    alignItems: "center", 
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
});
