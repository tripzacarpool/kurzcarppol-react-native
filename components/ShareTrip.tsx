import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import {
  X,
  Send,
  Phone,
  Copy,
  MapPin,
  User,
  Car,
  Clock,
} from 'lucide-react-native';
import { Colors } from '@/constants/Colors';

interface TripDetails {
  driverName: string;
  driverPhone: string;
  vehicleNumber: string;
  pickupLocation: string;
  dropoffLocation: string;
  currentLocation?: { latitude: number; longitude: number };
  eta?: string;
}

interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
}

interface ShareTripProps {
  visible: boolean;
  onClose: () => void;
  tripDetails: TripDetails;
  emergencyContacts: EmergencyContact[];
  googleMapsLink?: string;
  onTripShared?: () => void;
}

export default function ShareTrip({
  visible,
  onClose,
  tripDetails,
  emergencyContacts,
  googleMapsLink,
  onTripShared,
}: ShareTripProps) {
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [shareMethod, setShareMethod] = useState<string>('whatsapp');
  const [loading, setLoading] = useState(false);

  const generateTripMessage = () => {
    const liveLocation = googleMapsLink
      ? `\n📍 Live Location: ${googleMapsLink}`
      : '';

    return `🚗 *Trip Details*\n\n*Driver:* ${tripDetails.driverName}\n*Phone:* ${tripDetails.driverPhone}\n*Vehicle:* ${tripDetails.vehicleNumber}\n\n*Route:*\n📍 From: ${tripDetails.pickupLocation}\n📍 To: ${tripDetails.dropoffLocation}${liveLocation}\n\n⚠️ I'm sharing my trip details for safety. Stay in touch!`;
  };

  const handleSelectContact = (contactId: string) => {
    setSelectedContacts((prev) =>
      prev.includes(contactId)
        ? prev.filter((id) => id !== contactId)
        : [...prev, contactId],
    );
  };

  const handleShareViaWhatsApp = async (phone: string) => {
    try {
      const message = encodeURIComponent(generateTripMessage());
      const whatsappUrl = `whatsapp://send?phone=${phone}&text=${message}`;
      await Linking.openURL(whatsappUrl);
    } catch {
      Alert.alert('Error', 'WhatsApp is not installed');
    }
  };

  const handleShareViaSMS = async (phone: string) => {
    try {
      const message = generateTripMessage().replace(/\*/g, '').replace(/\n/g, '%0A');
      const smsUrl = `sms:${phone}?body=${message}`;
      await Linking.openURL(smsUrl);
    } catch {
      Alert.alert('Error', 'Failed to open SMS');
    }
  };

  const handleCallContact = (phone: string, name: string) => {
    Alert.alert('Call', `Call ${name}?`, [
      { text: 'Cancel' },
      {
        text: 'Call',
        onPress: () => Linking.openURL(`tel:${phone}`),
      },
    ]);
  };

  const handleShareAll = async () => {
    if (selectedContacts.length === 0) {
      Alert.alert('Select Contacts', 'Please select at least one contact');
      return;
    }

    try {
      setLoading(true);

      const selected = emergencyContacts.filter((c) =>
        selectedContacts.includes(c.id),
      );

      if (shareMethod === 'whatsapp') {
        for (const contact of selected) {
          await handleShareViaWhatsApp(contact.phone);
          // Small delay to prevent rapid API calls
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } else if (shareMethod === 'sms') {
        for (const contact of selected) {
          await handleShareViaSMS(contact.phone);
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      Alert.alert('Success', `Trip shared with ${selected.length} contact(s)`);
      onTripShared?.();
      onClose();
    } catch {
      Alert.alert('Error', 'Failed to share trip');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyDetails = () => {
    const tripInfo = generateTripMessage();
    Alert.alert('Copy Ride Details', tripInfo, [
      { text: 'Cancel' },
      {
        text: 'Copy',
        onPress: () => {
          // Note: React Native doesn't have native clipboard copy, 
          // but we show the message for user to copy manually
          Alert.alert('Message ready to copy:\n' + tripInfo);
        },
      },
    ]);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerText}>Share Trip Details</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={Colors.dark.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Trip Summary */}
            <View style={styles.tripSummary}>
              <View style={styles.tripItem}>
                <User size={16} color={Colors.dark.gold} />
                <Text style={styles.tripItemText}>
                  Driver: {tripDetails.driverName}
                </Text>
              </View>
              <View style={styles.tripItem}>
                <Car size={16} color={Colors.dark.gold} />
                <Text style={styles.tripItemText}>
                  Vehicle: {tripDetails.vehicleNumber}
                </Text>
              </View>
              <View style={styles.tripItem}>
                <MapPin size={16} color={Colors.dark.gold} />
                <Text style={styles.tripItemText} numberOfLines={2}>
                  {tripDetails.pickupLocation} → {tripDetails.dropoffLocation}
                </Text>
              </View>
              {tripDetails.eta && (
                <View style={styles.tripItem}>
                  <Clock size={16} color={Colors.dark.gold} />
                  <Text style={styles.tripItemText}>ETA: {tripDetails.eta}</Text>
                </View>
              )}
            </View>

            {/* Share Method Selection */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📤 Share Via</Text>
              <View style={styles.shareMethodContainer}>
                {[
                  { id: 'whatsapp', label: 'WhatsApp', icon: '💬' },
                  { id: 'sms', label: 'SMS', icon: '✉️' },
                  { id: 'call', label: 'Call', icon: '☎️' },
                ].map((method) => (
                  <TouchableOpacity
                    key={method.id}
                    style={[
                      styles.shareMethodButton,
                      shareMethod === method.id &&
                        styles.shareMethodButtonActive,
                    ]}
                    onPress={() => setShareMethod(method.id)}>
                    <Text style={styles.shareMethodIcon}>{method.icon}</Text>
                    <Text style={styles.shareMethodLabel}>{method.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Select Contacts */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                👥 Emergency Contacts ({selectedContacts.length})
              </Text>
              {emergencyContacts.length === 0 ? (
                <View style={styles.noContactsMessage}>
                  <Text style={styles.noContactsText}>
                    No emergency contacts added. Add them in safety settings.
                  </Text>
                </View>
              ) : (
                emergencyContacts.map((contact) => (
                  <TouchableOpacity
                    key={contact.id}
                    style={[
                      styles.contactItem,
                      selectedContacts.includes(contact.id) &&
                        styles.contactItemSelected,
                    ]}
                    onPress={() => handleSelectContact(contact.id)}>
                    <View style={styles.contactCheckbox}>
                      {selectedContacts.includes(contact.id) && (
                        <View style={styles.contactCheckboxInner} />
                      )}
                    </View>
                    <View style={styles.contactInfo}>
                      <Text style={styles.contactName}>{contact.name}</Text>
                      <Text style={styles.contactRelationship}>
                        {contact.relationship} • {contact.phone}
                      </Text>
                    </View>
                    {shareMethod === 'call' && (
                      <TouchableOpacity
                        onPress={() =>
                          handleCallContact(contact.phone, contact.name)
                        }
                        style={styles.callButton}>
                        <Phone size={18} color={Colors.dark.gold} />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                ))
              )}
            </View>

            {/* Copy Details Button */}
            <TouchableOpacity
              style={styles.copyButton}
              onPress={handleCopyDetails}>
              <Copy size={18} color={Colors.dark.gold} />
              <Text style={styles.copyButtonText}>Copy Trip Details</Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Share Button */}
          <TouchableOpacity
            style={[
              styles.shareButton,
              (loading || selectedContacts.length === 0) &&
                styles.shareButtonDisabled,
            ]}
            onPress={handleShareAll}
            disabled={loading || selectedContacts.length === 0}
            activeOpacity={0.7}>
            {loading ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <>
                <Send size={18} color="white" />
                <Text style={styles.shareButtonText}>
                  Share with {selectedContacts.length} Contact
                  {selectedContacts.length !== 1 ? 's' : ''}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: Colors.dark.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
    maxHeight: '95%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  closeButton: {
    padding: 8,
  },
  tripSummary: {
    backgroundColor: Colors.dark.background,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: Colors.dark.gold,
  },
  tripItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 10,
  },
  tripItemText: {
    color: Colors.dark.text,
    fontSize: 13,
    flex: 1,
    fontWeight: '500',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 12,
  },
  shareMethodContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 10,
  },
  shareMethodButton: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.dark.border,
  },
  shareMethodButtonActive: {
    borderColor: Colors.dark.gold,
    backgroundColor: Colors.dark.gold + '15',
  },
  shareMethodIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  shareMethodLabel: {
    color: Colors.dark.text,
    fontSize: 12,
    fontWeight: '600',
  },
  noContactsMessage: {
    backgroundColor: Colors.dark.background,
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  noContactsText: {
    color: Colors.dark.textSecondary,
    fontSize: 13,
    textAlign: 'center',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.background,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: Colors.dark.border,
  },
  contactItemSelected: {
    borderColor: Colors.dark.gold,
    backgroundColor: Colors.dark.gold + '10',
  },
  contactCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.dark.gold,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contactCheckboxInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.dark.gold,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    color: Colors.dark.text,
    fontWeight: '600',
    fontSize: 13,
  },
  contactRelationship: {
    color: Colors.dark.textSecondary,
    fontSize: 11,
    marginTop: 3,
  },
  callButton: {
    padding: 8,
    marginLeft: 8,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.background,
    borderRadius: 10,
    paddingVertical: 12,
    marginBottom: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.dark.gold + '50',
  },
  copyButtonText: {
    color: Colors.dark.gold,
    fontWeight: '600',
    fontSize: 14,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.dark.gold,
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  shareButtonDisabled: {
    opacity: 0.5,
  },
  shareButtonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 14,
  },
});
