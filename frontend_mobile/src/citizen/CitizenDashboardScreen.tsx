import { useState, useEffect, useRef, type ComponentProps } from "react";
import { View, StyleSheet, Pressable, Text, Modal, Platform, Image, StatusBar as RNStatusBar } from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { lightTheme, darkTheme, fonts } from "../theme";
import { NotificationBell } from "../components/NotificationBell";
import { useNotifications } from "../hooks/useNotifications";
import { loadSession } from "../session";
import { getProfile, getCitizenProfile, getFileViewUrl, ApiError, type CitizenProfile } from "../api";
import { CitizenBeforeScreen } from "./beforecalamity/screens/CitizenBeforeScreen";
import { CitizenDuringScreen } from "./duringcalamity/CitizenDuringScreen";
import CitizenAfterScreen from "./aftercalamity/CitizenAfterScreen";
import { CitizenSafetyMapScreen } from "./CitizenSafetyMapScreen";
import { CitizenIndividualRegistrationScreen } from "./beforecalamity/screens/CitizenIndividualRegistrationScreen";
import { CitizenHouseholdRegistrationScreen } from "./beforecalamity/screens/CitizenHouseholdRegistrationScreen";
import { CitizenProfileEditScreen } from "./CitizenProfileEditScreen";
import { CitizenFamilyGroupScreen } from "./familygroup/CitizenFamilyGroupScreen";
import { useSystemPhase } from "../context/SystemPhaseContext";
import type { AuthSession } from "../types";
import { isSiteManagerRole } from "../roles";

export type Phase = "before" | "during" | "after";
export type NavDestination = "Overview" | "Family & ID" | "Safety Map";

interface CitizenDashboardScreenProps {
  onSignOut: () => void;
  onSiteManagerSession?: () => void;
}

export default function CitizenDashboardScreen({ onSignOut, onSiteManagerSession }: Readonly<CitizenDashboardScreenProps>) {
  // Phase is driven by the global system state, but can be locally overridden via bottom tabs
  const { citizenPhase: systemPhase, refreshPhase } = useSystemPhase();
  const [phaseOverride, setPhaseOverride] = useState<Phase | null>(null);
  const phase = phaseOverride || systemPhase;
  const prevSystemPhaseRef = useRef<Phase | null>(null);

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const [token, setToken] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [authUser, setAuthUser] = useState<any>(null);
  const [citizenProfile, setCitizenProfile] = useState<CitizenProfile | null>(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);

  async function loadUserData() {
    try {
      const activeSession = await loadSession();
      if (!activeSession) {
        onSignOut();
        return;
      }

      if (isSiteManagerRole(activeSession.user.role)) {
        onSiteManagerSession?.();
        return;
      }

      setSession(activeSession);
      setAuthUser(activeSession.user);
      setToken(activeSession.accessToken);
      setUserId(activeSession.user.authUserId ?? activeSession.user.id);

      if (isSiteManagerRole(activeSession.user.role)) {
        onSiteManagerSession?.();
        return;
      }

      try {
        const latestProfile = await getProfile(activeSession.accessToken);
        if (latestProfile?.user) {
          setAuthUser(latestProfile.user);
        }
      } catch (err) {
        console.warn("Failed to fetch fresh user profile:", err);
      }

      try {
        const profile = await getCitizenProfile(activeSession.accessToken);
        setCitizenProfile(profile);
        if (profile?.profilePhotoKey) {
          try {
            const url = await getFileViewUrl(activeSession.accessToken, "government-ids", profile.profilePhotoKey);
            setProfilePhotoUrl(url);
          } catch (photoErr) {
            console.warn("Failed to fetch profile photo url:", photoErr);
          }
        }
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          console.log("Citizen registration profile not found. User is unregistered.");
          setCitizenProfile(null);
        } else {
          console.error("Failed to fetch citizen profile:", err);
        }
      }
    } catch (err) {
      console.error("Error loading citizen session:", err);
    }
  }

  useEffect(() => {
    loadUserData().then(() => {
      // Re-fetch phase with persona context so regional overrides are applied
      // immediately after the citizen's session (and assignedRegionId) is known.
      void refreshPhase();
    });
  }, []);

  useEffect(() => {
    if (prevSystemPhaseRef.current !== null && prevSystemPhaseRef.current !== systemPhase) {
      setPhaseOverride(null);
    }
    prevSystemPhaseRef.current = systemPhase;
  }, [systemPhase]);

  const { notifications, unreadCount, markRead, markAllRead } = useNotifications(userId, token);

  // ── Phase change announcement ─────────────────────────────────────────────
  const prevPhaseRef = useRef<Phase | null>(null);
  const [phaseAnnouncement, setPhaseAnnouncement] = useState<Phase | null>(null);
  useEffect(() => {
    if (prevPhaseRef.current !== null && prevPhaseRef.current !== phase) {
      setPhaseAnnouncement(phase);
    }
    prevPhaseRef.current = phase;
  }, [phase]);

  const theme = isDarkMode ? darkTheme : lightTheme;

  const [activeNav, setActiveNav] = useState<NavDestination>("Overview");
  const [targetStep, setTargetStep] = useState<string | null>(null);

  const isEditingProfile = targetStep === "edit_profile";
  const isViewingFamilyGroup = targetStep === "family_group";
  const isViewingSafetyMap = targetStep === "safety_map";

  const styles = getStyles(theme);

  const displayName =
    citizenProfile?.fullName ||
    (citizenProfile?.firstName && citizenProfile?.lastName
      ? `${citizenProfile.firstName} ${citizenProfile.lastName}`
      : null) ||
    (session?.user
      ? `${session.user.firstName || ""} ${session.user.lastName || ""}`.trim() || null
      : null) ||
    session?.user?.email ||
    "Citizen";

  const initials =
    displayName
      .split(" ")
      .filter(Boolean)
      .map((n: string) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "C";

  // ── Phase-dependent display values — lookup avoids nested ternaries ──────────
  const PHASE_DISPLAY: Record<Phase, {
    color: string;
    icon: ComponentProps<typeof Ionicons>["name"];
    label: string;
    lightBg: string;
  }> = {
    before: { color: theme.primary,  icon: "shield-checkmark",       label: "PREPAREDNESS",  lightBg: "#eef1ea" },
    during: { color: theme.warning,  icon: "warning",                label: "RESPONSE MODE", lightBg: "#fff4e5" },
    after:  { color: theme.info,     icon: "checkmark-done-circle",  label: "RECOVERY PHASE", lightBg: "#eef2ff" },
  };
  const pd = PHASE_DISPLAY[phase];
  const phaseColor = pd.color;
  const phaseIconName = pd.icon;
  const phaseLabel = pd.label;
  const phaseIndicatorBg = isDarkMode ? theme.surfaceAlt : pd.lightBg;
  const orbColor = pd.color;

  const citizenDisplayName = displayName === "Citizen" ? undefined : displayName;

  // ── Announcement modal content — lookup avoids nested ternaries ────────────
  const ANNOUNCEMENT: Record<Phase, { bg: string; icon: ComponentProps<typeof Ionicons>["name"]; title: string; body: string }> = {
    during: { bg: "#BA1A1A", icon: "alert-circle",      title: "EMERGENCY MODE ACTIVATED",  body: "An emergency has been declared. Please follow evacuation instructions and use the Safety Map tab." },
    after:  { bg: "#2E7D32", icon: "checkmark-circle",  title: "ALL CLEAR — RECOVERY PHASE", body: "Authorities have declared the situation safe. Proceed to the Recovery Flow in your dashboard." },
    before: { bg: "#1565C0", icon: "shield-checkmark",  title: "STANDBY — PREPAREDNESS MODE", body: "The system has returned to preparedness mode. Continue reviewing your safety checklist." },
  };
  const announcementContent = phaseAnnouncement ? ANNOUNCEMENT[phaseAnnouncement] : null;

  return (
    <View style={styles.container}>
      <StatusBar style={isDarkMode ? "light" : "dark"} />

      {/* Background Decoration */}
      <View style={[styles.orb, styles.orb1, { backgroundColor: orbColor }]} />
      <View style={[styles.orb, styles.orb2]} />

      {/* Header — hidden while editing profile or viewing family group */}
      {!isEditingProfile && !isViewingFamilyGroup && !isViewingSafetyMap && (
        <View style={styles.headerSafe}>
          <View style={styles.headerInner}>
            {/* Brand */}
            <View style={styles.headerLeft}>
              <Image
                source={require("../../assets/damayan-logo.png")}
                style={styles.headerLogo}
                resizeMode="contain"
              />
              <View>
                <Text style={styles.brandText}>DAMAYAN</Text>
                <View style={[styles.phaseIndicator, { backgroundColor: phaseIndicatorBg }]}>
                  <Ionicons name={phaseIconName} size={10} color={phaseColor} />
                  <Text style={[styles.phaseText, { color: phaseColor }]}>{phaseLabel}</Text>
                </View>
              </View>
            </View>

            {/* Notification Bell + Avatar */}
            <View style={styles.headerRight}>
              <NotificationBell
                notifications={notifications}
                unreadCount={unreadCount}
                onMarkRead={markRead}
                onMarkAllRead={markAllRead}
              />
              <Pressable onPress={() => setIsProfileOpen(true)} style={styles.avatarContainer}>
                <View style={styles.avatar}>
                  {profilePhotoUrl ? (
                    <Image source={{ uri: profilePhotoUrl }} style={styles.avatarImage} />
                  ) : (
                    <View style={styles.avatarInitials}>
                      <Text style={styles.avatarInitialsText}>{initials}</Text>
                    </View>
                  )}
                </View>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* Main Content */}
      <View style={styles.content}>
        {isEditingProfile ? (
          <CitizenProfileEditScreen
            onBack={() => { setTargetStep("dashboard"); setPhaseOverride(null); setActiveNav("Overview"); }}
            onSave={(data) => {
              setTargetStep("dashboard");
              setPhaseOverride(null);
              setActiveNav("Overview");
              if (data.updatedUser) setAuthUser(data.updatedUser);
            }}
            onPhotoUpdated={(uri) => setProfilePhotoUrl(uri)}
            citizenProfile={citizenProfile}
            session={session}
            latestProfile={authUser}
            initialPhotoUrl={profilePhotoUrl}
          />
        ) : isViewingFamilyGroup ? (
          <CitizenFamilyGroupScreen
            onBack={() => { setTargetStep("dashboard"); setActiveNav("Overview"); setPhaseOverride(null); }}
            personalQrCodeId={citizenProfile?.qrCodeId}
            citizenDisplayName={citizenDisplayName}
            citizenProfile={citizenProfile}
            onRefreshProfile={loadUserData}
          />
        ) : isViewingSafetyMap ? (
          <CitizenSafetyMapScreen
            phase={phase}
            session={session}
            notifications={notifications}
            onBack={() => { setTargetStep("dashboard"); setActiveNav("Overview"); }}
            onReportIncident={() => { setPhaseOverride("during"); setTargetStep("report_incident"); setActiveNav("Overview"); }}
          />
        ) : (
          <>
            {phase === "before" && (
              <View style={{ flex: 1 }}>
                {targetStep === "individual_registration" ? (
                  <CitizenIndividualRegistrationScreen
                    onBack={() => setTargetStep("dashboard")}
                    onContinue={() => setTargetStep("dashboard")}
                    session={session}
                    authUser={authUser}
                    onRefreshProfile={loadUserData}
                    citizenProfile={citizenProfile}
                    profilePhotoUrl={profilePhotoUrl}
                    initials={initials}
                  />
                ) : targetStep === "household_registration" ? (
                  <CitizenHouseholdRegistrationScreen
                    onBack={() => setTargetStep("dashboard")}
                    onContinue={() => setTargetStep("dashboard")}
                    session={session}
                    authUser={authUser}
                    citizenProfile={citizenProfile}
                    onRefreshProfile={loadUserData}
                  />
                ) : (
                  <CitizenBeforeScreen
                    onBack={onSignOut}
                    onOpenResponse={() => { setActiveNav("Safety Map"); setTargetStep("safety_map"); }}
                    onRegisterIndividual={() => setTargetStep("individual_registration")}
                    onRegisterHousehold={() => setTargetStep("household_registration")}
                    onReportIncident={() => { setPhaseOverride("during"); setTargetStep("report_incident"); setActiveNav("Overview"); }}
                    initialStep={targetStep === "registration" ? "registration" : "dashboard"}
                    citizenProfile={citizenProfile}
                    authUser={authUser}
                    citizenName={citizenDisplayName}
                    qrCodeId={citizenProfile?.qrCodeId}
                    registrationType={citizenProfile?.registrationType}
                    profilePhotoUrl={profilePhotoUrl ?? undefined}
                    session={session}
                  />
                )}
              </View>
            )}
            {phase === "during" && (
              <CitizenDuringScreen
                onBack={() => { setPhaseOverride(null); setTargetStep("dashboard"); setActiveNav("Overview"); }}
                initialStep={targetStep === "report_incident" ? "report_incident" : "dashboard"}
                session={session}
                qrCodeId={citizenProfile?.qrCodeId}
                notifications={notifications}
              />
            )}
            {phase === "after" && (
              <CitizenAfterScreen
                onBack={() => { setActiveNav("Overview"); setTargetStep("dashboard"); setPhaseOverride(null); }}
                qrCodeId={citizenProfile?.qrCodeId}
                citizenName={citizenDisplayName}
                session={session}
                notifications={notifications}
              />
            )}
          </>
        )}
      </View>

      {/* Bottom Navigation — hidden while editing profile or viewing family group */}
      {!isEditingProfile && !isViewingFamilyGroup && !isViewingSafetyMap && (
        <View style={styles.bottomNavWrapper}>
          <View style={styles.bottomNavInner}>
            {(
              [
                { id: "Overview", icon: "grid", label: "OVERVIEW" },
                { id: "Family & ID", icon: "people", label: "FAMILY & ID" },
                { id: "Safety Map", icon: "map", label: "SAFETY MAP" },
              ] as const
            ).map((item) => {
              const isActive = activeNav === item.id;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    setActiveNav(item.id);
                    if (item.id === "Family & ID") {
                      setTargetStep("family_group");
                    } else if (item.id === "Safety Map") {
                      setTargetStep("safety_map");
                    } else {
                      setPhaseOverride(null);
                      setTargetStep("dashboard");
                    }
                  }}
                  style={styles.navTab}
                >
                  <View style={[styles.tabIconWrap, isActive && styles.tabIconWrapActive]}>
                    <Ionicons
                      name={(isActive ? item.icon : `${item.icon}-outline`) as any}
                      size={22}
                      color={isActive ? theme.primary : theme.textLight}
                    />
                  </View>
                  <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}

      {/* Phase Change Announcement Modal */}
      <Modal visible={phaseAnnouncement !== null} transparent animationType="fade">
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: 32 }}
          onPress={() => setPhaseAnnouncement(null)}
        >
          <View style={{
            backgroundColor: announcementContent?.bg ?? "#1565C0",
            borderRadius: 32, padding: 32, alignItems: "center", gap: 16, width: "100%", maxWidth: 360,
          }}>
            <Ionicons name={announcementContent?.icon ?? "shield-checkmark"} size={48} color="#fff" />
            <Text style={{ ...fonts.black, fontSize: 22, color: "#fff", textAlign: "center", letterSpacing: -0.5 }}>
              {announcementContent?.title}
            </Text>
            <Text style={{ ...fonts.medium, fontSize: 14, color: "rgba(255,255,255,0.85)", textAlign: "center", lineHeight: 22 }}>
              {announcementContent?.body}
            </Text>
            <Pressable
              onPress={() => setPhaseAnnouncement(null)}
              style={{ backgroundColor: "rgba(255,255,255,0.2)", paddingHorizontal: 28, paddingVertical: 14, borderRadius: 16, marginTop: 8 }}
            >
              <Text style={{ ...fonts.black, fontSize: 14, color: "#fff", letterSpacing: 1 }}>ACKNOWLEDGE</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      {/* Profile Modal */}
      <Modal visible={isProfileOpen} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setIsProfileOpen(false)}>
          <View style={styles.profileDropdown}>
            <View style={styles.profileHeader}>
              <Text style={styles.profileName}>{displayName}</Text>
              <Text style={styles.profileSub}>{session?.user?.email ?? "Citizen"}</Text>
            </View>
            <View style={styles.profileActions}>
              <Pressable style={styles.profileActionItem} onPress={() => setIsDarkMode(!isDarkMode)}>
                <View style={styles.themeToggleIcon}>
                  <Ionicons
                    name={isDarkMode ? "sunny-outline" : "moon-outline"}
                    size={20}
                    color={isDarkMode ? "#2196F3" : "#FFB300"}
                  />
                </View>
                <Text style={styles.profileActionText}>{isDarkMode ? "Light Mode" : "Dark Mode"}</Text>
              </Pressable>

              <Pressable
                style={styles.profileActionItem}
                onPress={() => {
                  setIsProfileOpen(false);
                  setActiveNav("Overview");
                  setTargetStep("dashboard");
                  setPhaseOverride(null);
                }}
              >
                <Ionicons name="arrow-back-outline" size={20} color={theme.primary} />
                <Text style={styles.profileActionText}>Back to Dashboard</Text>
              </Pressable>

              <Pressable
                style={styles.profileActionItem}
                onPress={() => {
                  setIsProfileOpen(false);
                  setTargetStep("edit_profile");
                }}
              >
                <Ionicons name="create-outline" size={20} color={theme.warning} />
                <Text style={styles.profileActionText}>Edit Profile</Text>
              </Pressable>

              <View style={styles.divider} />

              <Pressable
                style={styles.profileActionItem}
                onPress={() => { setIsProfileOpen(false); onSignOut(); }}
              >
                <Ionicons name="log-out-outline" size={20} color={theme.danger} />
                <Text style={[styles.profileActionText, { color: theme.danger }]}>Sign Out</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  headerSafe: {
    backgroundColor: theme.surface + "CC", // 80% opacity
    borderBottomWidth: 1,
    borderBottomColor: theme.line,
  },
  headerInner: {
    height: 72,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  headerLogo: {
    width: 36,
    height: 36,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  brandText: {
    ...fonts.black,
    fontSize: 18,
    color: theme.text,
    letterSpacing: -1,
  },
  phaseIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    marginTop: 2,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.03)",
  },
  phaseText: {
    ...fonts.black,
    fontSize: 9,
    textTransform: "uppercase",
    letterSpacing: 2,
  },
  orb: {
    position: "absolute",
    borderRadius: 999,
    opacity: 0.08,
  },
  orb1: {
    width: 350,
    height: 350,
    top: -100,
    right: -100,
  },
  orb2: {
    width: 250,
    height: 250,
    bottom: 100,
    left: -100,
    backgroundColor: theme.secondary,
  },
  avatarContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: theme.surface,
    borderWidth: 1.5,
    borderColor: theme.line,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarInitials: {
    width: "100%",
    height: "100%",
    backgroundColor: theme.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitialsText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 16,
  },
  content: {
    flex: 1,
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.15)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingTop: 80,
    paddingRight: 24,
  },
  profileDropdown: {
    width: 260,
    backgroundColor: theme.surface,
    borderRadius: 32,
    paddingVertical: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.12,
    shadowRadius: 30,
    elevation: 12,
    borderWidth: 1,
    borderColor: theme.line,
  },
  profileHeader: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.line,
  },
  profileName: {
    ...fonts.black,
    fontSize: 18,
    color: theme.text,
    letterSpacing: -0.5,
  },
  profileSub: {
    ...fonts.bold,
    fontSize: 11,
    color: theme.textLight,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginTop: 4,
  },
  profileActions: {
    padding: 12,
  },
  profileActionItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: 16,
  },
  profileActionText: {
    ...fonts.bold,
    fontSize: 15,
    color: theme.textMuted,
  },
  divider: {
    height: 1,
    backgroundColor: theme.line,
    marginVertical: 12,
    marginHorizontal: 16,
  },
  // Premium Bottom Nav Styles
  bottomNavWrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingTop: 10,
  },
  bottomNavInner: {
    flexDirection: "row",
    backgroundColor: theme.surface + "F2", // 95% opacity
    borderRadius: 36,
    height: 84,
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.1,
    shadowRadius: 25,
    elevation: 15,
  },
  navTab: {
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    flex: 1,
  },
  tabIconWrap: {
    width: 52,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  tabIconWrapActive: {
    backgroundColor: theme.primarySoft,
  },
  tabLabel: {
    fontSize: 11,
    ...fonts.bold,
    color: theme.textLight,
    letterSpacing: 0.5,
  },
  tabLabelActive: {
    color: theme.primary,
  },
  themeToggleIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.04)",
  },
});
