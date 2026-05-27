import { io } from 'socket.io-client';
import BASE_URL from '../endpoints/endpoints';

// Shared socket singleton - reused across all components to avoid duplicate connections
let socket = null;

export const getSocket = () => {
  if (!socket || socket.disconnected) {
    socket = io(BASE_URL, { transports: ['websocket', 'polling'] });
  }
  return socket;
};

export default getSocket;
