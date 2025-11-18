# Battleship Multiplayer (4-digit code)

Simple two-player Battleship web app using a 4-digit code to create/join a room. Built with Node.js, Express and Socket.IO. This is a minimal implementation for local testing.

Features
- Create or join a game by entering a 4-digit code
- Place ships on a 10x10 board
- Real-time play against an opponent using Socket.IO

Getting started (Windows PowerShell)

1. Install dependencies

```powershell
cd "c:\Users\steph\Battelship - Y12 Mini"
npm install
```

2. Run the server

```powershell
npm start
```

3. Open two browser windows and go to `http://localhost:3000`.
   - In one window create a 4-digit code (e.g. `1234`).
   - In the other window join using the same 4-digit code.
   - Place your ships and play.

Notes / Limitations
- This is an in-memory, minimal demo. Rooms and state are lost when the server restarts.
- No persistent authentication or reconnection logic.
- Board placement is simple click-based; orientation toggle is provided.

If you want, I can:
- Add persistence (Redis or a database)
- Improve UI/UX and visual ship placement (drag & drop)
- Add reconnection support and spectating
