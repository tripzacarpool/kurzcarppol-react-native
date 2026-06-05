import React, { useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  Phone,
  Share2,
  Shield,
  X,
} from 'lucide-react-native';
import { Colors } from '@/constants/Colors';

interface SafetyToolkitProps {
  visible: boolean;
  onClose: () => void;
  onShareTrip: () => void;
  onOpenSOS: () => void;
  onEmergencyCall: () => void;
  onReportIssue: () => void;
  hasTripShared?: boolean;
}

export default function SafetyToolkit({
  visible,
  onClose,
  onShareTrip,
  onOpenSOS,
  onEmergencyCall,
  onReportIssue,
  hasTripShared = false,
}: SafetyToolkitProps) {
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  const tools = [
    {
      id: 'share_trip',
      title: 'Share Trip',
      icon: <Share2 size={24} color={Colors.dark.gold} />,
      description: 'Share ride details with emergency contacts',
      color: Colors.dark.gold,
      status: hasTripShared ? 'shared' : 'ready',
      action: onShareTrip,
      details:
        'Share driver info, vehicle number, and live location with your emergency contacts via WhatsApp, SMS, or direct call.',
    },
    {
      id: 'emergency_call',
      title: 'Emergency Call',
      icon: <Phone size={24} color={Colors.dark.warning} />,
      description: 'Call 112 emergency services',
      color: Colors.dark.warning,
      status: 'ready',
      action: onEmergencyCall,
      details:
        'Call emergency services directly. Keep your ride details visible so you can share them with responders.',
    },
    {
      id: 'report_issue',
      title: 'Report Issue',
      icon: <AlertCircle size={24} color={Colors.dark.warning} />,
      description: 'Report a problem during the ride',
      color: Colors.dark.warning,
      status: 'ready',
      action: onReportIssue,
      details:
        'Report unsafe driving, wrong route, misbehavior, or any safety concern to the support team.',
    },
    {
      id: 'sos',
      title: 'SOS Alert',
      icon: <AlertTriangle size={24} color={Colors.dark.error} />,
      description: 'Emergency SOS for critical situations',
      color: Colors.dark.error,
      status: 'ready',
      action: onOpenSOS,
      details:
        'Send an immediate alert to Tripza support, saved emergency contacts, and ride participants.',
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <Shield size={28} color={Colors.dark.gold} />
              <View style={styles.headerCopy}>
                <Text style={styles.headerTitle}>Safety Toolkit</Text>
                <Text style={styles.headerSubtitle}>
                  Tools available during your ride
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={Colors.dark.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.toolsList}>
            {tools.map((tool) => (
              <View key={tool.id} style={styles.toolCard}>
                <TouchableOpacity
                  onPress={() =>
                    setExpandedItem(expandedItem === tool.id ? null : tool.id)
                  }
                  activeOpacity={0.7}
                  style={styles.toolHeader}
                >
                  <View
                    style={[
                      styles.toolIconContainer,
                      { borderLeftColor: tool.color },
                    ]}
                  >
                    {tool.icon}
                  </View>

                  <View style={styles.toolInfo}>
                    <View style={styles.toolTitleRow}>
                      <Text style={styles.toolTitle} numberOfLines={1}>
                        {tool.title}
                      </Text>
                      {tool.status === 'shared' && (
                        <View style={styles.statusBadge}>
                          <Check size={12} color="white" />
                          <Text style={styles.statusText}>Shared</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.toolDescription} numberOfLines={2}>
                      {tool.description}
                    </Text>
                  </View>
                </TouchableOpacity>

                {expandedItem === tool.id && (
                  <View style={styles.toolDetails}>
                    <Text style={styles.detailsText}>{tool.details}</Text>
                    <TouchableOpacity
                      style={[styles.useButton, { backgroundColor: tool.color }]}
                      onPress={() => {
                        tool.action();
                        setExpandedItem(null);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.useButtonText}>Use {tool.title}</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ))}
          </ScrollView>

          <View style={styles.safetyTips}>
            <Text style={styles.tipsTitle}>Safety Tips</Text>
            <Text style={styles.tipText}>
              Share your trip with trusted contacts before the ride starts.
            </Text>
            <Text style={styles.tipText}>
              Keep your phone charged and location notifications enabled.
            </Text>
            <Text style={styles.tipText}>
              In case of emergency, call 112 immediately.
            </Text>
          </View>

          <TouchableOpacity
            style={styles.closeToolkitButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text style={styles.closeToolkitButtonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    backgroundColor: Colors.dark.card,
    borderRadius: 16,
    maxHeight: '92%',
    width: '100%',
    maxWidth: 520,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border + '30',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
    minWidth: 0,
  },
  headerCopy: {
    flex: 1,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginTop: 2,
  },
  closeButton: {
    padding: 8,
    marginRight: -8,
  },
  toolsList: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxHeight: '50%',
  },
  toolCard: {
    backgroundColor: Colors.dark.background,
    borderRadius: 12,
    marginVertical: 6,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.dark.border + '40',
  },
  toolHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
  },
  toolIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: Colors.dark.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
    borderLeftWidth: 3,
  },
  toolInfo: {
    flex: 1,
    minWidth: 0,
  },
  toolTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 8,
  },
  toolTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.success,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    gap: 3,
  },
  statusText: {
    color: 'white',
    fontSize: 10,
    fontWeight: '600',
  },
  toolDescription: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  toolDetails: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border + '20',
    backgroundColor: Colors.dark.background,
  },
  detailsText: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    lineHeight: 18,
    marginBottom: 12,
  },
  useButton: {
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
  },
  useButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 14,
  },
  safetyTips: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.dark.card,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border + '30',
  },
  tipsTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.dark.gold,
    marginBottom: 8,
  },
  tipText: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    marginBottom: 5,
    lineHeight: 16,
  },
  closeToolkitButton: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: Colors.dark.border,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  closeToolkitButtonText: {
    color: Colors.dark.text,
    fontWeight: '600',
    fontSize: 14,
  },
});
