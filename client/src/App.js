import React, { useState, useEffect } from 'react';
import { Box, Grid, Button, Text, VStack, useToast } from '@chakra-ui/react';

const App = () => {
  const [gameState, setGameState] = useState({
    board: Array(5).fill().map(() => Array(5).fill(null)),
    currentPlayer: 'A',
    selectedPiece: null,
    moveHistory: [],
    gameOver: false,
    winner: null,
  });
  const [ws, setWs] = useState(null);
  const toast = useToast();

  useEffect(() => {
    const socket = new WebSocket('ws://localhost:8080');
   
    socket.onopen = () => {
      console.log('Connected to server');
      setWs(socket);
    };

    socket.onmessage = (event) => {
      console.log('Received message:', event.data);
      const data = JSON.parse(event.data);
      if (data.type === 'gameState') {
        setGameState(prevState => ({
          ...prevState,
          ...data.state,
          selectedPiece: null,
        }));
      } else if (data.type === 'gameOver') {
        toast({
          title: 'Game Over',
          description: `Player ${data.winner} wins!`,
          status: 'success',
          duration: 5000,
          isClosable: true,
        });
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    return () => {
      socket.close();
    };
  }, []);

  const handleCellClick = (row, col) => {
    if (!ws || gameState.gameOver) return;
    if (gameState.selectedPiece) {
      console.log('Sending move:', {
        type: 'move',
        from: gameState.selectedPiece,
        to: [row, col]
      });
      ws.send(JSON.stringify({
        type: 'move',
        from: gameState.selectedPiece,
        to: [row, col]
      }));
      setGameState(prevState => ({ ...prevState, selectedPiece: null }));
    } else {
      const piece = gameState.board[row][col];
      if (piece && piece.startsWith(gameState.currentPlayer)) {
        setGameState(prevState => ({ ...prevState, selectedPiece: [row, col] }));
      }
    }
  };

  return (
    <VStack spacing={4} align="center" m={4}>
      <Text fontSize="2xl" fontWeight="bold">Chess-like Game</Text>
      <Text>Current Player: {gameState.currentPlayer}</Text>
      {gameState.gameOver && <Text fontSize="xl" color="green.500">Player {gameState.winner} wins!</Text>}
      <Grid templateColumns="repeat(5, 1fr)" gap={2}>
        {gameState.board.map((row, rowIndex) =>
          row.map((cell, colIndex) => (
            <Button
              key={`${rowIndex}-${colIndex}`}
              onClick={() => handleCellClick(rowIndex, colIndex)}
              w="60px"
              h="60px"
              bg={gameState.selectedPiece && gameState.selectedPiece[0] === rowIndex && gameState.selectedPiece[1] === colIndex ? 'yellow.200' : 'gray.700'}
              color={cell && (cell.startsWith('A') ? 'red.500' : 'blue.500')}
              border="1px"
              borderColor="gray.300"
              fontSize="sm"
              isDisabled={gameState.gameOver}
            >
              {cell}
            </Button>
          ))
        )}
      </Grid>
      <Box>
        <Text fontWeight="bold">Move History:</Text>
        <VStack align="start" maxH="200px" overflowY="auto">
          {gameState.moveHistory.map((move, index) => (
            <Text key={index}>{move}</Text>
          ))}
        </VStack>
      </Box>
    </VStack>
  );
};

export default App;