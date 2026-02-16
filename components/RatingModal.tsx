import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Star, X } from 'lucide-react-native';
import { Colors } from '@/constants/Colors';

interface RatingModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (rating: number, feedback: string, tags: string[]) => Promise<void>;
  ratedName?: string;
  ratedRole: 'driver' | 'passenger';
  from?: string;
  to?: string;
}

export default function RatingModal({
  visible,
  onClose,
  onSubmit,
  ratedName = 'User',
  ratedRole,
  from,
  to,
}: RatingModalProps) {
  const [rating, setRating] = useState(5);
  const [feedback, setFeedback] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const driverTags = [
    'Safe Driver',
    'Punctual',
    'Friendly',
    'Clean Vehicle',
    'Good Music',
    'Professional',
  ];

  const passengerTags = [
    'Punctual',
    'Friendly',
    'Respectful',
    'Good Conversation',
    'Quiet',
    'Easy Going',
  ];

  const tags = ratedRole === 'driver' ? driverTags : passengerTags;

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      await onSubmit(rating, feedback, selectedTags);
      
      // Reset form
      setRating(5);
      setFeedback('');
      setSelectedTags([]);
      onClose();
    } catch (error) {
      console.error('Error submitting rating:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const getRatingLabel = (stars: number) => {
    switch (stars) {
      case 1:
        return 'Poor';
      case 2:
        return 'Fair';
      case 3:
        return 'Good';
      case 4:
        return 'Very Good';
      case 5:
        return 'Excellent';
      default:
        return '';
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>Rate Your {ratedRole === 'driver' ? 'Driver' : 'Passenger'}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={Colors.dark.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}>
            {/* Trip Info */}
            {from && to && (
              <View style={styles.tripInfo}>
                <Text style={styles.tripRoute}>
                  {from} → {to}
                </Text>
              </View>
            )}

            {/* User Info */}
            <View style={styles.userSection}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {ratedName.charAt(0).toUpperCase()}
                </Text>
              </View>
              <Text style={styles.userName}>{ratedName}</Text>
            </View>

            {/* Rating Stars */}
            <View style={styles.ratingSection}>
              <Text style={styles.sectionTitle}>How was your experience?</Text>
              <View style={styles.starsContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <TouchableOpacity
                    key={star}
                    onPress={() => setRating(star)}
                    style={styles.starButton}>
                    <Star
                      size={40}
                      color={Colors.dark.gold}
                      fill={star <= rating ? Colors.dark.gold : 'transparent'}
                    />
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.ratingLabel}>{getRatingLabel(rating)}</Text>
            </View>

            {/* Tags */}
            <View style={styles.tagsSection}>
              <Text style={styles.sectionTitle}>What did you like?</Text>
              <View style={styles.tagsContainer}>
                {tags.map((tag) => (
                  <TouchableOpacity
                    key={tag}
                    onPress={() => toggleTag(tag)}
                    style={[
                      styles.tag,
                      selectedTags.includes(tag) && styles.tagSelected,
                    ]}>
                    <Text
                      style={[
                        styles.tagText,
                        selectedTags.includes(tag) && styles.tagTextSelected,
                      ]}>
                      {tag}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Feedback */}
            <View style={styles.feedbackSection}>
              <Text style={styles.sectionTitle}>
                Additional Feedback (Optional)
              </Text>
              <TextInput
                style={styles.feedbackInput}
                placeholder="Share your thoughts..."
                placeholderTextColor={Colors.dark.textSecondary}
                multiline
                numberOfLines={4}
                value={feedback}
                onChangeText={setFeedback}
                maxLength={500}
              />
              <Text style={styles.charCount}>{feedback.length}/500</Text>
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={submitting}>
              {submitting ? (
                <ActivityIndicator color={Colors.dark.background} />
              ) : (
                <Text style={styles.submitButtonText}>Submit Rating</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.skipButton}
              onPress={onClose}
              disabled={submitting}>
              <Text style={styles.skipButtonText}>Skip for Now</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: Colors.dark.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.dark.text,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  tripInfo: {
    backgroundColor: Colors.dark.card,
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  tripRoute: {
    fontSize: 14,
    color: Colors.dark.text,
    textAlign: 'center',
    fontWeight: '600',
  },
  userSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.dark.gold + '30',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 3,
    borderColor: Colors.dark.gold,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.dark.gold,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.dark.text,
  },
  ratingSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.text,
    marginBottom: 16,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  starButton: {
    padding: 4,
  },
  ratingLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.dark.gold,
    marginTop: 8,
  },
  tagsSection: {
    marginBottom: 24,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.dark.card,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  tagSelected: {
    backgroundColor: Colors.dark.gold + '20',
    borderColor: Colors.dark.gold,
  },
  tagText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
  },
  tagTextSelected: {
    color: Colors.dark.gold,
  },
  feedbackSection: {
    marginBottom: 24,
  },
  feedbackInput: {
    backgroundColor: Colors.dark.card,
    borderRadius: 12,
    padding: 16,
    color: Colors.dark.text,
    fontSize: 15,
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  charCount: {
    fontSize: 12,
    color: Colors.dark.textSecondary,
    textAlign: 'right',
    marginTop: 8,
  },
  submitButton: {
    backgroundColor: Colors.dark.gold,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.dark.background,
  },
  skipButton: {
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  skipButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.dark.textSecondary,
  },
});
