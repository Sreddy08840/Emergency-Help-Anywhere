let ioInstance = null;

// Store the created Socket.IO server so route handlers can access it.
export function initIo(io) {
  ioInstance = io;
}

// Helper to get the current Socket.IO server instance.
export function getIo() {
  return ioInstance;
}
