// src/presentation/components/ProductThumbnail.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { ProductVisual } from '../../domain/entities/Product';

interface ProductThumbnailProps {
  visual: ProductVisual;
  imageUri?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const ProductThumbnail: React.FC<ProductThumbnailProps> = ({
  visual,
  imageUri,
  size = 'md',
}) => {
  const dimensions =
    size === 'lg'
      ? { width: 68, height: 74 }
      : size === 'sm'
      ? { width: 40, height: 46 }
      : { width: 52, height: 56 };

  const activeUri = imageUri || visual?.imageUri;

  if (activeUri) {
    return (
      <View style={[styles.container, dimensions]}>
        <Image
          source={{ uri: activeUri }}
          style={styles.photo}
          contentFit="cover"
          transition={120}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, dimensions]}>
      <View
        style={[
          styles.placeholderBox,
          { backgroundColor: visual?.bgColor || '#0D7A52' },
        ]}
      >
        <Text
          style={[
            styles.placeholderInitials,
            { fontSize: size === 'lg' ? 12 : 10 },
          ]}
          numberOfLines={1}
        >
          {visual?.shortLabel || 'PROD'}
        </Text>
        <Text style={styles.placeholderSub} numberOfLines={1}>
          {visual?.subLabel || 'ITEM'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
  },
  placeholderBox: {
    width: '92%',
    height: '92%',
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    gap: 2,
  },
  placeholderInitials: {
    color: '#FFFFFF',
    fontWeight: '900',
    textAlign: 'center',
  },
  placeholderSub: {
    color: '#D1FAE5',
    fontSize: 7,
    fontWeight: '700',
    textAlign: 'center',
  },
});
