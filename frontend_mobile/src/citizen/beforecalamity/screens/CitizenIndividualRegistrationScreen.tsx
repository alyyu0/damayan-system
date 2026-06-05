import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import { theme, fonts } from "../../../theme";
import { registerCitizen, type CitizenProfile } from "../../../api";

type RegStep = "form" | "submitting" | "success";

const GENDERS = ["Male", "Female", "Prefer not to say"] as const;
const BLOOD_TYPES = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "Unknown"] as const;

export function CitizenIndividualRegistrationScreen({
  onBack,
  onContinue,
  session,
  authUser,
  onRefreshProfile,
  citizenProfile,
  profilePhotoUrl,
  initials = "C",
}: Readonly<{
  onBack: () => void;
  onContinue: () => void;
  session?: any;
  authUser?: any;
  onRefreshProfile?: () => void | Promise<void>;
  citizenProfile?: CitizenProfile | null;
  profilePhotoUrl?: string | null;
  initials?: string;
}>) {
  const defaultName =
    authUser?.firstName && authUser?.lastName
      ? `${authUser.firstName} ${authUser.lastName}`
      : authUser?.name || "";

  const [step, setStep] = useState<RegStep>(citizenProfile?.qrCodeId ? "success" : "form");
  const [fullName, setFullName] = useState(defaultName);
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState<string>("");
  const [bloodType, setBloodType] = useState<string>("");
  const [medicalConditions, setMedicalConditions] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!fullName.trim()) { setError("Full name is required."); return; }
    if (!birthDate.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate.trim())) {
      setError("Enter your birth date in YYYY-MM-DD format."); return;
    }
    if (!gender) { setError("Please select a gender."); return; }
    if (!bloodType) { setError("Please select your blood type."); return; }
    if (!session?.accessToken) { setError("No active session. Please sign in again."); return; }

    setError(null);
    setStep("submitting");
    try {
      await registerCitizen(session.accessToken, {
        fullName: fullName.trim(),
        birthDate: birthDate.trim(),
        gender,
        bloodType,
        medicalConditions: medicalConditions.trim() || "None",
        registrationType: "Individual",
      });
      onRefreshProfile?.();
      setStep("success");
    } catch (err: any) {
      setStep("form");
      setError(err?.message || "Registration failed. Please try again.");
    }
  }

  const profile = citizenProfile;
  const qrValue = profile?.qrCodeId ?? "DAMAYAN-ID";
  const displayName =
    profile?.fullName ||
    (profile?.firstName && profile?.lastName ? `${profile.firstName} ${profile.lastName}` : fullName) ||
    "—";

  const expiryLabel = (() => {
    const raw = profile?.createdAt;
    if (!raw) return "—";
    const d = new Date(raw);
    d.setFullYear(d.getFullYear() + 1);
    return `${String(d.getMonth() + 1).padStart(2, "0")} / ${d.getFullYear()}`;
  })();

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      {/* Top Bar */}
      <View style={styles.topBar}>
        <Pressable onPress={onBack} style={styles.topButton}>
          <Ionicons name="arrow-back" size={22} color={theme.primary} />
        </Pressable>
        <Text style={styles.topBarTitle}>
          {step === "success" ? "Your Digital ID" : "Register Individual"}
        </Text>
        <View style={styles.avatarWrap}>
          {profilePhotoUrl ? (
            <Image source={{ uri: profilePhotoUrl }} style={styles.avatarImg} />
          ) : (
            <View style={[styles.avatarImg, styles.avatarFallback]}>
              <Text style={styles.avatarInitials}>{initials}</Text>
            </View>
          )}
        </View>
      </View>

      {/* ── FORM STEP ───────────────────────────────────────────── */}
      {step === "form" && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.formScroll} showsVerticalScrollIndicator={false}>
          <View style={styles.formHero}>
            <View style={styles.heroBadge}>
              <Ionicons name="shield-checkmark" size={14} color={theme.primary} />
              <Text style={styles.heroBadgeText}>INDIVIDUAL REGISTRATION</Text>
            </View>
            <Text style={styles.heroTitle}>Register your{"\n"}Emergency ID</Text>
            <Text style={styles.heroSub}>
              This information is used for medical triage, shelter check-in, and relief allocation.
              Please be accurate.
            </Text>
          </View>

          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color={theme.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Full Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>FULL NAME</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="e.g. Juan dela Cruz"
              placeholderTextColor={theme.textLight}
              autoCapitalize="words"
            />
          </View>

          {/* Birth Date */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>DATE OF BIRTH</Text>
            <TextInput
              style={styles.input}
              value={birthDate}
              onChangeText={setBirthDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={theme.textLight}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />
            <Text style={styles.fieldHint}>Format: YYYY-MM-DD  (e.g. 1990-06-15)</Text>
          </View>

          {/* Gender */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>GENDER</Text>
            <View style={styles.chipRow}>
              {GENDERS.map((g) => (
                <Pressable
                  key={g}
                  style={[styles.chip, gender === g && styles.chipActive]}
                  onPress={() => setGender(g)}
                >
                  <Text style={[styles.chipText, gender === g && styles.chipTextActive]}>{g}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Blood Type */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>BLOOD TYPE</Text>
            <View style={styles.chipRow}>
              {BLOOD_TYPES.map((bt) => (
                <Pressable
                  key={bt}
                  style={[styles.chip, bloodType === bt && styles.chipActive]}
                  onPress={() => setBloodType(bt)}
                >
                  <Text style={[styles.chipText, bloodType === bt && styles.chipTextActive]}>{bt}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Medical Conditions */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>MEDICAL CONDITIONS <Text style={styles.optional}>(Optional)</Text></Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={medicalConditions}
              onChangeText={setMedicalConditions}
              placeholder="e.g. Hypertension, Asthma, Diabetes"
              placeholderTextColor={theme.textLight}
              multiline
              numberOfLines={3}
            />
            <Text style={styles.fieldHint}>Used by shelter staff for medical triage. Leave blank if none.</Text>
          </View>

          <Pressable style={styles.submitBtn} onPress={handleSubmit}>
            <Ionicons name="shield-checkmark" size={20} color="#fff" />
            <Text style={styles.submitBtnText}>REGISTER & GET MY QR ID</Text>
          </Pressable>

          <Pressable style={styles.cancelBtn} onPress={onBack}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </Pressable>
        </ScrollView>
      )}

      {/* ── SUBMITTING ──────────────────────────────────────────── */}
      {step === "submitting" && (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loadingText}>Registering your Emergency ID…</Text>
          <Text style={styles.loadingHint}>This only takes a moment.</Text>
        </View>
      )}

      {/* ── SUCCESS / QR CARD ───────────────────────────────────── */}
      {step === "success" && (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.formScroll} showsVerticalScrollIndicator={false}>
          <View style={styles.successHero}>
            <View style={styles.successBadge}>
              <Ionicons name="checkmark" size={32} color={theme.primary} />
            </View>
            <Text style={styles.heroTitle}>Your Personal{"\n"}ID is Ready</Text>
            <Text style={styles.heroSub}>
              This QR code is your digital key for shelter check-in, relief claims, and medical assistance.
            </Text>
          </View>

          {/* ID Card */}
          <View style={styles.idCard}>
            <View style={styles.idHeader}>
              <View>
                <Text style={styles.idHeaderLabel}>Damayan Relief Network</Text>
                <Text style={styles.idHeaderTitle}>OFFICIAL CITIZEN ID</Text>
              </View>
              <Text style={styles.idHeaderMark}>{initials.slice(0, 2)}</Text>
            </View>

            <View style={styles.idBody}>
              <View style={styles.qrFrame}>
                <QRCode value={qrValue} size={110} color="#0F6E56" backgroundColor="#fff" />
              </View>
              <View style={styles.idDetails}>
                <Text style={styles.idLabel}>FULL NAME</Text>
                <Text style={styles.idValue}>{displayName}</Text>

                <Text style={[styles.idLabel, { marginTop: 12 }]}>QR CODE ID</Text>
                <Text style={[styles.idValue, { fontSize: 11, letterSpacing: 1 }]}>
                  {profile?.qrCodeId ?? "—"}
                </Text>

                <View style={styles.idFooterRow}>
                  <View style={styles.statusBadge}>
                    <View style={styles.greenDot} />
                    <Text style={styles.statusText}>
                      {profile?.registrationType?.toUpperCase() ?? "VERIFIED"}
                    </Text>
                  </View>
                  <Text style={styles.expiryText}>EXP {expiryLabel}</Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.infoCard}>
            <Ionicons name="information-circle" size={20} color={theme.info} />
            <Text style={styles.infoCardText}>
              Show this QR to shelter staff upon arrival. Your registration is now pending admin review.
            </Text>
          </View>

          <Pressable style={styles.submitBtn} onPress={onContinue}>
            <Ionicons name="home" size={20} color="#fff" />
            <Text style={styles.submitBtnText}>BACK TO DASHBOARD</Text>
          </Pressable>
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.line,
    backgroundColor: theme.surface,
  },
  topButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: theme.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  topBarTitle: { ...fonts.black, fontSize: 17, color: theme.text, letterSpacing: -0.5 },
  avatarWrap: { width: 40 },
  avatarImg: { width: 40, height: 40, borderRadius: 12 },
  avatarFallback: { backgroundColor: theme.primary, alignItems: "center", justifyContent: "center" },
  avatarInitials: { color: "#fff", fontWeight: "900", fontSize: 15 },

  formScroll: { padding: 20, paddingBottom: 120 },

  formHero: {
    backgroundColor: theme.primary,
    borderRadius: 28,
    padding: 24,
    marginBottom: 24,
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    marginBottom: 16,
  },
  heroBadgeText: { ...fonts.black, fontSize: 9, color: "#fff", letterSpacing: 1.5 },
  heroTitle: { ...fonts.black, fontSize: 28, color: "#fff", letterSpacing: -1, lineHeight: 34, marginBottom: 10 },
  heroSub: { ...fonts.medium, fontSize: 13, color: "rgba(255,255,255,0.85)", lineHeight: 20 },

  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: theme.dangerLight,
    padding: 14,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(211,47,47,0.2)",
  },
  errorText: { ...fonts.bold, fontSize: 13, color: theme.danger, flex: 1, lineHeight: 18 },

  fieldGroup: { marginBottom: 20 },
  fieldLabel: { ...fonts.black, fontSize: 10, color: theme.textLight, letterSpacing: 2, marginBottom: 8 },
  fieldHint: { ...fonts.medium, fontSize: 11, color: theme.textLight, marginTop: 6 },
  optional: { ...fonts.medium, fontSize: 10, color: theme.textLight },

  input: {
    backgroundColor: theme.surface,
    borderWidth: 1.5,
    borderColor: theme.line,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    ...fonts.bold,
    fontSize: 15,
    color: theme.text,
  },
  textArea: { minHeight: 80, textAlignVertical: "top" },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: theme.line,
    backgroundColor: theme.surface,
  },
  chipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  chipText: { ...fonts.bold, fontSize: 13, color: theme.textMuted },
  chipTextActive: { color: "#fff" },

  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: theme.primary,
    height: 58,
    borderRadius: 20,
    marginTop: 8,
    shadowColor: theme.primary,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  submitBtnText: { ...fonts.black, fontSize: 14, color: "#fff", letterSpacing: 1 },
  cancelBtn: { alignItems: "center", paddingVertical: 16, marginTop: 4 },
  cancelBtnText: { ...fonts.bold, fontSize: 14, color: theme.textLight },

  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 40 },
  loadingText: { ...fonts.black, fontSize: 18, color: theme.text, textAlign: "center" },
  loadingHint: { ...fonts.medium, fontSize: 14, color: theme.textLight, textAlign: "center" },

  successHero: { alignItems: "center", marginBottom: 28, gap: 12 },
  successBadge: {
    width: 80,
    height: 80,
    borderRadius: 28,
    backgroundColor: theme.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },

  idCard: {
    backgroundColor: "#fff",
    borderRadius: 28,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: theme.line,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  idHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.06)",
  },
  idHeaderLabel: { ...fonts.bold, fontSize: 9, color: theme.textLight, letterSpacing: 1, textTransform: "uppercase" },
  idHeaderTitle: { ...fonts.black, fontSize: 14, color: theme.primary, letterSpacing: 0.5 },
  idHeaderMark: { ...fonts.black, fontSize: 28, color: theme.primarySoft },
  idBody: { flexDirection: "row", gap: 16, alignItems: "flex-start" },
  qrFrame: {
    width: 130,
    height: 130,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.line,
    flexShrink: 0,
  },
  idDetails: { flex: 1 },
  idLabel: { ...fonts.bold, fontSize: 9, color: theme.textLight, letterSpacing: 1.5, textTransform: "uppercase" },
  idValue: { ...fonts.black, fontSize: 14, color: theme.text, marginTop: 2 },
  idFooterRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16 },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.primarySoft,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  greenDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.primary },
  statusText: { ...fonts.black, fontSize: 9, color: theme.primary, letterSpacing: 0.5 },
  expiryText: { ...fonts.bold, fontSize: 10, color: theme.textLight },

  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: theme.infoLight,
    padding: 14,
    borderRadius: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(25,118,210,0.15)",
  },
  infoCardText: { ...fonts.medium, fontSize: 13, color: theme.info, flex: 1, lineHeight: 19 },
});
