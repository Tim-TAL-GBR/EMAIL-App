import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Colors, FontFamily, FontWeight } from '../../lib/constants';

interface AvatarProps {
  uri?: string | null;
  name: string;
  size?: number;
  showStatus?: boolean;
}

export function Avatar({ uri, name, size = 40, showStatus = false }: AvatarProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  const stringToColor = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 60%, 40%)`;
  };

  const backgroundColor = stringToColor(name);

  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2 }]}>
      {uri ? (
        <Image
          source={{ uri }}
          style={[styles.image, { width: size, height: size, borderRadius: size / 2 }]}
        />
      ) : (
        <View
          style={[
            styles.fallbackContainer,
            { width: size, height: size, borderRadius: size / 2, backgroundColor },
          ]}
        >
          <Text style={[styles.initials, { fontSize: size * 0.4 }]}>{getInitials(name)}</Text>
        </View>
      )}
      {showStatus && (
        <View
          style={[
            styles.statusIndicator,
            {
              width: size * 0.25,
              height: size * 0.25,
              borderRadius: (size * 0.25) / 2,
              bottom: 0,
              right: 0,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  image: {
    resizeMode: 'cover',
  },
  fallbackContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  initials: {
    fontFamily: FontFamily,
    fontWeight: FontWeight.semibold,
    color: Colors.text,
  },
  statusIndicator: {
    position: 'absolute',
    backgroundColor: Colors.success,
    borderWidth: 2,
    borderColor: Colors.background,
  },
});
