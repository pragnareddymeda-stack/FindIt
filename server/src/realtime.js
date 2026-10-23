// Holds the Socket.IO server once it has been started. Everything that wants to push an event goes through
// emitToUser, which reports honestly whether real-time delivery was possible (false when Socket.IO is not running).
let io = null;

export const setIo = (instance) => { io = instance; };
export const getIo = () => io;

export function emitToUser(userId, event, payload) {
  if (!io) return false;
  io.to(`user:${userId}`).emit(event, payload);
  return true;
}
