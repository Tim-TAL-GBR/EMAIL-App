import React, { useRef, useState } from 'react';
import { View, Animated, PanResponder, StyleSheet, Dimensions, Platform } from 'react-native';
import { Colors, BorderRadius } from '../../lib/constants';

interface DraggableWindowProps {
  children: React.ReactNode;
  initialWidth?: number;
  initialHeight?: number;
  headerComponent?: React.ReactNode;
}

export function DraggableWindow({ children, initialWidth = 800, initialHeight = 600, headerComponent }: DraggableWindowProps) {
  const windowDims = Dimensions.get('window');
  
  // Center initially
  const initialX = Math.max(0, (windowDims.width - initialWidth) / 2);
  const initialY = Math.max(0, (windowDims.height - initialHeight) / 2);

  const pan = useRef(new Animated.ValueXY({ x: initialX, y: initialY })).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // Only become responder if they move it a bit, to not swallow simple clicks
        return Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2;
      },
      onPanResponderGrant: () => {
        pan.setOffset({
          x: (pan.x as any)._value,
          y: (pan.y as any)._value
        });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event(
        [
          null,
          { dx: pan.x, dy: pan.y }
        ],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        pan.flattenOffset();
      }
    })
  ).current;

  const windowSize = useRef(new Animated.ValueXY({ x: initialWidth, y: initialHeight })).current;

  const resizeResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        return Math.abs(gestureState.dx) > 2 || Math.abs(gestureState.dy) > 2;
      },
      onPanResponderGrant: () => {
        windowSize.setOffset({
          x: (windowSize.x as any)._value,
          y: (windowSize.y as any)._value
        });
        windowSize.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (evt, gestureState) => {
        const currentOffsetW = (windowSize.x as any)._offset;
        const currentOffsetH = (windowSize.y as any)._offset;
        
        // Constrain minimum dimensions
        const newWidth = Math.max(400, currentOffsetW + gestureState.dx);
        const newHeight = Math.max(300, currentOffsetH + gestureState.dy);
        
        windowSize.setValue({ 
          x: newWidth - currentOffsetW, 
          y: newHeight - currentOffsetH 
        });
      },
      onPanResponderRelease: () => {
        windowSize.flattenOffset();
      }
    })
  ).current;

  // The component that mounts DraggableWindow (e.g. EmailComposer) already checks
  // for desktop/tablet dimensions. We can safely render the draggable view here.

  return (
    <Animated.View
      style={[
        styles.window,
        {
          width: windowSize.x,
          height: windowSize.y,
          transform: [{ translateX: pan.x }, { translateY: pan.y }]
        }
      ]}
    >
      <View {...panResponder.panHandlers} style={styles.dragHandle}>
        {headerComponent}
      </View>
      <View style={styles.content}>
        {children}
      </View>
      <View {...resizeResponder.panHandlers} style={styles.resizeHandle}>
        <View style={styles.resizeHandleIcon} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fullscreen: {
    flex: 1,
  },
  window: {
    position: Platform.OS === 'web' ? 'fixed' : 'absolute',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 20,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    overflow: 'hidden',
    display: 'flex',
    zIndex: 9999,
    flexDirection: 'column',
  },
  dragHandle: {
    backgroundColor: '#F5F5F5',
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    cursor: 'move' as any, // Web specific
  },
  content: {
    flex: 1,
  },
  resizeHandle: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 25,
    height: 25,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    padding: 6,
    cursor: 'nwse-resize' as any,
    zIndex: 10,
  },
  resizeHandleIcon: {
    width: 10,
    height: 10,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderColor: Colors.textTertiary,
    borderBottomRightRadius: 2,
  },
});
