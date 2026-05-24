import { StyleSheet } from "react-native";
import { theme, fonts } from "../../theme";

export const styles = StyleSheet.create({
  laser: {
    position: "absolute",
    top: 0,
    left: 20,
    right: 20,
    height: 2,
    backgroundColor: theme.success,
    shadowColor: theme.success,
    shadowRadius: 8,
    shadowOpacity: 1,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  corner: {
    position: "absolute",
    width: 24,
    height: 24,
    borderColor: theme.success,
  },
  tl: { top: 16, left: 16, borderTopWidth: 3, borderLeftWidth: 3 },
  tr: { top: 16, right: 16, borderTopWidth: 3, borderRightWidth: 3 },
  bl: { bottom: 16, left: 16, borderBottomWidth: 3, borderLeftWidth: 3 },
  br: { bottom: 16, right: 16, borderBottomWidth: 3, borderRightWidth: 3 },
  
  // Incident Report Styles
  incidentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  severityRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  severityBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: theme.line,
  },
  severityLabel: {
    fontSize: 12,
    ...fonts.extrabold,
    textTransform: "uppercase",
  },
  typePicker: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: theme.surfaceSoft,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.line,
    marginTop: 8,
  },
  manualWrap: {
    gap: 10,
  },
});
