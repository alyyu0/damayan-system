import { StyleSheet, Platform } from "react-native";
import { theme, fonts } from "../theme";

export const siteManagerStyles = StyleSheet.create({
  // ─── Shell ───────────────────────────────────────────────────────────────
  shell: {
    flex: 1,
    backgroundColor: theme.bg,
  },
  scrollContent: {
    paddingBottom: 140,
  },

  // ─── Heroes ──────────────────────────────────────────────────────────────
  primaryHero: {
    backgroundColor: theme.primary,
    borderRadius: 40,
    padding: 32,
    gap: 16,
    marginHorizontal: 24,
    marginTop: 10,
    shadowColor: theme.primary,
    shadowOpacity: 0.3,
    shadowRadius: 25,
    shadowOffset: { width: 0, height: 15 },
    elevation: 10,
    position: "relative",
    overflow: "hidden",
  },
  heroGradient: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    opacity: 0.1,
  },
  heroTitle: {
    color: "#ffffff",
    fontSize: 34,
    ...fonts.black,
    letterSpacing: -1.5,
    lineHeight: 40,
  },
  heroText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 15,
    lineHeight: 24,
    ...fonts.medium,
  },

  // ─── Section Headers ─────────────────────────────────────────────────────
  sectionTitle: {
    fontSize: 22,
    ...fonts.black,
    color: theme.text,
    letterSpacing: -0.5,
  },
  sectionSub: {
    fontSize: 13,
    color: theme.textLight,
    ...fonts.bold,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginTop: 4,
  },

  // ─── Metric Cards ────────────────────────────────────────────────────────
  metricRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  metricCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    padding: 16,
    borderRadius: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  metricValue: {
    fontSize: 26,
    ...fonts.black,
    color: "#fff",
  },
  metricLabel: {
    fontSize: 10,
    ...fonts.bold,
    color: "rgba(255,255,255,0.7)",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 2,
  },

  // ─── Operational Swimlane ────────────────────────────────────────────────
  swimlane: {
    backgroundColor: theme.surface,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: theme.line,
  },
  swimScroll: {
    paddingHorizontal: 24,
    gap: 24,
  },
  swimItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  swimDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.success,
  },
  swimLabel: {
    fontSize: 10,
    ...fonts.black,
    color: theme.textLight,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  swimValue: {
    fontSize: 14,
    ...fonts.bold,
    color: theme.text,
  },

  // ─── Checklist ───────────────────────────────────────────────────────────
  checkCard: {
    backgroundColor: theme.surface,
    borderRadius: 32,
    padding: 24,
    borderWidth: 1.5,
    borderColor: theme.line,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    paddingVertical: 14,
  },
  checkIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.line,
  },
  checkLabel: {
    flex: 1,
    fontSize: 16,
    ...fonts.bold,
    color: theme.text,
  },

  // ─── Inventory ───────────────────────────────────────────────────────────
  inventoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  inventoryCard: {
    width: "48%",
    backgroundColor: theme.surfaceAlt,
    borderRadius: 24,
    padding: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: theme.line,
  },
  inventoryIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  inventoryLevel: {
    fontSize: 22,
    ...fonts.black,
    color: theme.text,
  },
  inventoryName: {
    fontSize: 13,
    color: theme.textMuted,
    ...fonts.bold,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  // ─── Activity Log ────────────────────────────────────────────────────────
  activityItem: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 24,
  },
  activityTime: {
    width: 60,
    fontSize: 12,
    ...fonts.black,
    color: theme.textLight,
    paddingTop: 4,
  },
  activityIndicator: {
    alignItems: "center",
    width: 20,
  },
  activityDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.primary,
    borderWidth: 2,
    borderColor: "#fff",
    zIndex: 2,
  },
  activityLine: {
    position: "absolute",
    top: 12,
    bottom: -24,
    width: 2,
    backgroundColor: theme.line,
  },
  activityContent: {
    flex: 1,
    backgroundColor: theme.surfaceAlt,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.line,
  },
  activityTitle: {
    fontSize: 15,
    ...fonts.black,
    color: theme.text,
  },
  activityDesc: {
    fontSize: 13,
    color: theme.textMuted,
    marginTop: 4,
    lineHeight: 18,
    ...fonts.medium,
  },

  // ─── Scanner (Operations) ────────────────────────────────────────────────
  scannerHero: {
    height: 240,
    borderRadius: 40,
    backgroundColor: theme.text,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  scannerOverlay: {
    position: "absolute",
    top: 40, bottom: 40, left: 40, right: 40,
    borderWidth: 2,
    borderColor: theme.primary,
    borderRadius: 20,
    borderStyle: "dashed",
    opacity: 0.5,
  },
  scannerBeam: {
    position: "absolute",
    height: 2,
    left: 40, right: 40,
    backgroundColor: theme.primary,
    shadowColor: theme.primary,
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  
  // ─── Distribution Grid ──────────────────────────────────────────────────
  distroCard: {
    backgroundColor: theme.surface,
    borderRadius: 28,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: theme.line,
  },
  distroIconBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  distroInfo: {
    flex: 1,
  },
  distroLabel: {
    fontSize: 11,
    ...fonts.black,
    color: theme.textLight,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  distroTitle: {
    fontSize: 18,
    ...fonts.black,
    color: theme.text,
    marginTop: 2,
  },
  distroStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  distroCount: {
    fontSize: 13,
    ...fonts.bold,
    color: theme.textMuted,
  },
});
