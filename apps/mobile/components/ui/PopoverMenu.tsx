import React from 'react';
import { Modal, StyleSheet, TouchableOpacity, View, Text, LayoutRectangle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Colors, Spacing, FontFamily, BorderRadius, Shadows } from '../../lib/constants';

export interface MenuItem {
  id: string;
  label: string;
  icon?: keyof typeof Feather.glyphMap;
  onPress: () => void;
  destructive?: boolean;
}

interface PopoverMenuProps {
  visible: boolean;
  onClose: () => void;
  anchorRect?: LayoutRectangle;
  items: MenuItem[];
  align?: 'left' | 'right';
  width?: number;
}

export function PopoverMenu({ 
  visible, 
  onClose, 
  anchorRect, 
  items, 
  align = 'right',
  width = 200
}: PopoverMenuProps) {
  if (!visible) return null;

  // Calculate position based on the anchor
  let top = 0;
  let left = undefined;
  let right = undefined;

  if (anchorRect) {
    top = anchorRect.y + anchorRect.height + 4; // Slight gap below button
    if (align === 'right') {
      // We align the right edge of the popover with the right edge of the anchor
      // Since absolute positioning can be tricky with screen width, we can use right offset from window
      // But a simpler approach for a right-aligned menu relative to a parent is to set left to anchor.x + anchor.width - menu.width
      left = anchorRect.x + anchorRect.width - width;
    } else {
      left = anchorRect.x;
    }
    
    // Prevent it from going off the left screen edge
    if (left !== undefined && left < Spacing.sm) {
      left = Spacing.sm;
    }
  }

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.overlay} 
        activeOpacity={1} 
        onPressOut={onClose}
      >
        {anchorRect && (
          <View style={[styles.menu, { top, left, width }]}>
            {items.map((item, index) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.item,
                  index < items.length - 1 && styles.borderBottom
                ]}
                onPress={() => {
                  item.onPress();
                  onClose();
                }}
              >
                {item.icon && (
                  <Feather 
                    name={item.icon} 
                    size={16} 
                    color={item.destructive ? Colors.error : Colors.textSecondary} 
                    style={styles.icon}
                  />
                )}
                <Text style={[
                  styles.label,
                  item.destructive && styles.destructiveLabel
                ]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0)', // Invisible overlay to catch touches
  },
  menu: {
    position: 'absolute',
    backgroundColor: '#FFF',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingVertical: 4,
    ...Shadows.subtle,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
  },
  borderBottom: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  icon: {
    marginRight: Spacing.sm,
  },
  label: {
    fontFamily: FontFamily,
    fontSize: 14,
    color: Colors.text,
  },
  destructiveLabel: {
    color: Colors.error,
  }
});
