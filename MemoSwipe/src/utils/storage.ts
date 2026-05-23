import AsyncStorage from '@react-native-async-storage/async-storage';
import {Dictionary} from '../types';

const STORAGE_KEY = '@MemoSwipe_dictionaries';

export const loadDictionaries = async (): Promise<Dictionary[]> => {
  try {
    const data = await AsyncStorage.getItem(STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading dictionaries:', error);
  }
  return [];
};

export const saveDictionaries = async (dictionaries: Dictionary[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(dictionaries));
  } catch (error) {
    console.error('Error saving dictionaries:', error);
  }
};

export const generateId = (): string => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};
