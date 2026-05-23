import 'react-native-gesture-handler';
import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import DictionariesScreen from './src/screens/DictionariesScreen';
import EditDictionaryScreen from './src/screens/EditDictionaryScreen';
import CardsScreen from './src/screens/CardsScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Dictionaries"
        screenOptions={{
          headerStyle: {
            backgroundColor: '#f5f5f5',
          },
          headerTitleStyle: {
            color: '#333',
            fontWeight: '600',
          },
          headerBackTitleStyle: {
            color: '#333',
          },
        }}>
        <Stack.Screen
          name="Dictionaries"
          component={DictionariesScreen}
          options={{title: 'Словари'}}
        />
        <Stack.Screen
          name="EditDictionary"
          component={EditDictionaryScreen}
          options={{title: 'Редактирование'}}
        />
        <Stack.Screen
          name="Cards"
          component={CardsScreen}
          options={{title: 'Карточки'}}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
