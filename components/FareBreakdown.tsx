import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import {
  X,
  DollarSign,
  MapPin,
  Zap,
  TrendingUp,
} from 'lucide-react-native';
import { Colors } from '@/constants/Colors';

interface FareDetails {
  baseFare: number;
  distanceCharge: number;
  distance: number; // in km
  surgePricing?: number;
  discount?: number;
  taxes: number;
  totalFare: number;
}

interface FareBreakdownProps {
  visible: boolean;
  onClose: () => void;
  pickupLocation: string;
  dropoffLocation: string;
  fareDetails: FareDetails;
  vehicleType?: string;
  eta?: string;
  onConfirm?: () => void;
}

const { width } = Dimensions.get('window');

export default function FareBreakdown({
  visible,
  onClose,
  pickupLocation,
  dropoffLocation,
  fareDetails,
  vehicleType = 'Standard',
  eta,
  onConfirm,
}: FareBreakdownProps) {
  const [highlightedRow, setHighlightedRow] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setHighlightedRow(null);
    }
  }, [visible]);

  const formatPrice = (price: number) => `₹${price.toFixed(2)}`;

  const breakdownItems = [
    {
      id: 'base',
      label: 'Base Fare',
      value: fareDetails.baseFare,
      description: 'Starting charge for the ride',
      icon: <DollarSign size={16} color={Colors.dark.gold} />,
    },
    {
      id: 'distance',
      label: 'Distance Charge',
      value: fareDetails.distanceCharge,
      description: `${fareDetails.distance.toFixed(1)} km @ rate per km`,
      icon: <MapPin size={16} color={Colors.dark.gold} />,
    },
    ...(fareDetails.surgePricing && fareDetails.surgePricing > 0
      ? [
          {
            id: 'surge',
            label: 'Peak Hours Charge',
            value: fareDetails.surgePricing,
            description: 'Applied during high demand',
            icon: <Zap size={16} color={Colors.dark.warning} />,
          },
        ]
      : []),
    ...(fareDetails.discount && fareDetails.discount > 0
      ? [
          {
            id: 'discount',
            label: 'Discount Applied',
            value: -fareDetails.discount,
            description: 'Promo or loyalty discount',
            icon: <TrendingUp size={16} color={Colors.dark.success} />,
          },
        ]
      : []),
    {
      id: 'tax',
      label: 'Taxes & Fees',
      value: fareDetails.taxes,
      description: 'Government taxes and platform fees',
      icon: <DollarSign size={16} color={Colors.dark.textSecondary} />,
    },
  ];

  const subtotal = 
    fareDetails.baseFare + 
    fareDetails.distanceCharge + 
    (fareDetails.surgePricing || 0) - 
    (fareDetails.discount || 0);

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
            <Text style={styles.title}>Fare Breakdown</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={Colors.dark.text} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.content}>
            {/* Route Summary */}
            <View style={styles.routeSummary}>
              <View style={styles.locationRow}>
                <View style={styles.locationIcon}>
                  <MapPin size={18} color={Colors.dark.gold} />
                </View>
                <View style={styles.locationText}>
                  <Text style={styles.locationLabel}>From</Text>
                  <Text style={styles.location} numberOfLines={2}>
                    {pickupLocation}
                  </Text>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.locationRow}>
                <View style={styles.locationIcon}>
                  <MapPin size={18} color={Colors.dark.pink} />
                </View>
                <View style={styles.locationText}>
                  <Text style={styles.locationLabel}>To</Text>
                  <Text style={styles.location} numberOfLines={2}>
                    {dropoffLocation}
                  </Text>
                </View>
              </View>

              {/* ETA and Vehicle Type */}
              <View style={styles.metaRow}>
                {eta && (
                  <View style={styles.metaItem}>
                    <Text style={styles.metaLabel}>ETA</Text>
                    <Text style={styles.metaValue}>{eta}</Text>
                  </View>
                )}
                <View style={styles.metaItem}>
                  <Text style={styles.metaLabel}>Vehicle</Text>
                  <Text style={styles.metaValue}>{vehicleType}</Text>
                </View>
              </View>
            </View>

            {/* Breakdown Section */}
            <View style={styles.breakdownSection}>
              <Text style={styles.breakdownTitle}>Cost Breakdown</Text>

              {breakdownItems.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.breakdownRow,
                    highlightedRow === item.id && styles.breakdownRowHighlighted,
                  ]}
                  onPress={() =>
                    setHighlightedRow(
                      highlightedRow === item.id ? null : item.id,
                    )
                  }
                  activeOpacity={0.7}>
                  <View style={styles.breakdownLeft}>
                    <View style={styles.icon}>{item.icon}</View>
                    <View style={styles.breakdownInfo}>
                      <Text style={styles.breakdownLabel}>{item.label}</Text>
                      <Text style={styles.breakdownDescription}>
                        {item.description}
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={[
                      styles.breakdownAmount,
                      item.value < 0
                        ? styles.discountAmount
                        : item.id === 'tax'
                        ? styles.taxAmount
                        : styles.normalAmount,
                    ]}>
                    {item.value < 0 ? '' : '+ '}
                    {formatPrice(Math.abs(item.value))}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Subtotal */}
            <View style={styles.subtotalSection}>
              <View style={styles.subtotalRow}>
                <Text style={styles.subtotalLabel}>Subtotal</Text>
                <Text style={styles.subtotalAmount}>
                  {formatPrice(subtotal)}
                </Text>
              </View>
              <View style={styles.dividerLine} />
            </View>

            {/* Total */}
            <View style={styles.totalSection}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total Fare</Text>
                <Text style={styles.totalAmount}>
                  {formatPrice(fareDetails.totalFare)}
                </Text>
              </View>
              <Text style={styles.totalHint}>
                ✓ This is the final price. No hidden charges.
              </Text>
            </View>

            {/* Info Box */}
            <View style={styles.infoBox}>
              <Text style={styles.infoTitle}>📍 About This Estimate</Text>
              <Text style={styles.infoText}>
                • Base fare covers the starting charge{'\n'}
                • Distance charge is calculated from route distance{'\n'}
                • Peak hours charge applies during high demand{'\n'}
                • Taxes are GST and service charges{'\n'}• Price may vary based on actual route
              </Text>
            </View>

            {/* Confirm Button */}
            {onConfirm && (
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={onConfirm}
                activeOpacity={0.8}>
                <Text style={styles.confirmButtonText}>
                  Confirm Booking • {formatPrice(fareDetails.totalFare)}
                </Text>
              </TouchableOpacity>
            )}

            {/* Close Button */}
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              activeOpacity={0.7}>
              <Text style={styles.cancelButtonText}>Close</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: Colors.dark.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '95%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border + '30',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  closeButton: {
    padding: 8,
    marginRight: -8,
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  routeSummary: {
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.dark.border + '30',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
    gap: 10,
  },
  locationIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.dark.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  locationText: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    fontWeight: '500',
    marginBottom: 2,
  },
  location: {
    fontSize: 13,
    color: Colors.dark.text,
    fontWeight: '600',
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.dark.border + '40',
    marginVertical: 12,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border + '30',
  },
  metaItem: {
    alignItems: 'center',
  },
  metaLabel: {
    fontSize: 10,
    color: Colors.dark.textSecondary,
    marginBottom: 4,
  },
  metaValue: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.dark.gold,
  },
  breakdownSection: {
    marginBottom: 16,
  },
  breakdownTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 10,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.dark.background,
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.dark.border + '40',
  },
  breakdownRowHighlighted: {
    backgroundColor: Colors.dark.card,
    borderColor: Colors.dark.gold + '60',
  },
  breakdownLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  icon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: Colors.dark.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  breakdownInfo: {
    flex: 1,
  },
  breakdownLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.dark.text,
    marginBottom: 2,
  },
  breakdownDescription: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
  },
  breakdownAmount: {
    fontSize: 13,
    fontWeight: '700',
    marginLeft: 8,
  },
  normalAmount: {
    color: Colors.dark.text,
  },
  discountAmount: {
    color: Colors.dark.success,
  },
  taxAmount: {
    color: Colors.dark.textSecondary,
  },
  subtotalSection: {
    marginBottom: 12,
  },
  subtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: 8,
  },
  subtotalLabel: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    fontWeight: '500',
  },
  subtotalAmount: {
    fontSize: 13,
    color: Colors.dark.textSecondary,
    fontWeight: '600',
  },
  dividerLine: {
    height: 1,
    backgroundColor: Colors.dark.border + '30',
  },
  totalSection: {
    backgroundColor: Colors.dark.gold + '15',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.dark.gold + '40',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.dark.gold,
  },
  totalHint: {
    fontSize: 11,
    color: Colors.dark.textSecondary,
    fontStyle: 'italic',
    marginTop: 8,
  },
  infoBox: {
    backgroundColor: Colors.dark.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 3,
    borderLeftColor: Colors.dark.gold,
  },
  infoTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 11,
    lineHeight: 16,
    color: Colors.dark.textSecondary,
  },
  confirmButton: {
    backgroundColor: Colors.dark.gold,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  confirmButtonText: {
    color: Colors.dark.background,
    fontWeight: '700',
    fontSize: 15,
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: Colors.dark.border,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  cancelButtonText: {
    color: Colors.dark.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
});
