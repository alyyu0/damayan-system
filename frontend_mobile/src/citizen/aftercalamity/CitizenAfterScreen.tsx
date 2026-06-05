import { useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import { theme, fonts } from "../../theme";
import { checkOutByQrCode, type AppNotification } from "../../api";

type AfterStep = "relief_claim" | "all_clear" | "exit_decision" | "final_credentials" | "end";

interface CitizenAfterScreenProps {
  onBack: () => void;
  qrCodeId?: string | null;
  citizenName?: string;
  session?: any;
  notifications?: AppNotification[];
}

export default function CitizenAfterScreen({
  onBack,
  qrCodeId,
  citizenName,
  session,
  notifications = [],
}: Readonly<CitizenAfterScreenProps>) {
  const [step, setStep] = useState<AfterStep>("relief_claim");
  const [leaving, setLeaving] = useState<boolean | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);

  // All-clear is considered confirmed once the system is in after-phase (parent already
  // switched us here). Optionally surface a specific notification if present.
  const allClearNotif = notifications.find(
    (n) => n.type === "system" && n.title?.toLowerCase().includes("all clear"),
  );

  async function handleConfirmExit() {
    if (!leaving) {
      setStep("end");
      return;
    }
    setCheckingOut(true);
    try {
      if (session?.accessToken && qrCodeId) {
        await checkOutByQrCode(session.accessToken, qrCodeId);
      }
    } catch {
      // non-fatal — citizen is physically leaving regardless
    } finally {
      setCheckingOut(false);
      setStep("final_credentials");
    }
  }

  const qrValue = qrCodeId ?? "DAMAYAN-ID";
  const displayName = citizenName ?? "Citizen";

  const renderStep = () => {
    switch (step) {
      case "relief_claim":
        return (
          <View style={styles.stepContainer}>
            <View style={styles.card}>
              <View style={[styles.iconCircle, { backgroundColor: theme.primarySoft }]}>
                <Ionicons name="gift" size={36} color={theme.primary} />
              </View>
              <Text style={styles.title}>Claim Relief Pack</Text>
              <Text style={styles.desc}>
                Show your QR code at the distribution point to claim your allocated relief resources.
              </Text>

              {/* Live QR for relief claim scanning */}
              <View style={styles.qrBox}>
                <QRCode value={qrValue} size={140} color="#0F6E56" backgroundColor="#fff" />
                <Text style={styles.qrLabel}>{displayName.toUpperCase()}</Text>
                <Text style={styles.qrCode}>{qrCodeId ?? "—"}</Text>
              </View>

              <View style={styles.statusList}>
                <View style={styles.statusItem}>
                  <Ionicons name="checkmark-circle" size={24} color={theme.primary} />
                  <Text style={styles.statusText}>Digital ID Verified</Text>
                </View>
                <View style={styles.statusItem}>
                  <Ionicons name="time" size={24} color={theme.warning} />
                  <Text style={styles.statusText}>Present QR to staff for scanning</Text>
                </View>
              </View>

              <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep("all_clear")}>
                <Ionicons name="arrow-forward" size={22} color="#fff" />
                <Text style={styles.btnText}>RELIEF RECEIVED — CONTINUE</Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case "all_clear":
        return (
          <View style={styles.stepContainer}>
            <View style={[styles.card, { borderColor: theme.primary, borderWidth: 1.5 }]}>
              <View style={[styles.iconCircle, { backgroundColor: "rgba(46,125,50,0.1)" }]}>
                <Ionicons name="notifications-circle" size={36} color={theme.primary} />
              </View>
              <Text style={styles.title}>All Clear Issued</Text>
              <Text style={styles.desc}>
                Authorities have declared your sector safe. You may now prepare to return to your residence.
              </Text>

              {allClearNotif && (
                <View style={styles.notifBox}>
                  <Ionicons name="megaphone" size={18} color={theme.primary} />
                  <Text style={styles.notifText}>{allClearNotif.body}</Text>
                </View>
              )}

              <View style={styles.infoBox}>
                <Ionicons name="warning" size={16} color="#8f5d00" />
                <Text style={styles.infoText}>
                  Utilities (Power/Water) may still be stabilising in some areas.
                </Text>
              </View>

              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
                onPress={() => setStep("exit_decision")}
              >
                <Text style={styles.btnText}>ACKNOWLEDGE & CONTINUE</Text>
                <Ionicons name="arrow-forward" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        );

      case "exit_decision":
        return (
          <View style={styles.stepContainer}>
            <View style={styles.card}>
              <View style={[styles.iconCircle, { backgroundColor: theme.primarySoft }]}>
                <Ionicons name="help-circle" size={36} color={theme.primary} />
              </View>
              <Text style={styles.title}>Leaving Center?</Text>
              <Text style={styles.desc}>
                Are you planning to check out from the evacuation facility now that the All-Clear has been issued?
              </Text>

              <View style={styles.btnRow}>
                <Pressable
                  style={[styles.choiceBtn, leaving === false && styles.choiceBtnActive]}
                  onPress={() => setLeaving(false)}
                >
                  <Ionicons name="home" size={32} color={leaving === false ? "#fff" : theme.textMuted} />
                  <Text style={[styles.choiceText, leaving === false && { color: "#fff" }]}>STAY{"\n"}LONGER</Text>
                </Pressable>

                <Pressable
                  style={[styles.choiceBtn, leaving === true && styles.choiceBtnActive]}
                  onPress={() => setLeaving(true)}
                >
                  <Ionicons name="exit" size={32} color={leaving === true ? "#fff" : theme.textMuted} />
                  <Text style={[styles.choiceText, leaving === true && { color: "#fff" }]}>LEAVE{"\n"}NOW</Text>
                </Pressable>
              </View>

              <TouchableOpacity
                disabled={leaving === null || checkingOut}
                style={[styles.primaryBtn, (leaving === null || checkingOut) && { opacity: 0.5 }]}
                onPress={handleConfirmExit}
              >
                {checkingOut
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnText}>CONFIRM DECISION</Text>}
              </TouchableOpacity>
            </View>
          </View>
        );

      case "final_credentials":
        return (
          <View style={styles.stepContainer}>
            <View style={styles.card}>
              <View style={[styles.iconCircle, { backgroundColor: theme.primarySoft }]}>
                <Ionicons name="id-card" size={36} color={theme.primary} />
              </View>
              <Text style={styles.title}>Final Exit Check</Text>
              <Text style={styles.desc}>
                Present your QR ID to the gate coordinator. Your check-out has been recorded in the system.
              </Text>

              {/* Real QR code for gate scan */}
              <View style={styles.qrBox}>
                <QRCode value={qrValue} size={140} color="#0F6E56" backgroundColor="#fff" />
                <Text style={styles.qrLabel}>{displayName.toUpperCase()}</Text>
                <Text style={styles.qrCode}>{qrCodeId ?? "—"}</Text>
              </View>

              <TouchableOpacity style={styles.primaryBtn} onPress={() => setStep("end")}>
                <Text style={styles.btnText}>FINALIZE CHECKOUT</Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case "end":
        return (
          <View style={styles.stepContainer}>
            <View style={styles.card}>
              <View style={[styles.iconCircle, { backgroundColor: theme.primarySoft }]}>
                <Ionicons name="heart" size={36} color={theme.primary} />
              </View>
              <Text style={styles.title}>Safe Travels</Text>
              <Text style={styles.desc}>
                Your records have been updated. We wish you a safe return home. Stay vigilant!
              </Text>
              <TouchableOpacity style={styles.secondaryBtn} onPress={onBack}>
                <Text style={styles.secondaryBtnText}>BACK TO DASHBOARD</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Recovery Flow</Text>
          <Text style={styles.headerSub}>Follow the steps to ensure a safe transition.</Text>
        </View>
        {renderStep()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  scrollContent: { padding: 24, paddingBottom: 160 },
  header: { marginBottom: 28, paddingHorizontal: 8 },
  headerTitle: { ...fonts.black, fontSize: 28, color: theme.text, letterSpacing: -1 },
  headerSub: { ...fonts.medium, fontSize: 14, color: theme.textLight, marginTop: 4, lineHeight: 22 },
  stepContainer: { flex: 1 },
  card: {
    padding: 28,
    alignItems: "center",
    borderRadius: 36,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.line,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 20,
    gap: 20,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { ...fonts.black, fontSize: 24, color: theme.text, textAlign: "center", letterSpacing: -0.8 },
  desc: { ...fonts.medium, fontSize: 14, color: theme.textMuted, textAlign: "center", lineHeight: 22 },
  qrBox: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 28,
    padding: 24,
    width: "100%",
    borderWidth: 1,
    borderColor: theme.line,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 16,
    gap: 10,
  },
  qrLabel: { ...fonts.black, fontSize: 13, color: theme.text, letterSpacing: 1.5, textAlign: "center" },
  qrCode: { ...fonts.bold, fontSize: 11, color: theme.textLight, letterSpacing: 1, textAlign: "center" },
  statusList: { width: "100%", gap: 12 },
  statusItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: theme.surfaceAlt,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.line,
  },
  statusText: { ...fonts.bold, fontSize: 14, color: theme.text },
  primaryBtn: {
    width: "100%",
    height: 58,
    backgroundColor: theme.primary,
    borderRadius: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: theme.primary,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  btnText: { ...fonts.black, fontSize: 14, color: "#fff", letterSpacing: 1 },
  notifBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: theme.primarySoft,
    padding: 14,
    borderRadius: 16,
    width: "100%",
  },
  notifText: { ...fonts.bold, fontSize: 13, color: theme.primary, flex: 1, lineHeight: 19 },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "rgba(255,179,0,0.08)",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,179,0,0.2)",
    width: "100%",
  },
  infoText: { ...fonts.bold, fontSize: 13, color: "#8f5d00", flex: 1, lineHeight: 19 },
  btnRow: { flexDirection: "row", gap: 16, width: "100%" },
  choiceBtn: {
    flex: 1,
    minHeight: 120,
    borderRadius: 28,
    backgroundColor: theme.surface,
    borderWidth: 1.5,
    borderColor: theme.line,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    gap: 12,
  },
  choiceBtnActive: {
    backgroundColor: theme.primary,
    borderColor: theme.primary,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  choiceText: { ...fonts.black, fontSize: 13, color: theme.textMuted, textAlign: "center", letterSpacing: 0.5 },
  secondaryBtn: {
    width: "100%",
    padding: 18,
    alignItems: "center",
    backgroundColor: theme.surfaceAlt,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.line,
  },
  secondaryBtnText: { ...fonts.black, fontSize: 13, color: theme.primary, letterSpacing: 1 },
});
