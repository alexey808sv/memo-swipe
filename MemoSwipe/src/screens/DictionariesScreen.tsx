import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {Dictionary} from '../types';
import {loadDictionaries, saveDictionaries, generateId} from '../utils/storage';

type RootStackParamList = {
  Dictionaries: undefined;
  EditDictionary: {dictionaryId: string};
  Cards: {dictionaryId: string};
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const DictionariesScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [dictionaries, setDictionaries] = useState<Dictionary[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [newDictName, setNewDictName] = useState('');
  const [longPressTimer, setLongPressTimer] = useState<NodeJS.Timeout | null>(null);

  const loadDicts = async () => {
    const loaded = await loadDictionaries();
    setDictionaries(loaded);
  };

  useFocusEffect(
    useCallback(() => {
      loadDicts();
    }, []),
  );

  const handleCreateDictionary = async () => {
    if (!newDictName.trim()) {
      Alert.alert('Ошибка', 'Введите название словаря');
      return;
    }

    const newDict: Dictionary = {
      id: generateId(),
      name: newDictName.trim(),
      words: [],
      createdAt: Date.now(),
    };

    const updated = [...dictionaries, newDict];
    await saveDictionaries(updated);
    setDictionaries(updated);
    setNewDictName('');
    setModalVisible(false);
  };

  const handleDeleteDictionary = async (dictId: string) => {
    Alert.alert(
      'Удаление словаря',
      'Вы уверены, что хотите удалить этот словарь?',
      [
        {text: 'Отмена', style: 'cancel'},
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            const updated = dictionaries.filter(d => d.id !== dictId);
            await saveDictionaries(updated);
            setDictionaries(updated);
          },
        },
      ],
    );
  };

  const handleLongPressIn = (dictId: string) => {
    const timer = setTimeout(() => {
      handleDeleteDictionary(dictId);
    }, 800);
    setLongPressTimer(timer);
  };

  const handleLongPressOut = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const renderDictionary = ({item}: {item: Dictionary}) => (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => {}}
      onPressIn={() => handleLongPressIn(item.id)}
      onPressOut={handleLongPressOut}
      style={styles.dictContainer}>
      <View style={styles.dictContent}>
        <Text numberOfLines={1} ellipsizeMode="tail" style={styles.dictName}>
          {item.name}
        </Text>
        <Text style={styles.wordCount}>{item.words.length} слов</Text>
      </View>
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() =>
            navigation.navigate('EditDictionary', {dictionaryId: item.id})
          }>
          <Icon name="edit" size={24} color="#5a9fd6" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => navigation.navigate('Cards', {dictionaryId: item.id})}>
          <Icon name="play-arrow" size={24} color="#7cb342" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={dictionaries}
        renderItem={renderDictionary}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
      />
      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Icon name="add" size={32} color="#fff" />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Новый словарь</Text>
            <TextInput
              style={styles.input}
              placeholder="Название словаря"
              value={newDictName}
              onChangeText={setNewDictName}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setNewDictName('');
                  setModalVisible(false);
                }}>
                <Text style={styles.cancelButtonText}>Отмена</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.createButton]}
                onPress={handleCreateDictionary}>
                <Text style={styles.createButtonText}>Создать</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  listContent: {
    padding: 16,
  },
  dictContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  dictContent: {
    flex: 1,
    marginRight: 12,
  },
  dictName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  wordCount: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#5a9fd6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    width: '85%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: '#fafafa',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#666',
    fontWeight: '600',
    fontSize: 16,
  },
  createButton: {
    backgroundColor: '#5a9fd6',
  },
  createButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});

export default DictionariesScreen;
