import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Alert,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import {Gesture, GestureDetector} from 'react-native-gesture-handler';
import {useNavigation, useRoute, RouteProp, useFocusEffect} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {Dictionary, Word} from '../types';
import {loadDictionaries, saveDictionaries} from '../utils/storage';

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 64;
const SWIPE_THRESHOLD = 120;

type RootStackParamList = {
  Dictionaries: undefined;
  EditDictionary: {dictionaryId: string};
  Cards: {dictionaryId: string};
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type CardsRouteProp = RouteProp<RootStackParamList, 'Cards'>;

interface CardProps {
  word: Word;
  isActive: boolean;
  onSwipeComplete: (direction: 'left' | 'right') => void;
}

const Card: React.FC<CardProps> = ({word, isActive, onSwipeComplete}) => {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const rotate = useSharedValue(0);
  const isSwiped = useSharedValue(false);

  const gesture = Gesture.Pan()
    .enabled(isActive && !isSwiped.value)
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY * 0.3;
      rotate.value = event.translationX / SCREEN_WIDTH * 0.5;
    })
    .onEnd((event) => {
      if (Math.abs(event.translationX) > SWIPE_THRESHOLD) {
        isSwiped.value = true;
        const direction = event.translationX > 0 ? 'right' : 'left';
        
        translateX.value = withTiming(
          event.translationX > 0 ? SCREEN_WIDTH * 2 : -SCREEN_WIDTH * 2,
          {duration: 300},
          () => {
            runOnJS(onSwipeComplete)(direction);
          }
        );
      } else {
        translateX.value = withSpring(0, {damping: 15});
        translateY.value = withSpring(0, {damping: 15});
        rotate.value = withSpring(0, {damping: 15});
      }
    });

  const animatedStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      Math.abs(translateX.value),
      [0, SWIPE_THRESHOLD, SCREEN_WIDTH],
      [1, 0.8, 0]
    );

    return {
      transform: [
        {translateX: translateX.value},
        {translateY: translateY.value},
        {rotate: `${rotate.value}rad`},
      ],
      opacity,
    };
  });

  const translationOpacity = useAnimatedStyle(() => {
    const opacity = interpolate(
      Math.abs(translateX.value),
      [0, SWIPE_THRESHOLD / 2, SWIPE_THRESHOLD],
      [0, 0.5, 1]
    );
    return {opacity};
  });

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View style={[styles.card, animatedStyle]}>
        <View style={styles.cardContent}>
          <Text style={styles.wordText}>{word.original}</Text>
          <Animated.View style={[styles.translationContainer, translationOpacity]}>
            <Text style={styles.translationText}>{word.translation}</Text>
          </Animated.View>
        </View>
        <Animated.View 
          style={[
            styles.statusIndicator, 
            styles.rememberIndicator,
            {opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, 1], Extrapolation.CLAMP)}
          ]}>
          <Text style={styles.statusText}>Помню</Text>
        </Animated.View>
        <Animated.View 
          style={[
            styles.statusIndicator, 
            styles.forgetIndicator,
            {opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD, 0], [1, 0], Extrapolation.CLAMP)}
          ]}>
          <Text style={styles.statusText}>Не помню</Text>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
};

const CardsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<CardsRouteProp>();
  const {dictionaryId} = route.params;

  const [dictionary, setDictionary] = useState<Dictionary | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipedWords, setSwipedWords] = useState<{remembered: string[]; forgotten: string[]}>({
    remembered: [],
    forgotten: [],
  });

  useEffect(() => {
    loadDictionary();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDictionary();
    }, [])
  );

  const loadDictionary = async () => {
    const dictionaries = await loadDictionaries();
    const dict = dictionaries.find(d => d.id === dictionaryId);
    if (dict) {
      setDictionary(dict);
    } else {
      Alert.alert('Ошибка', 'Словарь не найден');
      navigation.goBack();
    }
  };

  const handleSwipeComplete = useCallback((direction: 'left' | 'right') => {
    if (!dictionary || currentIndex >= dictionary.words.length) return;

    const currentWord = dictionary.words[currentIndex];
    
    setSwipedWords(prev => ({
      remembered: direction === 'right' 
        ? [...prev.remembered, currentWord.id] 
        : prev.remembered,
      forgotten: direction === 'left' 
        ? [...prev.forgotten, currentWord.id] 
        : prev.forgotten,
    }));

    setCurrentIndex(prev => prev + 1);
  }, [dictionary, currentIndex]);

  const handleFinish = async () => {
    if (!dictionary) return;

    const updatedWords = dictionary.words.map(word => ({
      ...word,
      learned: swipedWords.remembered.includes(word.id) ? true : word.learned,
    }));

    const updatedDict: Dictionary = {
      ...dictionary,
      words: updatedWords,
    };

    const allDictionaries = await loadDictionaries();
    const updatedAll = allDictionaries.map(d => 
      d.id === dictionaryId ? updatedDict : d
    );
    await saveDictionaries(updatedAll);

    Alert.alert(
      'Готово!',
      `Пройдено: ${currentIndex}\nВыучено: ${swipedWords.remembered.length}\nНе выучено: ${swipedWords.forgotten.length}`,
      [{text: 'OK', onPress: () => navigation.goBack()}]
    );
  };

  if (!dictionary) {
    return (
      <View style={styles.container}>
        <Text>Загрузка...</Text>
      </View>
    );
  }

  const totalWords = dictionary.words.length;
  const passed = currentIndex;
  const remembered = swipedWords.remembered.length;
  const forgotten = swipedWords.forgotten.length;
  const progressPercent = totalWords > 0 ? Math.round((passed / totalWords) * 100) : 0;

  const isFinished = currentIndex >= totalWords;

  if (isFinished) {
    return (
      <View style={styles.container}>
        <View style={styles.finishedContainer}>
          <Text style={styles.finishedTitle}>Все карточки пройдены!</Text>
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Всего слов</Text>
              <Text style={styles.statValue}>{totalWords}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Пройдено</Text>
              <Text style={styles.statValue}>{passed}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Выучено</Text>
              <Text style={[styles.statValue, {color: '#7cb342'}]}>{remembered}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Не выучено</Text>
              <Text style={[styles.statValue, {color: '#e57373'}]}>{forgotten}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.finishButton} onPress={handleFinish}>
            <Text style={styles.finishButtonText}>Завершить</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.cardsContainer}>
        {dictionary.words.slice(currentIndex, currentIndex + 3).map((word, index) => (
          <Card
            key={word.id}
            word={word}
            isActive={index === 0}
            onSwipeComplete={handleSwipeComplete}
          />
        ))}
      </View>

      <View style={styles.statsBar}>
        <View style={styles.statRow}>
          <View style={styles.statBox}>
            <Text style={styles.statBoxLabel}>Всего</Text>
            <Text style={styles.statBoxValue}>{totalWords}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statBoxLabel}>Пройдено</Text>
            <Text style={styles.statBoxValue}>{passed}</Text>
          </View>
          <View style={[styles.statBox, styles.statBoxGreen]}>
            <Text style={styles.statBoxLabel}>Выучено</Text>
            <Text style={styles.statBoxValue}>{remembered}</Text>
          </View>
          <View style={[styles.statBox, styles.statBoxRed]}>
            <Text style={styles.statBoxLabel}>Не выучено</Text>
            <Text style={styles.statBoxValue}>{forgotten}</Text>
          </View>
        </View>
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View 
              style={[styles.progressFill, {width: `${progressPercent}%`}]} 
            />
          </View>
          <Text style={styles.progressText}>{progressPercent}%</Text>
        </View>
        <Text style={styles.hintText}>
          Свайп вправо — помню, влево — не помню
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  cardsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
  },
  card: {
    position: 'absolute',
    width: CARD_WIDTH,
    height: 300,
    backgroundColor: '#fff',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  cardContent: {
    padding: 24,
    alignItems: 'center',
  },
  wordText: {
    fontSize: 28,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },
  translationContainer: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    width: '100%',
    alignItems: 'center',
  },
  translationText: {
    fontSize: 20,
    color: '#5a9fd6',
    textAlign: 'center',
  },
  statusIndicator: {
    position: 'absolute',
    top: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  rememberIndicator: {
    right: 20,
    backgroundColor: '#7cb342',
  },
  forgetIndicator: {
    left: 20,
    backgroundColor: '#e57373',
  },
  statusText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  statsBar: {
    backgroundColor: '#fff',
    padding: 16,
    paddingBottom: 24,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: -2},
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 4,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 12,
  },
  statBox: {
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    minWidth: 70,
  },
  statBoxGreen: {
    backgroundColor: '#e8f5e9',
  },
  statBoxRed: {
    backgroundColor: '#ffebee',
  },
  statBoxLabel: {
    fontSize: 11,
    color: '#888',
    marginBottom: 4,
  },
  statBoxValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#5a9fd6',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5a9fd6',
    width: 45,
    textAlign: 'right',
  },
  hintText: {
    textAlign: 'center',
    color: '#888',
    fontSize: 13,
  },
  finishedContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  finishedTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
    marginBottom: 32,
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
    marginBottom: 32,
  },
  statItem: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    minWidth: 100,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  statLabel: {
    fontSize: 12,
    color: '#888',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
  },
  finishButton: {
    backgroundColor: '#5a9fd6',
    paddingHorizontal: 48,
    paddingVertical: 16,
    borderRadius: 12,
  },
  finishButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default CardsScreen;
