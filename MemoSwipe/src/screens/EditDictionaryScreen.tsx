import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Alert,
  ScrollView,
  Switch,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {useNavigation, useRoute, RouteProp} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {Dictionary, Word} from '../types';
import {loadDictionaries, saveDictionaries, generateId} from '../utils/storage';
import DocumentPicker from 'react-native-document-picker';

type RootStackParamList = {
  Dictionaries: undefined;
  EditDictionary: {dictionaryId: string};
  Cards: {dictionaryId: string};
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type EditDictionaryRouteProp = RouteProp<RootStackParamList, 'EditDictionary'>;

const EditDictionaryScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<EditDictionaryRouteProp>();
  const {dictionaryId} = route.params;

  const [dictionaries, setDictionaries] = useState<Dictionary[]>([]);
  const [currentDict, setCurrentDict] = useState<Dictionary | null>(null);
  const [dictName, setDictName] = useState('');
  const [originalWord, setOriginalWord] = useState('');
  const [translationWord, setTranslationWord] = useState('');
  const [isLearned, setIsLearned] = useState(false);
  const [editingWordId, setEditingWordId] = useState<string | null>(null);

  useEffect(() => {
    loadDictionary();
  }, []);

  const loadDictionary = async () => {
    const loaded = await loadDictionaries();
    setDictionaries(loaded);
    const dict = loaded.find(d => d.id === dictionaryId);
    if (dict) {
      setCurrentDict(dict);
      setDictName(dict.name);
    }
  };

  const handleSaveAll = async () => {
    if (!currentDict) return;

    const updatedDictionaries = dictionaries.map(d =>
      d.id === dictionaryId ? currentDict : d,
    );

    await saveDictionaries(updatedDictionaries);
    setDictionaries(updatedDictionaries);
    Alert.alert('Успех', 'Все изменения сохранены');
  };

  const handleCancelChanges = async () => {
    const loaded = await loadDictionaries();
    const dict = loaded.find(d => d.id === dictionaryId);
    if (dict) {
      setDictName(dict.name);
      setCurrentDict(dict);
    }
  };

  const handleAddWord = () => {
    if (!originalWord.trim() || !translationWord.trim()) {
      Alert.alert('Ошибка', 'Заполните оба поля');
      return;
    }

    if (!currentDict) return;

    const newWord: Word = {
      id: generateId(),
      original: originalWord.trim(),
      translation: translationWord.trim(),
      learned: isLearned,
    };

    const updatedDict: Dictionary = {
      ...currentDict,
      words: [...currentDict.words, newWord],
    };

    setCurrentDict(updatedDict);
    setOriginalWord('');
    setTranslationWord('');
    setIsLearned(false);
  };

  const handleUpdateWord = () => {
    if (!originalWord.trim() || !translationWord.trim() || !editingWordId) {
      return;
    }

    if (!currentDict) return;

    const updatedWords = currentDict.words.map(w =>
      w.id === editingWordId
        ? {...w, original: originalWord.trim(), translation: translationWord.trim(), learned: isLearned}
        : w,
    );

    const updatedDict: Dictionary = {
      ...currentDict,
      words: updatedWords,
    };

    setCurrentDict(updatedDict);
    setOriginalWord('');
    setTranslationWord('');
    setIsLearned(false);
    setEditingWordId(null);
  };

  const handleEditWord = (word: Word) => {
    setOriginalWord(word.original);
    setTranslationWord(word.translation);
    setIsLearned(word.learned);
    setEditingWordId(word.id);
  };

  const handleDeleteWord = (wordId: string) => {
    if (!currentDict) return;

    const updatedWords = currentDict.words.filter(w => w.id !== wordId);
    const updatedDict: Dictionary = {
      ...currentDict,
      words: updatedWords,
    };
    setCurrentDict(updatedDict);

    if (editingWordId === wordId) {
      setOriginalWord('');
      setTranslationWord('');
      setIsLearned(false);
      setEditingWordId(null);
    }
  };

  const handleCreateUnlearnedDictionary = async () => {
    if (!currentDict || currentDict.words.length === 0) {
      Alert.alert('Ошибка', 'Нет слов в словаре');
      return;
    }

    const unlearnedWords = currentDict.words.filter(w => !w.learned);

    if (unlearnedWords.length === 0) {
      Alert.alert('Информация', 'Все слова уже выучены');
      return;
    }

    const newDict: Dictionary = {
      id: generateId(),
      name: `${currentDict.name} (невыученные)`,
      words: unlearnedWords.map(w => ({...w, id: generateId()})),
      createdAt: Date.now(),
    };

    const updatedDictionaries = [...dictionaries, newDict];
    await saveDictionaries(updatedDictionaries);
    setDictionaries(updatedDictionaries);
    Alert.alert('Успех', `Создан новый словарь с ${unlearnedWords.length} словами`);
  };

  const handleImportWords = async () => {
    try {
      const result = await DocumentPicker.pickSingle({
        type: [DocumentPicker.types.csv, DocumentPicker.types.plainText, DocumentPicker.types.allFiles],
      });

      if (!result) return;

      const response = await fetch(result.uri);
      const text = await response.text();
      
      const lines = text.split('\n').filter(line => line.trim());
      let importedCount = 0;

      if (!currentDict) return;

      const newWords: Word[] = [];

      for (const line of lines) {
        const parts = line.split(/[;,|\t]/).map(p => p.trim()).filter(p => p);
        if (parts.length >= 2) {
          const word: Word = {
            id: generateId(),
            original: parts[0],
            translation: parts[1],
            learned: false,
          };
          newWords.push(word);
          importedCount++;
        }
      }

      if (importedCount === 0) {
        Alert.alert('Ошибка', 'Не удалось распарсить файл. Формат: слово;перевод на каждой строке');
        return;
      }

      const updatedDict: Dictionary = {
        ...currentDict,
        words: [...currentDict.words, ...newWords],
      };

      setCurrentDict(updatedDict);
      Alert.alert('Успех', `Импортировано ${importedCount} слов`);
    } catch (error) {
      console.error('Import error:', error);
      Alert.alert('Ошибка', 'Не удалось импортировать файл');
    }
  };

  const renderWord = ({item}: {item: Word}) => (
    <View style={styles.wordItem}>
      <View style={styles.wordContent}>
        <Text style={styles.wordOriginal}>{item.original}</Text>
        <Text style={styles.wordTranslation}>{item.translation}</Text>
      </View>
      <View style={styles.wordActions}>
        <View style={styles.learnedRow}>
          <Text style={styles.learnedLabel}>Выучено</Text>
          <Switch
            value={item.learned}
            onValueChange={() => {
              if (!currentDict) return;
              const updatedWords = currentDict.words.map(w =>
                w.id === item.id ? {...w, learned: !w.learned} : w,
              );
              setCurrentDict({...currentDict, words: updatedWords});
            }}
            trackColor={{false: '#ccc', true: '#7cb342'}}
            thumbColor="#fff"
          />
        </View>
        <TouchableOpacity
          style={styles.editWordButton}
          onPress={() => handleEditWord(item)}>
          <Icon name="edit" size={20} color="#5a9fd6" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteWordButton}
          onPress={() => handleDeleteWord(item.id)}>
          <Icon name="delete" size={20} color="#e57373" />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (!currentDict) {
    return (
      <View style={styles.container}>
        <Text>Загрузка...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Название словаря</Text>
        <TextInput
          style={styles.input}
          value={dictName}
          onChangeText={setDictName}
          placeholder="Название"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Добавить слово</Text>
        <TextInput
          style={styles.input}
          value={originalWord}
          onChangeText={setOriginalWord}
          placeholder="Слово"
        />
        <TextInput
          style={styles.input}
          value={translationWord}
          onChangeText={setTranslationWord}
          placeholder="Перевод"
        />
        <View style={styles.checkboxRow}>
          <Switch
            value={isLearned}
            onValueChange={setIsLearned}
            trackColor={{false: '#ccc', true: '#7cb342'}}
            thumbColor="#fff"
          />
          <Text style={styles.checkboxLabel}>Выучено</Text>
        </View>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.addButton]}
            onPress={editingWordId ? handleUpdateWord : handleAddWord}>
            <Text style={styles.actionButtonText}>
              {editingWordId ? 'Обновить' : 'Добавить'}
            </Text>
          </TouchableOpacity>
          {editingWordId && (
            <TouchableOpacity
              style={[styles.actionButton, styles.cancelEditButton]}
              onPress={() => {
                setOriginalWord('');
                setTranslationWord('');
                setIsLearned(false);
                setEditingWordId(null);
              }}>
              <Text style={styles.actionButtonText}>Отмена</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Слова ({currentDict.words.length})</Text>
          <TouchableOpacity
            style={styles.importButton}
            onPress={handleImportWords}>
            <Icon name="file-upload" size={20} color="#5a9fd6" />
            <Text style={styles.importButtonText}>Импорт</Text>
          </TouchableOpacity>
        </View>
        
        {currentDict.words.length > 0 ? (
          <FlatList
            data={currentDict.words}
            renderItem={renderWord}
            keyExtractor={item => item.id}
            scrollEnabled={false}
            contentContainerStyle={styles.wordsList}
          />
        ) : (
          <Text style={styles.emptyText}>Нет слов</Text>
        )}
      </View>

      <View style={styles.actionsSection}>
        <TouchableOpacity
          style={[styles.mainButton, styles.saveButton]}
          onPress={handleSaveAll}>
          <Icon name="save" size={24} color="#fff" />
          <Text style={styles.mainButtonText}>Сохранить все</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.mainButton, styles.cancelButton]}
          onPress={handleCancelChanges}>
          <Icon name="undo" size={24} color="#666" />
          <Text style={[styles.mainButtonText, styles.cancelButtonText]}>Отменить</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.mainButton, styles.newDictButton]}
          onPress={handleCreateUnlearnedDictionary}>
          <Icon name="content-copy" size={24} color="#fff" />
          <Text style={styles.mainButtonText}>Новый из невыученных</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: '#fafafa',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#333',
    marginLeft: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  addButton: {
    backgroundColor: '#5a9fd6',
  },
  cancelEditButton: {
    backgroundColor: '#f0f0f0',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f0f7ff',
    borderRadius: 8,
  },
  importButtonText: {
    color: '#5a9fd6',
    fontWeight: '600',
    fontSize: 14,
  },
  wordsList: {
    paddingBottom: 8,
  },
  emptyText: {
    color: '#888',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  wordItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  wordContent: {
    flex: 1,
  },
  wordOriginal: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  wordTranslation: {
    fontSize: 14,
    color: '#888',
    marginTop: 2,
  },
  wordActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  learnedRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  learnedLabel: {
    fontSize: 12,
    color: '#666',
    marginRight: 4,
  },
  editWordButton: {
    padding: 4,
  },
  deleteWordButton: {
    padding: 4,
  },
  actionsSection: {
    gap: 12,
  },
  mainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  saveButton: {
    backgroundColor: '#7cb342',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  newDictButton: {
    backgroundColor: '#5a9fd6',
  },
  mainButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  cancelButtonText: {
    color: '#666',
  },
});

export default EditDictionaryScreen;
