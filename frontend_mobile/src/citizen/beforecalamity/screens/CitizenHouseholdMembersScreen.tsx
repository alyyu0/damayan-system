import React, { useState } from "react";
import {
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CitizenBottomNav } from "../../shared";
import { theme, fonts } from "../../../theme";
import { styles } from "../styles/CitizenHouseholdMembersScreen.styles";

const relationshipOptions = ["Spouse", "Child", "Parent", "Sibling", "Other"];
const quickNeeds = [
  { id: "wheelchair", icon: "accessibility" as const, label: "Wheelchair" },
  { id: "medication", icon: "medical" as const, label: "Medication" },
  { id: "infant", icon: "happy" as const, label: "Infant Care" },
  { id: "elderly", icon: "person" as const, label: "Elderly" },
];

export function CitizenHouseholdMembersScreen({
  onBack,
  onContinue,
}: {
  onBack: () => void;
  onContinue: () => void;
}) {
  const [active] = useState<"home" | "relief" | "qr" | "profile">("home");
  const [relationship, setRelationship] = useState("");
  const [selectedNeeds, setSelectedNeeds] = useState<string[]>([]);

  function toggleNeed(needId: string) {
    setSelectedNeeds((current) =>
      current.includes(needId)
        ? current.filter((id) => id !== needId)
        : [...current, needId],
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {/* Top Bar */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Pressable onPress={onBack} style={styles.iconButton}>
            <Ionicons name="arrow-back" size={22} color={theme.text} />
          </Pressable>
          <Text style={styles.topTitle}>Household Registration</Text>
        </View>
        <Text style={styles.brand}>DAMAYAN</Text>
      </View>

      {/* Hero */}
      <View style={styles.heroSection}>
        <View style={styles.stepBadge}>
          <Text style={styles.stepBadgeText}>Step 2 of 4</Text>
        </View>
        <Text style={styles.heroTitle}>
          Register for my{"\n"}
          <Text style={styles.heroAccent}>Household</Text>
        </Text>
        <Text style={styles.heroCopy}>
          Provide details for each person currently residing with you. This
          ensures appropriate aid distribution and medical prioritization during
          recovery efforts.
        </Text>
      </View>

      {/* Current Head Member Card */}
      <View style={styles.memberCard}>
        <View style={styles.memberHeader}>
          <View>
            <Text style={styles.memberLabel}>Member 01</Text>
            <Text style={styles.memberTitle}>Household Representative</Text>
          </View>
          <View style={styles.memberStatusBadge}>
            <Ionicons name="checkmark-circle" size={16} color={theme.primary} />
            <Text style={styles.memberStatus}>Verified</Text>
          </View>
        </View>

        <View style={styles.memberGrid}>
          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>Full Name</Text>
            <View style={styles.staticField}>
              <Text style={styles.staticFieldText}>Samuel Aristha</Text>
            </View>
          </View>
          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>Relationship</Text>
            <View style={styles.staticField}>
              <Text style={styles.staticFieldText}>Self (Head)</Text>
            </View>
          </View>
        </View>
      </View>

      {/* New Member Card */}
      <View style={styles.newMemberCard}>
        <View style={styles.newMemberHeader}>
          <View style={styles.memberNumber}>
            <Text style={styles.memberNumberText}>2</Text>
          </View>
          <View>
            <Text style={styles.newMemberLabel}>Add Member</Text>
            <Text style={styles.newMemberTitle}>New Family Member</Text>
          </View>
        </View>

        <View style={styles.formGrid}>
          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>Full Legal Name</Text>
            <TextInput
              placeholder="e.g. Maria Aristha"
              placeholderTextColor="#7d867b"
              style={styles.inputField}
            />
          </View>

          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>Relationship to Head</Text>
            <View style={styles.relationshipRow}>
              {relationshipOptions.map((option) => (
                <Pressable
                  key={option}
                  onPress={() => setRelationship(option)}
                  style={[
                    styles.relationshipChip,
                    relationship === option && styles.relationshipChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.relationshipChipText,
                      relationship === option && styles.relationshipChipTextActive,
                    ]}
                  >
                    {option}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.fieldWrap}>
            <Text style={styles.fieldLabel}>Age</Text>
            <TextInput
              placeholder="Years"
              placeholderTextColor="#7d867b"
              keyboardType="number-pad"
              style={styles.inputField}
            />
          </View>
        </View>

        {/* Quick Accessibility Needs */}
        <View style={styles.quickSelectSection}>
          <Text style={styles.fieldLabel}>Quick Select Accessibility Needs</Text>
          <View style={styles.quickSelectRow}>
            {quickNeeds.map((need) => {
              const selected = selectedNeeds.includes(need.id);
              return (
                <Pressable
                  key={need.id}
                  onPress={() => toggleNeed(need.id)}
                  style={[
                    styles.needChip,
                    selected && styles.needChipActive,
                  ]}
                >
                  <Ionicons
                    name={need.icon}
                    size={16}
                    color={selected ? "#fff" : theme.textMuted}
                  />
                  <Text
                    style={[
                      styles.needChipText,
                      selected && styles.needChipTextActive,
                    ]}
                  >
                    {need.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      {/* Action Row */}
      <View style={styles.actionRow}>
        <Pressable style={styles.secondaryButton}>
          <Ionicons name="add" size={20} color={theme.text} />
          <Text style={styles.secondaryButtonText}>Add Another Member</Text>
        </Pressable>

        <Pressable onPress={onContinue} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Complete Household</Text>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </Pressable>
      </View>

      {/* Info Sidebar */}
      <View style={styles.sidebarCard}>
        <Ionicons name="information-circle" size={24} color={theme.primary} />
        <Text style={styles.sidebarTitle}>Why this matters</Text>
        <Text style={styles.sidebarCopy}>
          Accurate household data helps emergency responders calculate food
          ratios, medical supply distribution, and specialized transport needs
          for your specific location.
        </Text>
      </View>

      {/* Privacy Card */}
      <View style={styles.privacyCard}>
        <View style={styles.privacyHeader}>
          <Ionicons name="shield-checkmark" size={20} color="#7e5700" />
          <Text style={styles.privacyTitle}>Privacy Policy</Text>
        </View>
        <Text style={styles.privacyCopy}>
          Your family data is encrypted and only shared with verified
          humanitarian response organizations. We never share sensitive medical
          data with third parties.
        </Text>
      </View>

      <CitizenBottomNav active={active} />
    </ScrollView>
  );
}
