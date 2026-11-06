// Importado pelo index.js, antes do expo-router, para o widget Android funcionar com o app fechado.
import { Platform } from 'react-native';

if (Platform.OS === 'android') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  (require('./tarefa') as typeof import('./tarefa')).registrarTarefaDoWidget();
}
