const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid'); // Add this at the top to import UUID library

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const lobbies = {};

// Serve static files (e.g., HTML, CSS, JS)
app.use(express.static(__dirname));

function isSetValid(set) {
    return ['background', 'shape', 'color'].every(prop => {
        const values = set.map(s => s[prop]);
        return new Set(values).size === 1 || new Set(values).size === 3;
    });
}

// Handle socket.io connections
io.on('connection', (socket) => {
    console.log(`New connection established: ${socket.id}`); // Debug log

    socket.on('createLobby', (playerName) => {
        let lobbyCode;
        do {
            lobbyCode = Math.random().toString(36).substring(2, 8).toUpperCase();
        } while (lobbies[lobbyCode]); // Ensure the lobby code is unique

        lobbies[lobbyCode] = { players: [{ name: playerName, socketId: socket.id }], host: socket.id };
        socket.join(lobbyCode);
        socket.emit('lobbyCreated', lobbyCode); // Emit the correct lobby code
        console.log(`Lobby created: ${lobbyCode}, Players:`, lobbies[lobbyCode].players); // Debug log
        console.log(`Emitting updatePlayers to lobby ${lobbyCode}:`, lobbies[lobbyCode].players.map(player => player.name)); // Debug log
        io.to(lobbyCode).emit('updatePlayers', lobbies[lobbyCode].players.map(player => player.name));
    });

    socket.on('joinLobby', ({ lobbyCode, playerName }) => {
        console.log(`joinLobby event received from ${socket.id} for lobby ${lobbyCode} as player ${playerName}`); // Debug log
        console.log(lobbies);
        if (lobbies[lobbyCode]) {
            // Check if the player is already in the lobby
            const existingPlayer = lobbies[lobbyCode].players.find(player => player.name === playerName);
            if (existingPlayer) {
                // Update the player's socketId if they are rejoining
                existingPlayer.socketId = socket.id;
                console.log(`Updated socketId for player: ${playerName}, New socketId: ${socket.id}`);
            } else {
                // Add the new player to the lobby
                lobbies[lobbyCode].players.push({ name: playerName, socketId: socket.id });
                console.log(`Player joined: ${playerName}, Lobby: ${lobbyCode}`);
            }

            socket.join(lobbyCode);
            socket.emit('lobbyJoined', lobbyCode); // Emit the correct lobby code

            // Emit the current player list to all clients in the lobby
            const playerNames = lobbies[lobbyCode].players.map(player => player.name);
            console.log(`Broadcasting updatePlayers to lobby ${lobbyCode}:`, playerNames);
            io.to(lobbyCode).emit('updatePlayers', playerNames);
        } else {
            console.error(`Lobby ${lobbyCode} not found for player ${playerName}`); // Debug log
            socket.emit('error', 'Lobby not found');
        }
    });

    function generateGameGrid() {
        const backgrounds = ['white', 'black', 'grey'];
        const shapes = ['circle', 'square', 'triangle'];
        const colors = ['red', 'green', 'blue'];

        const allCombinations = [];
        backgrounds.forEach(background => {
            shapes.forEach(shape => {
                colors.forEach(color => {
                    allCombinations.push({ background, shape, color });
                });
            });
        });

        // Shuffle combinations and pick the first 9
        for (let i = allCombinations.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [allCombinations[i], allCombinations[j]] = [allCombinations[j], allCombinations[i]];
        }

        return allCombinations.slice(0, 9);
    }

    socket.on('startGame', () => {
        const lobbyCode = Object.keys(lobbies).find(code => lobbies[code].host === socket.id);
        if (lobbyCode) {
            console.log(`Game started in lobby ${lobbyCode}`); // Debug log
            const gameGrid = generateGameGrid();
            lobbies[lobbyCode].gameGrid = gameGrid; // Reset the grid in the lobby
            lobbies[lobbyCode].scores = {}; // Reset scores
            lobbies[lobbyCode].foundSets = []; // Reset found sets

            // Ensure players remain in the lobby during the game
            lobbies[lobbyCode].inactive = false;

            io.to(lobbyCode).emit('gameGrid', gameGrid); // Broadcast the new grid to all clients
            io.to(lobbyCode).emit('gameStarted'); // Notify clients that the game has started
        } else {
            console.error(`Host ${socket.id} tried to start a game but no lobby was found`); // Debug log
        }
    });

    socket.on('submitSet', ({ lobbyCode, playerName, set }) => {
        if (lobbies[lobbyCode]) {
            const lobby = lobbies[lobbyCode];
            const setNumbers = set.split(', ').map(num => parseInt(num, 10) - 1);
            const selectedSquares = setNumbers.map(index => lobby.gameGrid[index]);

            if (isSetValid(selectedSquares) && !lobby.foundSets.includes(set)) {
                lobby.foundSets.push(set); // Add the set to the shared list
                lobby.scores[playerName] = (lobby.scores[playerName] || 0) + 1; // Update the player's score
                io.to(lobbyCode).emit('updateScores', lobby.scores); // Broadcast updated scores
                io.to(lobbyCode).emit('updateFoundSets', lobby.foundSets); // Broadcast updated found sets
                socket.emit('setFeedback', { success: true, message: 'Correct set!' }); // Send success feedback
            } else if (lobby.foundSets.includes(set)) {
                socket.emit('setFeedback', { success: false, message: 'Set has already been found.' }); // Feedback for duplicate set
            } else {
                lobby.scores[playerName] = (lobby.scores[playerName] || 0) - 1; // Deduct a point for an invalid set
                io.to(lobbyCode).emit('updateScores', lobby.scores); // Broadcast updated scores
                socket.emit('setFeedback', { success: false, message: 'Incorrect set.' }); // Feedback for invalid set
            }
        } else {
            console.error(`Lobby ${lobbyCode} not found for submitSet`); // Debug log
        }
    });

    socket.on('requestGameGrid', (lobbyCode) => {
        if (lobbies[lobbyCode] && lobbies[lobbyCode].gameGrid) {
            socket.emit('gameGrid', lobbies[lobbyCode].gameGrid); // Send the game grid to the requesting client
        } else {
            console.error(`Game grid not found for lobby ${lobbyCode}`); // Debug log
        }
    });

    socket.on('checkNoMoreSets', ({ lobbyCode, playerName }) => {
        if (lobbies[lobbyCode] && lobbies[lobbyCode].gameGrid) {
            const grid = lobbies[lobbyCode].gameGrid;
            const foundSets = lobbies[lobbyCode].foundSets || [];

            const combinations = [];
            for (let i = 0; i < grid.length; i++) {
                for (let j = i + 1; j < grid.length; j++) {
                    for (let k = j + 1; k < grid.length; k++) {
                        combinations.push([grid[i], grid[j], grid[k]]);
                    }
                }
            }

            const noMoreSets = !combinations.some(combo => {
                const setNumbers = combo.map(s => grid.indexOf(s) + 1).sort((a, b) => a - b).join(', ');
                return isSetValid(combo) && !foundSets.includes(setNumbers);
            });

            if (noMoreSets) {
                // Award 3 points to the player who declared no more sets
                lobbies[lobbyCode].scores[playerName] = (lobbies[lobbyCode].scores[playerName] || 0) + 3;
                io.to(lobbyCode).emit('updateScores', lobbies[lobbyCode].scores); // Broadcast updated scores
            } else {
                // Deduct 1 point for an incorrect declaration
                lobbies[lobbyCode].scores[playerName] = (lobbies[lobbyCode].scores[playerName] || 0) - 1;
                io.to(lobbyCode).emit('updateScores', lobbies[lobbyCode].scores); // Broadcast updated scores
            }

            socket.emit('noMoreSetsResult', { noMoreSets });
        } else {
            console.error(`Game grid not found for lobby ${lobbyCode}`); // Debug log
        }
    });

    socket.on('disconnect', () => {
        console.log(`Socket disconnected: ${socket.id}`); // Debug log
        for (const [lobbyCode, lobby] of Object.entries(lobbies)) {
            const index = lobby.players.findIndex(player => player.socketId === socket.id);
            if (index !== -1) {
                lobby.players.splice(index, 1);
                if (lobby.players.length === 0) {
                    // Mark the lobby as inactive only if no players are left
                    lobby.inactive = true;
                    console.log(`Lobby ${lobbyCode} is now inactive.`);
                } else {
                    io.to(lobbyCode).emit('updatePlayers', lobby.players.map(player => player.name));
                }
                break;
            }
        }
    });
});

// Start the server
const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
