import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  Phone,
  User,
  Heart,
  Shield,
  AlertCircle,
  Check,
} from 'lucide-react-native';
import { Colors } from '@/constants/Colors';
import { useFocusEffect } from '@react-navigation/native';

interface EmergencyContact {
  id?: string;
  name: string;
  phone: string;
  relationship: string;
}

interface SafetySettings {
  isFemale: boolean;
  womenOnlyPreference: boolean;
  autoShareTrip: boolean;
  safetyAlertsEnabled: boolean;
  primaryEmergencyContact: EmergencyContact;
  secondaryEmergencyContact?: {
    name: string;
    phone: string;
    relationship: string;
  };
  emergencyContacts: EmergencyContact[];
}

interface SafetySettingsScreenProps {
  onClose: () => void;
  onSave?: (settings: SafetySettings) => Promise<void>;
  initialSettings?: SafetySettings;
}

export default function SafetySettingsScreen({
  onClose,
  onSave,
  initialSettings,
}: SafetySettingsScreenProps) {
  const [settings, setSettings] = useState<SafetySettings>(
    initialSettings || {
      isFemale: false,
      womenOnlyPreference: false,
      autoShareTrip: true,
      safetyAlertsEnabled: true,
      primaryEmergencyContact: { name: '', phone: '', relationship: '' },
      emergencyContacts: [],
    },
  );
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSaveSettings = async () => {
    // Validate primary contact
    if (!settings.primaryEmergencyContact.name || 
        !settings.primaryEmergencyContact.phone ||
        !settings.primaryEmergencyContact.relationship) {
      setError('Please fill in all primary emergency contact fields');
      return;
    }

    const phoneRegex = /^[+]?[0-9]{10,}$/;
    if (!phoneRegex.test(settings.primaryEmergencyContact.phone.replace(/\s+/g, ''))) {
      setError('Please enter a valid phone number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      if (onSave) {
        await onSave(settings);
      }
      Alert.alert('Success', 'Safety settings saved successfully');
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const updatePrimaryContact = (field: keyof EmergencyContact, value: string) => {
    setSettings((prev) => ({
      ...prev,
      primaryEmergencyContact: {
        ...prev.primaryEmergencyContact,
        [field]: value,
      },
    }));
  };

  const updateSecondaryContact = (field: string, value: string) => {
    setSettings((prev) => ({
      ...prev,
      secondaryEmergencyContact: {
        name: field === 'name' ? value : (prev.secondaryEmergencyContact?.name || ''),
        phone: field === 'phone' ? value : (prev.secondaryEmergencyContact?.phone || ''),
        relationship: field === 'relationship' ? value : (prev.secondaryEmergencyContact?.relationship || ''),
      },
    }));
  };

  const addEmergencyContact = () => {
    const contactId = Date.now().toString();
    const newContact: EmergencyContact = {
      id: contactId,
      name: '',
      phone: '',
      relationship: '',
    };
    setSettings((prev) => ({
      ...prev,
      emergencyContacts: [...prev.emergencyContacts, newContact],
    }));
    setEditingContactId(contactId);
  };

  const updateEmergencyContact = (
    contactId: string,
    field: keyof EmergencyContact,
    value: string,
  ) => {
    setSettings((prev) => ({
      ...prev,
      emergencyContacts: prev.emergencyContacts.map((contact) =>
        contact.id === contactId ? { ...contact, [field]: value } : contact,
      ),
    }));
  };

  const deleteEmergencyContact = (contactId: string) => {
    Alert.alert(
      'Delete Contact',
      'Are you sure you want to delete this emergency contact?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            setSettings((prev) => ({
              ...prev,
              emergencyContacts: prev.emergencyContacts.filter(
                (c) => c.id !== contactId,
              ),
            }));
          },
        },
      ],
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.backButton}>
          <ArrowLeft size={24} color={Colors.dark.text} />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Shield size={28} color={Colors.dark.gold} />
          <Text style={styles.title}>Safety Settings</Text>
        </View>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <AlertCircle size={18} color={Colors.dark.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        {/* Primary Emergency Contact */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Heart size={20} color={Colors.dark.error} />
            <Text style={styles.sectionTitle}>Primary Emergency Contact *</Text>
          </View>
          <Text style={styles.sectionDescription}>
            This contact will be notified immediately during any SOS situation
          </Text>

          <View style={styles.contactForm}>
            <View style={styles.inputGroup}>
              <View style={styles.inputIcon}>
                <User size={18} color={Colors.dark.gold} />
              </View>
              <TextInput
                style={styles.input}
                placeholder="Contact Name"
                placeholderTextColor={Colors.dark.textSecondary}
                value={settings.primaryEmergencyContact.name}
                onChangeText={(text) => updatePrimaryContact('name', text)}
                editable={!loading}
              />
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.inputIcon}>
                <Phone size={18} color={Colors.dark.gold} />
              </View>
              <TextInput
                style={styles.input}
                placeholder="Phone Number"
                placeholderTextColor={Colors.dark.textSecondary}
                keyboardType="phone-pad"
                value={settings.primaryEmergencyContact.phone}
                onChangeText={(text) => updatePrimaryContact('phone', text)}
                editable={!loading}
              />
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.inputIcon}>
                <User size={18} color={Colors.dark.gold} />
              </View>
              <TextInput
                style={styles.input}
                placeholder="Relationship"
                placeholderTextColor={Colors.dark.textSecondary}
                value={settings.primaryEmergencyContact.relationship}
                onChangeText={(text) => updatePrimaryContact('relationship', text)}
                editable={!loading}
              />
            </View>
          </View>
        </View>

        {/* Secondary Emergency Contact */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Heart size={20} color={Colors.dark.gold} />
            <Text style={styles.sectionTitle}>Secondary Emergency Contact</Text>
          </View>
          <Text style={styles.sectionDescription}>
            Optional second contact for additional safety coverage
          </Text>

          <View style={styles.contactForm}>
            <View style={styles.inputGroup}>
              <View style={styles.inputIcon}>
                <User size={18} color={Colors.dark.gold} />
              </View>
              <TextInput
                style={styles.input}
                placeholder="Contact Name (Optional)"
                placeholderTextColor={Colors.dark.textSecondary}
                value={settings.secondaryEmergencyContact?.name || ''}
                onChangeText={(text) => updateSecondaryContact('name', text)}
                editable={!loading}
              />
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.inputIcon}>
                <Phone size={18} color={Colors.dark.gold} />
              </View>
              <TextInput
                style={styles.input}
                placeholder="Phone Number (Optional)"
                placeholderTextColor={Colors.dark.textSecondary}
                keyboardType="phone-pad"
                value={settings.secondaryEmergencyContact?.phone || ''}
                onChangeText={(text) => updateSecondaryContact('phone', text)}
                editable={!loading}
              />
            </View>

            <View style={styles.inputGroup}>
              <View style={styles.inputIcon}>
                <User size={18} color={Colors.dark.gold} />
              </View>
              <TextInput
                style={styles.input}
                placeholder="Relationship (Optional)"
                placeholderTextColor={Colors.dark.textSecondary}
                value={settings.secondaryEmergencyContact?.relationship || ''}
                onChangeText={(text) => updateSecondaryContact('relationship', text)}
                editable={!loading}
              />
            </View>
          </View>
        </View>

        {/* Additional Contacts */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <User size={20} color={Colors.dark.gold} />
            <Text style={styles.sectionTitle}>Additional Contacts</Text>
          </View>
          <Text style={styles.sectionDescription}>
            Add up to 5 more emergency contacts
          </Text>

          {settings.emergencyContacts.map((contact) => (
            <View key={contact.id} style={styles.contactCard}>
              {editingContactId === contact.id ? (
                <>
                  <View style={styles.inputGroup}>
                    <View style={styles.inputIcon}>
                      <User size={18} color={Colors.dark.gold} />
                    </View>
                    <TextInput
                      style={styles.input}
                      placeholder="Contact Name"
                      placeholderTextColor={Colors.dark.textSecondary}
                      value={contact.name}
                      onChangeText={(text) =>
                        updateEmergencyContact(contact.id!, 'name', text)
                      }
                      editable={!loading}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <View style={styles.inputIcon}>
                      <Phone size={18} color={Colors.dark.gold} />
                    </View>
                    <TextInput
                      style={styles.input}
                      placeholder="Phone Number"
                      placeholderTextColor={Colors.dark.textSecondary}
                      keyboardType="phone-pad"
                      value={contact.phone}
                      onChangeText={(text) =>
                        updateEmergencyContact(contact.id!, 'phone', text)
                      }
                      editable={!loading}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <View style={styles.inputIcon}>
                      <User size={18} color={Colors.dark.gold} />
                    </View>
                    <TextInput
                      style={styles.input}
                      placeholder="Relationship"
                      placeholderTextColor={Colors.dark.textSecondary}
                      value={contact.relationship}
                      onChangeText={(text) =>
                        updateEmergencyContact(contact.id!, 'relationship', text)
                      }
                      editable={!loading}
                    />
                  </View>

                  <TouchableOpacity
                    style={styles.saveContactButton}
                    onPress={() => setEditingContactId(null)}
                    disabled={loading}>
                    <Check size={18} color="white" />
                    <Text style={styles.saveContactButtonText}>Done</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.contactDisplay}>
                  <View style={styles.contactInfo}>
                    <Text style={styles.contactName}>{contact.name}</Text>
                    <Text style={styles.contactDetails}>{contact.phone}</Text>
                    <Text style={styles.contactDetails}>{contact.relationship}</Text>
                  </View>
                  <View style={styles.contactActions}>
                    <TouchableOpacity
                      onPress={() => setEditingContactId(contact.id!)}
                      disabled={loading}>
                      <Edit2 size={18} color={Colors.dark.gold} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => deleteEmergencyContact(contact.id!)}
                      disabled={loading}>
                      <Trash2 size={18} color={Colors.dark.error} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          ))}

          {settings.emergencyContacts.length < 5 && (
            <TouchableOpacity
              style={styles.addContactButton}
              onPress={addEmergencyContact}
              disabled={loading}>
              <Plus size={20} color={Colors.dark.gold} />
              <Text style={styles.addContactButtonText}>Add Another Contact</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Safety Preferences */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Shield size={20} color={Colors.dark.gold} />
            <Text style={styles.sectionTitle}>Safety Preferences</Text>
          </View>

          <View style={styles.preferenceItem}>
            <View>
              <Text style={styles.preferenceName}>Women-Only Rides</Text>
              <Text style={styles.preferenceDesc}>
                Match only with female drivers
              </Text>
            </View>
            <Switch
              value={settings.womenOnlyPreference}
              onValueChange={(value) =>
                setSettings((prev) => ({
                  ...prev,
                  womenOnlyPreference: value,
                }))
              }
              trackColor={{
                false: Colors.dark.border,
                true: Colors.dark.gold,
              }}
              thumbColor={Colors.dark.background}
              disabled={loading}
            />
          </View>

          <View style={styles.preferenceItem}>
            <View>
              <Text style={styles.preferenceName}>Auto-Share Trip</Text>
              <Text style={styles.preferenceDesc}>
                Share trip with emergency contacts automatically
              </Text>
            </View>
            <Switch
              value={settings.autoShareTrip}
              onValueChange={(value) =>
                setSettings((prev) => ({
                  ...prev,
                  autoShareTrip: value,
                }))
              }
              trackColor={{
                false: Colors.dark.border,
                true: Colors.dark.gold,
              }}
              thumbColor={Colors.dark.background}
              disabled={loading}
            />
          </View>

          <View style={styles.preferenceItem}>
            <View>
              <Text style={styles.preferenceName}>Safety Alerts</Text>
              <Text style={styles.preferenceDesc}>
                Receive real-time safety notifications
              </Text>
            </View>
            <Switch
              value={settings.safetyAlertsEnabled}
              onValueChange={(value) =>
                setSettings((prev) => ({
                  ...prev,
                  safetyAlertsEnabled: value,
                }))
              }
              trackColor={{
                false: Colors.dark.border,
                true: Colors.dark.gold,
              }}
              thumbColor={Colors.dark.background}
              disabled={loading}
            />
          </View>
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <AlertCircle size={18} color={Colors.dark.gold} />
          <Text style={styles.infoText}>
            Keep your emergency contacts updated for effective safety support during rides.
          </Text>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSaveSettings}
          disabled={loading}
          activeOpacity={0.8}>
          {loading ? (
            <ActivityIndicator color={Colors.dark.background} />
          ) : (
            <>
              <Check size={20} color={Colors.dark.background} />
              <Text style={styles.saveButtonText}>Save Safety Settings</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Close Button */}
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
          disabled={loading}>
          <Text style={styles.closeButtonText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border + '30',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.dark.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.error + '20',
    borderLeftWidth: 3,
    borderLeftColor: Colors.dark.error,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  errorText: {
    flex: 1,
    color: Colors.dark.error,
    fontSize: 13,
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  sectionDescription: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    marginBottom: 12,
  },
  contactForm: {
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border + '30',
  },
  inputGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.dark.background,
    borderRadius: 10,
    marginBottom: 12,
    paddingLeft: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border + '40',
  },
  inputIcon: {
    paddingRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    paddingRight: 12,
    color: Colors.dark.text,
    fontSize: 14,
  },
  contactCard: {
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border + '30',
  },
  contactDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 4,
  },
  contactDetails: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  contactActions: {
    flexDirection: 'row',
    gap: 12,
  },
  saveContactButton: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.success,
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  saveContactButtonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 13,
  },
  addContactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.dark.gold,
    borderRadius: 10,
    paddingVertical: 12,
    gap: 8,
  },
  addContactButtonText: {
    color: Colors.dark.gold,
    fontWeight: '600',
    fontSize: 14,
  },
  preferenceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.dark.card,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.dark.border + '30',
  },
  preferenceName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 2,
  },
  preferenceDesc: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.gold + '15',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 20,
    gap: 10,
    alignItems: 'flex-start',
  },
  infoText: {
    flex: 1,
    fontSize: 12,
    color: Colors.dark.text,
    lineHeight: 16,
  },
  saveButton: {
    flexDirection: 'row',
    backgroundColor: Colors.dark.gold,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: Colors.dark.background,
    fontWeight: '700',
    fontSize: 16,
  },
  closeButton: {
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  closeButtonText: {
    color: Colors.dark.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
});
