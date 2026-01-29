const DEFAULT_ROOM_ID = 'main';

function joinDefaultRoom(socket) {
  socket.join(DEFAULT_ROOM_ID);
  return DEFAULT_ROOM_ID;
}

module.exports = {
  DEFAULT_ROOM_ID,
  joinDefaultRoom
};


