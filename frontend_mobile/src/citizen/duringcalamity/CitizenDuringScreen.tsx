import { useState, useRef, useEffect } from "react";
import {
  Animated,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import * as Location from "expo-location";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import * as ImagePicker from "expo-image-picker";
import { theme } from "../../theme";
import { styles } from "./CitizenDuringScreen.styles";
import {
  submitIncidentReport,
  getIncidentPhotoUploadUrl,
  getCapacity,
  getActiveDisasterEvents,
  citizenSelfCheckIn,
  ApiError,
  type AppNotification,
} from "../../api";
import { CitizenLiveMap, type EvacCenter } from "./CitizenLiveMap";
import { formatCoordinates, manhattanDistanceMeters, manhattanRouteCoords, resolveReadableAddress, sortByManhattanDistance } from "../../utils/geoUtils";
import type { CapacityCenter } from "../../types";

// ─── Types ────────────────────────────────────────────────────────────────────
type DuringStep =
  | "dashboard"
  | "rescue_decision"
  | "report_incident"
  | "wait_rescue"
  | "self_evacuate"
  | "delivery_confirmation"
  | "safe_zone_map"
  | "navigate_evacuation"
  | "arrive_site"
  | "logged_in";

const STEP_PROGRESS: Record<DuringStep, number> = {
  dashboard: 0,
  rescue_decision: 0,
  report_incident: 15,
  wait_rescue: 30,
  delivery_confirmation: 35,
  self_evacuate: 20,
  safe_zone_map: 50,
  navigate_evacuation: 65,
  arrive_site: 80,
  logged_in: 100,
};

// Fallback centers if backend is unavailable
const FALLBACK_CENTERS: EvacCenter[] = [
  { id: "1", name: "Brgy. 102 Barangay Hall", latitude: 14.602, longitude: 120.985, status: "Open" },
  { id: "2", name: "San Miguel Elementary School", latitude: 14.5975, longitude: 120.987, status: "Open" },
  { id: "3", name: "Manila City Hall Evac Center", latitude: 14.5942, longitude: 120.977, status: "Open" },
];

function capacityCenterToEvacCenter(c: CapacityCenter): EvacCenter {
  return {
    id: c.id,
    name: c.name,
    latitude: c.latitude ?? 0,
    longitude: c.longitude ?? 0,
    status: c.status ?? "Open",
    capacity: c.capacity,
    currentOccupancy: c.currentOccupancy,
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

// ─── Pulsating Dot ────────────────────────────────────────────────────────────
function PulsatingDot({ color = theme.danger }: { readonly color?: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, { toValue: 4, duration: 1600, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 0, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0, duration: 1600, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.7, duration: 0, useNativeDriver: true }),
        ]),
      ]),
    ).start();
  }, []);

  return (
    <View style={{ alignItems: "center", justifyContent: "center" }}>
      <Animated.View style={[styles.radarRing, { backgroundColor: color, transform: [{ scale }], opacity }]} />
      <View style={[styles.coreDot, { backgroundColor: color }]} />
    </View>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────
function ProgressBar({ step }: { readonly step: DuringStep }) {
  const progress = STEP_PROGRESS[step] ?? 0;
  return (
    <View style={styles.progressWrap}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>
      <Text style={styles.progressLabel}>Response Progress — {Math.round(progress)}%</Text>
    </View>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export function CitizenDuringScreen({
  onBack,
  initialStep = "dashboard",
  session,
  qrCodeId,
  notifications = [],
  showBackButton = true,
}: {
  readonly onBack: () => void;
  readonly initialStep?: string;
  readonly session: any;
  readonly qrCodeId?: string | null;
  readonly notifications?: AppNotification[];
  readonly showBackButton?: boolean;
}) {
  const [step, setStep] = useState<DuringStep>(
    initialStep === "decision" ? "rescue_decision" : (initialStep as DuringStep),
  );
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [activeAlertCount, setActiveAlertCount] = useState(0);

  // GPS
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(true);
  const [locationDenied, setLocationDenied] = useState(false);
  const [resolvedLocationLabel, setResolvedLocationLabel] = useState<string | null>(null);

  // Shelters — fetched from backend, fallback to static list
  const [evacCenters, setEvacCenters] = useState<EvacCenter[]>(FALLBACK_CENTERS);
  const [centersLoading, setCentersLoading] = useState(true);
  const [orderedCenters, setOrderedCenters] = useState<EvacCenter[]>(FALLBACK_CENTERS);
  const [selectedCenter, setSelectedCenter] = useState<EvacCenter>(FALLBACK_CENTERS[0]);

  // Route
  const [routeCoords, setRouteCoords] = useState<Array<{ latitude: number; longitude: number }>>([]);
  const [routeDistanceMeters, setRouteDistanceMeters] = useState<number | null>(null);

  // Check if dispatcher has assigned rescue from notifications
  const dispatchNotification = notifications.find(
    (n) => n.type === "dispatch_assigned" && !n.read,
  );

  // ── Fetch real evacuation centers from backend ───────────────────────────
  useEffect(() => {
    if (!session?.accessToken) { setCentersLoading(false); return; }
    let cancelled = false;
    getCapacity(session.accessToken)
      .then((centers) => {
        if (cancelled) return;
        const valid = centers
          .filter((c) => c.latitude && c.longitude)
          .map(capacityCenterToEvacCenter);
        const unique = uniqueEvacCenters(valid);
        if (unique.length > 0) {
          setEvacCenters(unique);
          setOrderedCenters(unique);
          setSelectedCenter(unique[0]);
        }
      })
      .catch(() => { /* keep fallback */ })
      .finally(() => { if (!cancelled) setCentersLoading(false); });
    return () => { cancelled = true; };
  }, [session?.accessToken]);

  useEffect(() => {
    if (!session?.accessToken) return;
    let cancelled = false;
    getActiveDisasterEvents(session.accessToken)
      .then((events) => {
        if (!cancelled) {
          setActiveAlertCount(events.filter((event) => event.status === "active" || event.status === "DURING").length);
        }
      })
      .catch(() => {
        if (!cancelled) setActiveAlertCount(0);
      });
    return () => { cancelled = true; };
  }, [session?.accessToken]);

  // ── Fetch device GPS ─────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { setLocationDenied(true); setLocationLoading(false); return; }
      try {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      } catch {
        setLocationDenied(true);
      } finally {
        setLocationLoading(false);
      }
    })();
  }, []);

  // ── Sort centers by distance and resolve readable address ────────────────
  useEffect(() => {
    if (!userLocation) { setOrderedCenters(evacCenters); setSelectedCenter(evacCenters[0]); return; }
    let cancelled = false;
    const sorted = sortByManhattanDistance(userLocation, evacCenters);
    setOrderedCenters(sorted);
    setSelectedCenter((cur) => sorted.find((c) => c.id === cur.id) ?? sorted[0]);
    resolveReadableAddress(userLocation).then((label) => { if (!cancelled) setResolvedLocationLabel(label); });
    return () => { cancelled = true; };
  }, [userLocation, evacCenters]);

  // ── OSRM route when navigating ───────────────────────────────────────────
  useEffect(() => {
    if (step !== "navigate_evacuation" || !userLocation) return;
    let cancelled = false;
    setRouteCoords(manhattanRouteCoords(userLocation, selectedCenter));
    setRouteDistanceMeters(null);
    const { latitude: lat1, longitude: lon1 } = userLocation;
    const { latitude: lat2, longitude: lon2 } = selectedCenter;
    const url = `https://router.project-osrm.org/route/v1/foot/${lon1},${lat1};${lon2},${lat2}?overview=full&geometries=geojson`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    fetch(url, { signal: controller.signal })
      .then((r) => r.json())
      .then((data: any) => {
        clearTimeout(timeoutId);
        if (cancelled || !data.routes?.[0]) return;
        setRouteCoords(data.routes[0].geometry.coordinates.map(([lon, lat]: [number, number]) => ({ latitude: lat, longitude: lon })));
        setRouteDistanceMeters(data.routes[0].distance);
      })
      .catch(() => clearTimeout(timeoutId));
    return () => { cancelled = true; clearTimeout(timeoutId); };
  }, [step, userLocation, selectedCenter]);

  useEffect(() => {
    if (initialStep === "decision") setStep("rescue_decision");
    else if (initialStep) setStep(initialStep as DuringStep);
  }, [initialStep]);

  // ── Photo helpers ─────────────────────────────────────────────────────────
  async function handlePickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission required", "Please allow photo library access."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4, 3], quality: 0.8 });
    if (!result.canceled && result.assets.length > 0) setPhotoUri(result.assets[0].uri);
  }

  async function handleTakePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission required", "Please allow camera access."); return; }
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [4, 3], quality: 0.8 });
    if (!result.canceled && result.assets.length > 0) setPhotoUri(result.assets[0].uri);
  }

  // ── Submit SOS report ─────────────────────────────────────────────────────
  const handleSubmitReport = async () => {
    if (!session?.accessToken) {
      Alert.alert("Simulation Mode", "No session found. Continuing for flow testing.");
      go("wait_rescue");
      return;
    }
    try {
      setIsSubmitting(true);
      const locationStr = userLocation
        ? resolvedLocationLabel ?? formatCoordinates(userLocation)
        : "Location unavailable";

      const attachmentKeys: string[] = [];
      if (photoUri) {
        try {
          const fileName = photoUri.split("/").pop() ?? "incident.jpg";
          const { signedUrl, objectPath } = await getIncidentPhotoUploadUrl(session.accessToken, fileName);
          const blob = await (await fetch(photoUri)).blob();
          const uploadRes = await fetch(signedUrl, { method: "PUT", headers: { "Content-Type": "image/jpeg" }, body: blob });
          if (uploadRes.ok) attachmentKeys.push(objectPath);
        } catch (photoErr) {
          console.warn("Incident photo upload failed:", photoErr);
        }
      }

      await submitIncidentReport(session.accessToken, {
        title: "Citizen SOS Report",
        content: `Citizen needs immediate rescue. GPS: ${locationStr}.`,
        severity: "high",
        location: locationStr,
        attachmentKeys,
      });
      go("wait_rescue");
    } catch (err: any) {
      if (err instanceof ApiError && err.status === 0) {
        Alert.alert("Submission Fallback", `${err.message} Continuing for simulation.`);
        go("wait_rescue");
        return;
      }
      Alert.alert("Submit Failed", err instanceof Error ? err.message : "Failed to submit report.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Confirm check-in at shelter ───────────────────────────────────────────
  const handleConfirmCheckIn = async () => {
    setIsCheckingIn(true);
    try {
      if (session?.accessToken && qrCodeId) {
        await citizenSelfCheckIn(session.accessToken, qrCodeId);
      }
    } catch {
      // non-fatal — citizen is physically at the shelter regardless
    } finally {
      setIsCheckingIn(false);
      go("logged_in");
    }
  };

  function go(next: DuringStep) { setStep(next); }

  function goBackOneStep() {
    const previousStep: Record<DuringStep, DuringStep> = {
      dashboard: "dashboard",
      rescue_decision: "dashboard",
      report_incident: "dashboard",
      wait_rescue: "report_incident",
      delivery_confirmation: "report_incident",
      self_evacuate: "dashboard",
      safe_zone_map: "self_evacuate",
      navigate_evacuation: "safe_zone_map",
      arrive_site: "navigate_evacuation",
      logged_in: "dashboard",
    };
    setStep(previousStep[step] ?? "dashboard");
  }

  const locationLabel = locationLoading
    ? "Detecting location…"
    : locationDenied
    ? "GPS unavailable"
    : resolvedLocationLabel ?? (userLocation ? formatCoordinates(userLocation) : "Location unavailable");

  const locationIconName: "time" | "warning" | "location" =
    locationLoading ? "time" : locationDenied ? "warning" : "location";

  const incidentCount = notifications.filter((n) => ["incident", "dispatch_assigned", "system"].includes(n.type)).length;
  const nearestCenter = orderedCenters[0] ?? selectedCenter;
  const nearestDistance = userLocation && nearestCenter
    ? manhattanDistanceMeters(userLocation, nearestCenter) / 1000
    : null;
  const shouldShowTopBack = showBackButton && step !== "dashboard";

  return (
    <View style={styles.shell}>
      <View style={styles.topBar}>
        {shouldShowTopBack ? (
          <Pressable style={styles.backButton} onPress={goBackOneStep}>
            <Ionicons name="arrow-back" size={24} color={theme.text} />
          </Pressable>
        ) : (
          <View style={styles.topBarSide} />
        )}
        <View style={styles.topBarCenter}>
          <Text style={styles.topBarTitle}>Response Center</Text>
          <Text style={styles.topBarPhase}>Calamity Mode Active</Text>
        </View>
        <View style={styles.alertBadge}>
          <Ionicons name="alert" size={24} color={theme.danger} />
        </View>
      </View>

      <ProgressBar step={step} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {step === "dashboard" && (
          <View style={styles.stepCard}>
            <View style={[styles.stepIconWrap, { backgroundColor: "rgba(186,26,26,0.08)" }]}>
              <Ionicons name="alert-circle" size={36} color={theme.danger} />
            </View>
            <View>
              <Text style={[styles.stepTag, { color: theme.danger }]}>Emergency Dashboard</Text>
              <Text style={styles.stepTitle}>Where do I go and{"\n"}how do I get help?</Text>
            </View>
            <Text style={styles.stepCopy}>
              Monitor active alerts, send an SOS, and move toward the nearest open evacuation center.
            </Text>

            <View style={[styles.infoRow, { borderLeftColor: theme.danger }]}>
              <Ionicons name="notifications" size={24} color={theme.danger} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoRowText}>Active Alerts</Text>
                <Text style={styles.infoRowSub}>{activeAlertCount || incidentCount || 1} live advisory item{(activeAlertCount || incidentCount || 1) === 1 ? "" : "s"}</Text>
              </View>
            </View>

            <View style={[styles.infoRow, { borderLeftColor: dispatchNotification ? theme.primary : theme.warning }]}>
              <Ionicons name={dispatchNotification ? "checkmark-circle" : "radio"} size={24} color={dispatchNotification ? theme.primary : theme.warning} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoRowText}>SOS Status</Text>
                <Text style={styles.infoRowSub}>{dispatchNotification ? "Rescue unit assigned" : "No active SOS request"}</Text>
              </View>
            </View>

            <View style={[styles.infoRow, { borderLeftColor: theme.primary }]}>
              <Ionicons name="home" size={24} color={theme.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoRowText}>Nearest Evacuation Center</Text>
                <Text style={styles.infoRowSub}>
                  {nearestCenter?.name ?? "Loading shelters"}
                  {nearestDistance !== null ? ` | ${nearestDistance.toFixed(1)} km away` : ""}
                </Text>
              </View>
            </View>

            <View style={[styles.infoRow, { borderLeftColor: locationDenied ? theme.warning : theme.info }]}>
              <Ionicons name={locationIconName} size={24} color={locationDenied ? theme.warning : theme.info} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoRowText}>Safety Status</Text>
                <Text style={styles.infoRowSub}>{locationLabel}</Text>
              </View>
            </View>

            <View style={[styles.infoRow, { borderLeftColor: theme.info }]}>
              <Ionicons name="map" size={24} color={theme.info} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoRowText}>Live Incidents</Text>
                <Text style={styles.infoRowSub}>{incidentCount} notification update{incidentCount === 1 ? "" : "s"} from dispatch</Text>
              </View>
            </View>

            <Pressable style={[styles.ctaButton, { backgroundColor: theme.danger }]} onPress={() => go("report_incident")}>
              <Ionicons name="megaphone" size={22} color="#fff" />
              <Text style={styles.ctaButtonText}>Send SOS</Text>
            </Pressable>
            <Pressable style={styles.optionButtonNo} onPress={() => go("self_evacuate")}>
              <Ionicons name="walk" size={22} color={theme.text} />
              <Text style={styles.optionButtonTextDark}>Find evacuation route</Text>
            </Pressable>
          </View>
        )}

        {/* ── STEP 0: Rescue Decision ─────────────────────────────────── */}
        {step === "rescue_decision" && (
          <View style={styles.decisionCard}>
            <View style={[styles.decisionIconWrap, { backgroundColor: "rgba(186,26,26,0.08)" }]}>
              <Ionicons name="alert-circle" size={40} color={theme.danger} />
            </View>
            <View>
              <Text style={[styles.decisionLabel, { color: theme.danger }]}>Situation Assessment</Text>
              <Text style={styles.decisionTitle}>Are you in need of{"\n"}Immediate Rescue?</Text>
            </View>
            <Text style={styles.decisionCopy}>
              Select your current situation so we can route you to the correct emergency protocol immediately.
            </Text>
            <View style={styles.decisionOptions}>
              <Pressable style={[styles.optionButtonYes, { backgroundColor: theme.danger }]} onPress={() => go("report_incident")}>
                <Ionicons name="hand-left" size={24} color="#fff" />
                <Text style={styles.optionButtonText}>YES — I need rescue</Text>
              </Pressable>
              <Pressable style={styles.optionButtonNo} onPress={() => go("self_evacuate")}>
                <Ionicons name="walk" size={24} color={theme.text} />
                <Text style={styles.optionButtonTextDark}>NO — Self Evacuate</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* ── STEP 1a: Report Incident (YES path) ────────────────────── */}
        {step === "report_incident" && (
          <View style={styles.stepCard}>
            <View style={[styles.stepIconWrap, { backgroundColor: "rgba(186,26,26,0.08)" }]}>
              <Ionicons name="megaphone" size={36} color={theme.danger} />
            </View>
            <View>
              <Text style={[styles.stepTag, { color: theme.danger }]}>Rescue Requested</Text>
              <Text style={styles.stepTitle}>Report Incident</Text>
            </View>
            <Text style={styles.stepCopy}>Your GPS location and situation details will be sent directly to dispatch.</Text>

            <View style={[styles.infoRow, { borderLeftColor: theme.danger }]}>
              <Ionicons name={locationIconName} size={24} color={locationDenied ? theme.warning : theme.danger} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoRowText}>{locationLoading ? "Detecting Location…" : "GPS Location"}</Text>
                <Text style={styles.infoRowSub}>{locationLabel}</Text>
              </View>
              {!locationLoading && !locationDenied && <Ionicons name="checkmark-circle" size={20} color={theme.primary} />}
              {locationLoading && <ActivityIndicator size="small" color={theme.danger} />}
            </View>

            <View style={styles.uploadBox}>
              {photoUri ? (
                <View style={{ width: "100%", height: "100%", borderRadius: 20, overflow: "hidden" }}>
                  <Image source={{ uri: photoUri }} style={{ width: "100%", height: "100%" }} />
                  <Pressable onPress={() => setPhotoUri(null)} style={{ position: "absolute", top: 12, right: 12, backgroundColor: "rgba(0,0,0,0.6)", padding: 8, borderRadius: 12 }}>
                    <Ionicons name="close" size={20} color="#fff" />
                  </Pressable>
                </View>
              ) : (
                <>
                  <Ionicons name="camera" size={40} color={theme.primary} />
                  <Text style={styles.uploadBoxTitle}>Attach Photo (Optional)</Text>
                  <View style={{ flexDirection: "row", gap: 12 }}>
                    <TouchableOpacity onPress={handleTakePhoto} style={styles.ghostButton}><Text style={styles.ghostButtonText}>Take Photo</Text></TouchableOpacity>
                    <TouchableOpacity onPress={handlePickPhoto} style={styles.ghostButton}><Text style={styles.ghostButtonText}>Gallery</Text></TouchableOpacity>
                  </View>
                </>
              )}
            </View>

            <Pressable style={[styles.ctaButton, { backgroundColor: theme.danger }, isSubmitting && { opacity: 0.7 }]} onPress={handleSubmitReport} disabled={isSubmitting}>
              {isSubmitting ? <ActivityIndicator size="small" color="#fff" /> : (
                <>
                  <Ionicons name="send" size={20} color="#fff" />
                  <Text style={styles.ctaButtonText}>Send SOS Report</Text>
                </>
              )}
            </Pressable>
          </View>
        )}

        {/* ── STEP 1b: Wait for Rescue (YES path — after SOS sent) ────── */}
        {step === "wait_rescue" && (
          <View style={styles.stepCard}>
            <View style={styles.confirmHero}>
              <View style={{ alignItems: "center", justifyContent: "center", marginBottom: 8 }}>
                <PulsatingDot color={theme.danger} />
              </View>
              <Text style={styles.confirmTitle}>Stay in Place</Text>
              <Text style={styles.confirmCopy}>
                Your SOS has been received by dispatch.{"\n"}
                Do NOT move unless your location becomes unsafe.
              </Text>
            </View>

            {/* Show dispatch notification if received */}
            {dispatchNotification ? (
              <View style={[styles.infoRow, { borderLeftColor: theme.primary }]}>
                <Ionicons name="checkmark-circle" size={24} color={theme.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoRowText}>Rescue Unit Assigned</Text>
                  <Text style={styles.infoRowSub}>{dispatchNotification.body}</Text>
                </View>
              </View>
            ) : (
              <View style={[styles.infoRow, { borderLeftColor: theme.warning }]}>
                <ActivityIndicator size="small" color={theme.warning} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoRowText}>Awaiting Dispatch</Text>
                  <Text style={styles.infoRowSub}>A dispatcher is reviewing your case now.</Text>
                </View>
              </View>
            )}

            <View style={[styles.infoRow, { borderLeftColor: theme.danger }]}>
              <Ionicons name={locationIconName} size={24} color={theme.danger} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoRowText}>Your Reported Location</Text>
                <Text style={styles.infoRowSub}>{locationLabel}</Text>
              </View>
            </View>

            {/* Fallback: self-evacuate if rescue takes too long */}
            <Pressable style={styles.optionButtonNo} onPress={() => go("self_evacuate")}>
              <Ionicons name="walk" size={20} color={theme.text} />
              <Text style={styles.optionButtonTextDark}>I need to self-evacuate instead</Text>
            </Pressable>
          </View>
        )}

        {/* ── STEP 1b: Self Evacuate (NO path) ───────────────────────── */}
        {step === "self_evacuate" && (
          <View style={styles.stepCard}>
            <View style={[styles.stepIconWrap, { backgroundColor: "rgba(46,125,50,0.08)" }]}>
              <Ionicons name="walk" size={36} color={theme.primary} />
            </View>
            <View>
              <Text style={[styles.stepTag, { color: theme.primary }]}>Self Evacuation</Text>
              <Text style={styles.stepTitle}>Evacuate to Safety</Text>
            </View>
            <Text style={styles.stepCopy}>Follow the evacuation route to the nearest designated safe zone. Bring your Digital ID for check-in.</Text>

            <View style={[styles.infoRow, { borderLeftColor: theme.danger }]}>
              <Ionicons name={locationIconName} size={24} color={locationDenied ? theme.warning : theme.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoRowText}>Your Current Location</Text>
                <Text style={styles.infoRowSub}>{locationLabel}</Text>
              </View>
              {locationLoading && <ActivityIndicator size="small" color={theme.primary} />}
            </View>

            <Pressable style={[styles.ctaButton, { backgroundColor: theme.primary }]} onPress={() => go("safe_zone_map")}>
              <Ionicons name="map" size={20} color="#fff" />
              <Text style={styles.ctaButtonText}>Find Safe Zones</Text>
            </Pressable>
          </View>
        )}

        {/* STEP 2: Delivery Confirmation */}
        {step === "delivery_confirmation" && (
          <View style={styles.stepCard}>
            <View style={styles.confirmHero}>
              <View style={[styles.confirmIconRing, { backgroundColor: "rgba(46,125,50,0.08)" }]}>
                <Ionicons name="checkmark-circle" size={60} color={theme.primary} />
              </View>
              <Text style={styles.confirmTitle}>Report Delivered!</Text>
              <Text style={styles.confirmCopy}>Your SOS has been received. A dispatcher is reviewing your case now.</Text>
            </View>
            <View style={[styles.infoRow, { borderLeftColor: theme.primary }]}>
              <Ionicons name="person" size={24} color={theme.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoRowText}>Dispatcher Assigned</Text>
                <Text style={styles.infoRowSub}>Response Unit - monitoring your location</Text>
              </View>
            </View>
            <Pressable style={[styles.ctaButton, { backgroundColor: theme.primary }]} onPress={() => go("safe_zone_map")}>
              <Ionicons name="map" size={24} color="#fff" />
              <Text style={styles.ctaButtonText}>View Safe Zone Map</Text>
            </Pressable>
          </View>
        )}

        {/* STEP 3: Safe Zone Map */}
        {step === "safe_zone_map" && (
          <View style={styles.stepCard}>
            <View style={[styles.stepIconWrap, { backgroundColor: "rgba(46,125,50,0.08)" }]}>
              <Ionicons name="map" size={36} color={theme.primary} />
            </View>
            <View>
              <Text style={[styles.stepTag, { color: theme.primary }]}>Live Map</Text>
              <Text style={styles.stepTitle}>Nearby Shelters</Text>
            </View>

            {locationLoading || centersLoading ? (
              <View style={styles.mapLoadingBox}>
                <ActivityIndicator size="large" color={theme.primary} />
                <Text style={styles.mapLoadingText}>{centersLoading ? "Loading shelters…" : "Acquiring GPS…"}</Text>
              </View>
            ) : (
              <CitizenLiveMap mode="shelter_select" userLocation={userLocation} evacCenters={orderedCenters} selectedCenter={selectedCenter} onCenterSelect={setSelectedCenter} />
            )}

            {locationDenied && (
              <View style={[styles.infoRow, { borderLeftColor: theme.warning }]}>
                <Ionicons name="warning" size={20} color={theme.warning} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoRowText}>GPS access denied</Text>
                  <Text style={styles.infoRowSub}>Enable location for precision routing</Text>
                </View>
              </View>
            )}

            {orderedCenters.map((center) => {
              const dist = userLocation ? manhattanDistanceMeters(userLocation, center) / 1000 : null;
              const isSelected = selectedCenter.id === center.id;
              const capacityLabel = formatCapacity(center);
              return (
                <Pressable key={center.id} onPress={() => setSelectedCenter(center)}
                  style={[styles.infoRow, { borderLeftColor: isSelected ? theme.primary : theme.line }, isSelected && { backgroundColor: "rgba(46,125,50,0.06)" }]}>
                  <Ionicons name="home" size={24} color={isSelected ? theme.primary : theme.textLight} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.infoRowText, isSelected && { color: theme.primary }]}>{center.name}</Text>
                    <Text style={styles.infoRowSub}>
                      {dist === null ? "Calculating…" : `${dist.toFixed(1)} km away`}
                      {" · "}
                      {center.status}
                      {capacityLabel ? `  ·  ${capacityLabel}` : ""}
                    </Text>
                  </View>
                  {isSelected && <Ionicons name="checkmark-circle" size={20} color={theme.primary} />}
                </Pressable>
              );
            })}

            <Pressable style={[styles.ctaButton, { backgroundColor: theme.primary }]} onPress={() => go("navigate_evacuation")}>
              <Ionicons name="navigate" size={24} color="#fff" />
              <Text style={styles.routeButtonText} numberOfLines={2}>
                Navigate to {selectedCenter.name}
              </Text>
            </Pressable>
          </View>
        )}

        {/* ── STEP 4: Navigate to Shelter ──────────────────────────────── */}
        {step === "navigate_evacuation" && (
          <View style={styles.stepCard}>
            <View style={[styles.stepIconWrap, { backgroundColor: "rgba(0,97,164,0.08)" }]}>
              <Ionicons name="navigate" size={36} color={theme.info} />
            </View>
            <View>
              <Text style={[styles.stepTag, { color: theme.info }]}>Navigation</Text>
              <Text style={styles.stepTitle}>En Route</Text>
            </View>

            <View style={[styles.infoRow, { borderLeftColor: theme.info }]}>
              <Ionicons name="home" size={24} color={theme.info} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoRowText}>{selectedCenter.name}</Text>
                <Text style={styles.infoRowSub}>
                  {routeDistanceMeters !== null
                    ? `${(routeDistanceMeters / 1000).toFixed(1)} km by road`
                    : userLocation
                    ? `~${(manhattanDistanceMeters(userLocation, selectedCenter) / 1000).toFixed(1)} km estimated`
                    : "Calculating distance…"}
                </Text>
              </View>
            </View>

            {locationLoading ? (
              <View style={styles.mapLoadingBox}><ActivityIndicator size="large" color={theme.info} /></View>
            ) : (
              <CitizenLiveMap mode="navigate" userLocation={userLocation} evacCenters={orderedCenters} selectedCenter={selectedCenter} routeCoords={routeCoords} />
            )}

            <Pressable style={[styles.ctaButton, { backgroundColor: theme.info }]} onPress={() => go("arrive_site")}>
              <Ionicons name="checkmark-circle" size={24} color="#fff" />
              <Text style={styles.ctaButtonText}>I've Arrived</Text>
            </Pressable>
          </View>
        )}

        {/* ── STEP 5: Arrive — QR Check-In ─────────────────────────────── */}
        {step === "arrive_site" && (
          <View style={styles.stepCard}>
            <View style={styles.confirmHero}>
              <View style={[styles.confirmIconRing, { backgroundColor: "rgba(46,125,50,0.08)" }]}>
                <Ionicons name="qr-code" size={48} color={theme.primary} />
              </View>
              <Text style={styles.confirmTitle}>Check-in Required</Text>
              <Text style={styles.confirmCopy}>
                Present your QR ID to shelter staff for scanning.{"\n"}
                Your arrival will be recorded in the system.
              </Text>
            </View>

            <View style={styles.qrWrap}>
              <View style={styles.qrFrame}>
                <QRCode value={qrCodeId ?? "DAMAYAN-ID"} size={120} color="#0F6E56" backgroundColor="#fff" />
              </View>
              <View style={styles.qrIdBadge}>
                <Text style={styles.qrIdText}>{qrCodeId ?? "—"}</Text>
              </View>
            </View>

            <Pressable
              style={[styles.ctaButton, { backgroundColor: theme.primary }, isCheckingIn && { opacity: 0.7 }]}
              onPress={handleConfirmCheckIn}
              disabled={isCheckingIn}
            >
              {isCheckingIn
                ? <ActivityIndicator size="small" color="#fff" />
                : (
                  <>
                    <Ionicons name="checkmark-done" size={20} color="#fff" />
                    <Text style={styles.ctaButtonText}>Confirm Check-In</Text>
                  </>
                )}
            </Pressable>
          </View>
        )}

        {/* ── STEP 6: Logged In ─────────────────────────────────────────── */}
        {step === "logged_in" && (
          <View style={styles.stepCard}>
            <View style={styles.confirmHero}>
              <View style={[styles.confirmIconRing, { backgroundColor: "rgba(46,125,50,0.08)" }]}>
                <Ionicons name="shield-checkmark" size={60} color={theme.primary} />
              </View>
              <Text style={styles.confirmTitle}>Checked In!</Text>
              <Text style={styles.confirmCopy}>
                You are registered at {selectedCenter.name}.{"\n"}
                Stay with shelter staff for further instructions.
              </Text>
            </View>

            <View style={[styles.infoRow, { borderLeftColor: theme.primary }]}>
              <Ionicons name="home" size={24} color={theme.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.infoRowText}>Your Shelter</Text>
                <Text style={styles.infoRowSub}>{selectedCenter.name}</Text>
              </View>
            </View>

            <Pressable style={[styles.ctaButton, { backgroundColor: theme.primary }]} onPress={onBack}>
              <Text style={styles.ctaButtonText}>Back to Home</Text>
            </Pressable>
          </View>
        )}

      </ScrollView>
    </View>
  );
}
