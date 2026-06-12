import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StatusBar as RNStatusBar, StyleSheet, Text, View } from "react-native";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import { fonts, theme } from "../theme";
import { getActiveDisasterEvents, getCapacity, type AppNotification } from "../api";
import type { DisasterEvent, CapacityCenter } from "../types";
import { manhattanDistanceMeters, manhattanRouteCoords, sortByManhattanDistance } from "../utils/geoUtils";
import { CitizenLiveMap, type EvacCenter } from "./duringcalamity/CitizenLiveMap";
import type { Phase } from "./CitizenDashboardScreen";

type MapLayer = {
  id: string;
  label: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  color: string;
  count: number;
};

interface CitizenSafetyMapScreenProps {
  readonly phase: Phase;
  readonly session?: any;
  readonly notifications?: AppNotification[];
  readonly onBack: () => void;
  readonly onReportIncident?: () => void;
}

const FALLBACK_CENTERS: EvacCenter[] = [
  { id: "fallback-1", name: "Barangay Hall Evacuation Center", latitude: 14.602, longitude: 120.985, status: "Open", capacity: 120, currentOccupancy: 42 },
  { id: "fallback-2", name: "Elementary School Shelter", latitude: 14.5975, longitude: 120.987, status: "Open", capacity: 220, currentOccupancy: 85 },
  { id: "fallback-3", name: "City Relief Operations Point", latitude: 14.5942, longitude: 120.977, status: "Standby", capacity: 180, currentOccupancy: 60 },
];

const SHELTER_ACCENT = "#0F4C81";
const SHELTER_ACCENT_SOFT = "rgba(15, 76, 129, 0.08)";
const SHELTER_ACCENT_LINE = "rgba(15, 76, 129, 0.28)";

const PHASE_COPY: Record<Phase, { title: string; subtitle: string; question: string; color: string }> = {
  before: {
    title: "Preparedness Map",
    subtitle: "Hazard zones, evacuation centers, and safe routes.",
    question: "Am I prepared?",
    color: theme.primary,
  },
  during: {
    title: "Live Safety Map",
    subtitle: "Active incidents, danger areas, rescue requests, blocked roads, and open shelters.",
    question: "Where do I go and how do I get help?",
    color: theme.danger,
  },
  after: {
    title: "Recovery Map",
    subtitle: "Damaged areas, relief points, cleanup zones, and service restoration updates.",
    question: "How do I recover and receive assistance?",
    color: theme.info,
  },
};

const STATUS_BAR_HEIGHT = Platform.OS === "android" ? (RNStatusBar.currentHeight ?? 24) : 44;

function capacityCenterToEvacCenter(center: CapacityCenter): EvacCenter {
  return {
    id: center.id,
    name: center.name,
    latitude: center.latitude ?? 0,
    longitude: center.longitude ?? 0,
    status: center.status ?? "Open",
    capacity: center.capacity,
    currentOccupancy: center.currentOccupancy,
  };
}

function getCenterKey(center: EvacCenter): string {
  const name = center.name.trim().toLowerCase();
  if (name) return name;
  const lat = Number.isFinite(center.latitude) ? center.latitude.toFixed(5) : "0";
  const lng = Number.isFinite(center.longitude) ? center.longitude.toFixed(5) : "0";
  return `${lat}|${lng}`;
}

function uniqueEvacCenters(centers: EvacCenter[]): EvacCenter[] {
  const seen = new Set<string>();
  return centers.filter((center) => {
    const key = getCenterKey(center);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatCapacity(center: EvacCenter): string | null {
  if (center.capacity === undefined || center.currentOccupancy === undefined) return null;
  return `${center.currentOccupancy}/${center.capacity} occupied`;
}

export function CitizenSafetyMapScreen({
  phase,
  session,
  notifications = [],
  onBack,
  onReportIncident,
}: CitizenSafetyMapScreenProps) {
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationDenied, setLocationDenied] = useState(false);
  const [centers, setCenters] = useState<EvacCenter[]>(FALLBACK_CENTERS);
  const [selectedCenter, setSelectedCenter] = useState<EvacCenter>(FALLBACK_CENTERS[0]);
  const [activeEvents, setActiveEvents] = useState<DisasterEvent[]>([]);
  const [loadingCenters, setLoadingCenters] = useState(true);
  const [showRoutePreview, setShowRoutePreview] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (status !== "granted") {
        setLocationDenied(true);
        setLocationLoading(false);
        return;
      }
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!cancelled) {
          setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        }
      } catch {
        if (!cancelled) setLocationDenied(true);
      } finally {
        if (!cancelled) setLocationLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!session?.accessToken) {
      setLoadingCenters(false);
      return;
    }
    let cancelled = false;
    Promise.all([
      getCapacity(session.accessToken).catch(() => []),
      getActiveDisasterEvents(session.accessToken).catch(() => []),
    ]).then(([capacity, events]) => {
      if (cancelled) return;
      const mapped = capacity
        .filter((center) => center.latitude && center.longitude)
        .map(capacityCenterToEvacCenter);
      const unique = uniqueEvacCenters(mapped);
      if (unique.length > 0) {
        setCenters(unique);
      }
      setActiveEvents(events.filter((event) => event.status === "active" || event.status === "DURING"));
    }).finally(() => {
      if (!cancelled) setLoadingCenters(false);
    });
    return () => { cancelled = true; };
  }, [session?.accessToken]);

  const orderedCenters = useMemo(
    () => userLocation ? sortByManhattanDistance(userLocation, centers) : centers,
    [userLocation, centers],
  );

  useEffect(() => {
    setSelectedCenter((current) => orderedCenters.find((center) => center.id === current.id) ?? orderedCenters[0] ?? FALLBACK_CENTERS[0]);
  }, [orderedCenters]);

  const routePreviewCoords = useMemo(
    () => userLocation && phase === "before" && showRoutePreview ? manhattanRouteCoords(userLocation, selectedCenter) : [],
    [phase, showRoutePreview, selectedCenter, userLocation],
  );

  function handleSelectCenter(center: EvacCenter) {
    setSelectedCenter(center);
    if (phase === "before") {
      setShowRoutePreview(true);
    }
  }

  const liveIncidents = notifications.filter((notification) =>
    ["incident", "dispatch_assigned", "system"].includes(notification.type),
  );

  const copy = PHASE_COPY[phase];
  const displayedCenter = selectedCenter ?? orderedCenters[0];
  const distance = userLocation && displayedCenter ? manhattanDistanceMeters(userLocation, displayedCenter) / 1000 : null;

  const layers: MapLayer[] = phase === "before"
    ? [
        { id: "hazards", label: "Hazard zones", icon: "warning-outline", color: theme.warning, count: activeEvents.length || 2 },
        { id: "centers", label: "Evacuation centers", icon: "home-outline", color: theme.primary, count: centers.length },
        { id: "routes", label: "Safe routes", icon: "navigate-outline", color: theme.info, count: centers.length },
      ]
    : phase === "during"
    ? [
        { id: "incidents", label: "Active incidents", icon: "alert-circle-outline", color: theme.danger, count: Math.max(activeEvents.length, liveIncidents.length) },
        { id: "danger", label: "Danger areas", icon: "skull-outline", color: "#8B1A1A", count: activeEvents.length || 1 },
        { id: "rescue", label: "Rescue requests", icon: "medkit-outline", color: theme.warning, count: liveIncidents.length },
        { id: "shelters", label: "Open shelters", icon: "home-outline", color: theme.primary, count: centers.length },
      ]
    : [
        { id: "damage", label: "Damaged areas", icon: "construct-outline", color: theme.warning, count: activeEvents.length || 3 },
        { id: "relief", label: "Relief points", icon: "gift-outline", color: theme.primary, count: centers.length },
        { id: "cleanup", label: "Cleanup zones", icon: "bandage-outline", color: theme.info, count: 2 },
        { id: "services", label: "Service updates", icon: "flash-outline", color: "#6D4C41", count: 4 },
      ];

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <Pressable style={styles.backButton} onPress={onBack}>
          <Ionicons name="arrow-back" size={22} color={theme.text} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.topTitle}>{copy.title}</Text>
          <Text style={styles.topSub}>{copy.question}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.hero, { backgroundColor: copy.color }]}>
          <Text style={styles.heroKicker}>{phase.toUpperCase()} PHASE</Text>
          <Text style={styles.heroTitle}>{copy.title}</Text>
          <Text style={styles.heroSub}>{copy.subtitle}</Text>
        </View>

        {loadingCenters || locationLoading ? (
          <View style={styles.loadingMap}>
            <ActivityIndicator color={copy.color} size="large" />
            <Text style={styles.loadingText}>Preparing safety layers...</Text>
          </View>
        ) : (
          <CitizenLiveMap
            mode="shelter_select"
            userLocation={userLocation}
            evacCenters={orderedCenters}
            selectedCenter={selectedCenter}
            onCenterSelect={handleSelectCenter}
            routeCoords={routePreviewCoords}
          />
        )}

        {locationDenied && (
          <View style={[styles.notice, { borderLeftColor: theme.warning }]}>
            <Ionicons name="warning" size={20} color={theme.warning} />
            <Text style={styles.noticeText}>Location is off. The map is showing known community sites instead.</Text>
          </View>
        )}

        <View style={styles.layerGrid}>
          {layers.map((layer) => (
            <View key={layer.id} style={styles.layerCard}>
              <View style={[styles.layerIcon, { backgroundColor: `${layer.color}18` }]}>
                <Ionicons name={layer.icon} size={20} color={layer.color} />
              </View>
              <Text style={styles.layerCount}>{layer.count}</Text>
              <Text style={styles.layerLabel}>{layer.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoHeader}>
            <Ionicons name={phase === "after" ? "gift" : "home"} size={22} color={SHELTER_ACCENT} />
            <Text style={styles.infoTitle}>
              {phase === "after" ? "Selected Relief Point" : "Selected Evacuation Center"}
            </Text>
          </View>
          <Text style={styles.centerName}>{displayedCenter?.name ?? "No center available"}</Text>
          <Text style={styles.centerMeta}>
            {distance === null ? "Distance unavailable" : `${distance.toFixed(1)} km away`}
            {" | "}
            {displayedCenter?.status ?? "Status pending"}
            {displayedCenter ? ` | ${formatCapacity(displayedCenter) ?? "Capacity pending"}` : ""}
          </Text>
          {phase === "before" && showRoutePreview && (
            <View style={styles.routeHint}>
              <Ionicons name="navigate-outline" size={16} color={SHELTER_ACCENT} />
              <Text style={styles.routeHintText}>Route preview is shown on the map.</Text>
            </View>
          )}
        </View>

        <View style={styles.shelterList}>
          {orderedCenters.map((center) => {
            const centerDistance = userLocation ? manhattanDistanceMeters(userLocation, center) / 1000 : null;
            const isSelected = selectedCenter.id === center.id;
            return (
              <Pressable
                key={center.id}
                style={[styles.shelterRow, isSelected && styles.shelterRowActive]}
                onPress={() => handleSelectCenter(center)}
              >
                <View style={[styles.shelterPin, isSelected && styles.shelterPinActive]}>
                  <Ionicons name="location" size={16} color={isSelected ? "#fff" : SHELTER_ACCENT} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.shelterName, isSelected && styles.shelterNameActive]}>{center.name}</Text>
                  <Text style={styles.shelterMeta}>
                    {centerDistance === null ? "Distance unavailable" : `${centerDistance.toFixed(1)} km away`}
                    {" | "}
                    {center.status}
                    {" | "}
                    {formatCapacity(center) ?? "Capacity pending"}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {phase === "during" && (
          <Pressable style={styles.sosButton} onPress={onReportIncident}>
            <Ionicons name="megaphone" size={22} color="#fff" />
            <Text style={styles.sosText}>Send SOS or Report Incident</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: STATUS_BAR_HEIGHT + 12,
    paddingBottom: 10,
    backgroundColor: theme.bg,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: theme.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.line,
  },
  topTitle: { ...fonts.black, fontSize: 20, color: theme.text },
  topSub: { ...fonts.medium, fontSize: 12, color: theme.textLight, marginTop: 2 },
  scrollContent: { padding: 20, paddingBottom: 150, gap: 16 },
  hero: { borderRadius: 24, padding: 22 },
  heroKicker: { ...fonts.black, color: "rgba(255,255,255,0.78)", fontSize: 10, letterSpacing: 1.3 },
  heroTitle: { ...fonts.black, color: "#fff", fontSize: 28, marginTop: 8 },
  heroSub: { ...fonts.medium, color: "rgba(255,255,255,0.86)", fontSize: 13, lineHeight: 20, marginTop: 6 },
  loadingMap: {
    height: 220,
    borderRadius: 24,
    backgroundColor: theme.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: theme.line,
  },
  loadingText: { ...fonts.bold, color: theme.textMuted, fontSize: 13 },
  notice: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    backgroundColor: theme.surface,
    borderRadius: 16,
    padding: 14,
    borderLeftWidth: 4,
  },
  noticeText: { ...fonts.bold, flex: 1, color: theme.textMuted, fontSize: 12, lineHeight: 18 },
  layerGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  layerCard: {
    flex: 1,
    minWidth: 140,
    backgroundColor: theme.surface,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: theme.line,
  },
  layerIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  layerCount: { ...fonts.black, color: theme.text, fontSize: 24 },
  layerLabel: { ...fonts.bold, color: theme.textLight, fontSize: 11, marginTop: 2 },
  infoCard: {
    backgroundColor: theme.surface,
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: theme.line,
  },
  infoHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  infoTitle: { ...fonts.black, color: theme.text, fontSize: 14 },
  centerName: { ...fonts.black, color: theme.text, fontSize: 18 },
  centerMeta: { ...fonts.bold, color: theme.textLight, fontSize: 12, marginTop: 4 },
  shelterList: {
    gap: 10,
  },
  shelterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: theme.surface,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.line,
  },
  shelterRowActive: {
    backgroundColor: "rgba(46, 125, 50, 0.06)",
    borderColor: "rgba(46, 125, 50, 0.35)",
  },
  shelterPin: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "rgba(46, 125, 50, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  shelterPinActive: {
    backgroundColor: theme.primary,
  },
  shelterName: { ...fonts.black, color: theme.text, fontSize: 14 },
  shelterNameActive: {
    color: theme.primary,
  },
  shelterMeta: { ...fonts.bold, color: theme.textLight, fontSize: 11, marginTop: 3, lineHeight: 16 },
  routeHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.line,
  },
  routeHintText: {
    ...fonts.medium,
    fontSize: 12,
    color: SHELTER_ACCENT,
  },
  sosButton: {
    height: 58,
    borderRadius: 20,
    backgroundColor: theme.danger,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  sosText: { ...fonts.black, color: "#fff", fontSize: 14, letterSpacing: 0.6 },
});
