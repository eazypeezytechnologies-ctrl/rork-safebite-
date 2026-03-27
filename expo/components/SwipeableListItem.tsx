import { useRef, ReactNode } from 'react';
import {
  View,
  Animated,
  StyleSheet,
  TouchableOpacity,
  PanResponder,
  Platform,
} from 'react-native';
import { Trash2, Heart } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

interface SwipeAction {
  icon: 'delete' | 'favorite';
  color: string;
  onPress: () => void;
}

interface SwipeableListItemProps {
  children: ReactNode;
  leftAction?: SwipeAction;
  rightAction?: SwipeAction;
  onPress?: () => void;
}

const SWIPE_THRESHOLD = 80;
const SWIPE_ACTIVATION = 120;

export function SwipeableListItem({
  children,
  leftAction,
  rightAction,
  onPress,
}: SwipeableListItemProps) {
  const pan = useRef(new Animated.Value(0)).current;
  const hapticTriggered = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10;
      },
      onPanResponderGrant: () => {
        hapticTriggered.current = false;
      },
      onPanResponderMove: (_, gestureState) => {
        const newValue = gestureState.dx;

        if (!leftAction && newValue > 0) {
          pan.setValue(0);
          return;
        }
        if (!rightAction && newValue < 0) {
          pan.setValue(0);
          return;
        }

        pan.setValue(newValue);

        if (!hapticTriggered.current && Math.abs(newValue) > SWIPE_THRESHOLD) {
          if (Platform.OS !== 'web') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
          hapticTriggered.current = true;
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const { dx } = gestureState;

        if (Math.abs(dx) < SWIPE_THRESHOLD) {
          Animated.spring(pan, {
            toValue: 0,
            useNativeDriver: false,
            tension: 80,
            friction: 10,
          }).start();
          return;
        }

        if (dx > SWIPE_ACTIVATION && leftAction) {
          if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
          Animated.timing(pan, {
            toValue: 300,
            duration: 200,
            useNativeDriver: false,
          }).start(() => {
            leftAction.onPress();
            pan.setValue(0);
          });
        } else if (dx < -SWIPE_ACTIVATION && rightAction) {
          if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          }
          Animated.timing(pan, {
            toValue: -300,
            duration: 200,
            useNativeDriver: false,
          }).start(() => {
            rightAction.onPress();
            pan.setValue(0);
          });
        } else {
          Animated.spring(pan, {
            toValue: 0,
            useNativeDriver: false,
            tension: 80,
            friction: 10,
          }).start();
        }
      },
    })
  ).current;

  const renderIcon = (action: SwipeAction) => {
    switch (action.icon) {
      case 'delete':
        return <Trash2 size={24} color="#FFFFFF" />;
      case 'favorite':
        return <Heart size={24} color="#FFFFFF" fill="#FFFFFF" />;
      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {leftAction && (
        <View style={[styles.actionContainer, styles.leftAction]}>
          <Animated.View
            style={[
              styles.actionContent,
              {
                backgroundColor: leftAction.color,
                opacity: pan.interpolate({
                  inputRange: [0, SWIPE_THRESHOLD],
                  outputRange: [0, 1],
                  extrapolate: 'clamp',
                }),
                transform: [
                  {
                    scale: pan.interpolate({
                      inputRange: [0, SWIPE_THRESHOLD],
                      outputRange: [0.5, 1],
                      extrapolate: 'clamp',
                    }),
                  },
                ],
              },
            ]}
          >
            {renderIcon(leftAction)}
          </Animated.View>
        </View>
      )}

      {rightAction && (
        <View style={[styles.actionContainer, styles.rightAction]}>
          <Animated.View
            style={[
              styles.actionContent,
              {
                backgroundColor: rightAction.color,
                opacity: pan.interpolate({
                  inputRange: [-SWIPE_THRESHOLD, 0],
                  outputRange: [1, 0],
                  extrapolate: 'clamp',
                }),
                transform: [
                  {
                    scale: pan.interpolate({
                      inputRange: [-SWIPE_THRESHOLD, 0],
                      outputRange: [1, 0.5],
                      extrapolate: 'clamp',
                    }),
                  },
                ],
              },
            ]}
          >
            {renderIcon(rightAction)}
          </Animated.View>
        </View>
      )}

      <Animated.View
        style={[
          styles.content,
          {
            transform: [{ translateX: pan }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          onPress={onPress}
          activeOpacity={onPress ? 0.7 : 1}
          disabled={!onPress}
          style={styles.touchable}
        >
          {children}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    marginBottom: 12,
  },
  actionContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    width: 100,
  },
  leftAction: {
    left: 0,
    paddingLeft: 20,
    alignItems: 'flex-start',
  },
  rightAction: {
    right: 0,
    paddingRight: 20,
    alignItems: 'flex-end',
  },
  actionContent: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
  },
  touchable: {
    flex: 1,
  },
});
