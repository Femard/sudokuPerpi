/**
 * Sudoku Generator & Solver Logic
 */

class SudokuGenerator {
    constructor() {
        this.board = Array(9).fill().map(() => Array(9).fill(0));
    }

    // Initialize an empty board
    initBoard() {
        this.board = Array(9).fill().map(() => Array(9).fill(0));
    }

    // Check if number can be placed at board[row][col]
    isValid(board, row, col, num) {
        // Check row
        for (let x = 0; x < 9; x++) {
            if (board[row][x] === num) return false;
        }

        // Check col
        for (let x = 0; x < 9; x++) {
            if (board[x][col] === num) return false;
        }

        // Check 3x3 box
        let startRow = row - row % 3, startCol = col - col % 3;
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                if (board[i + startRow][j + startCol] === num) return false;
            }
        }

        return true;
    }

    // Solve the board using backtracking
    solve(board) {
        let row = -1;
        let col = -1;
        let isEmpty = false;
        
        for (let i = 0; i < 9; i++) {
            for (let j = 0; j < 9; j++) {
                if (board[i][j] === 0) {
                    row = i;
                    col = j;
                    isEmpty = true;
                    break;
                }
            }
            if (isEmpty) break;
        }

        // no empty space left
        if (!isEmpty) return true;

        for (let num = 1; num <= 9; num++) {
            if (this.isValid(board, row, col, num)) {
                board[row][col] = num;
                if (this.solve(board)) {
                    return true;
                }
                board[row][col] = 0; // backtrack
            }
        }
        return false;
    }

    // Generate a fully solved board
    fillDiagonal() {
        for (let i = 0; i < 9; i = i + 3) {
            this.fillBox(i, i);
        }
    }

    fillBox(rowStart, colStart) {
        let num;
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                do {
                    num = this.randomGenerator(9);
                } while (!this.unUsedInBox(rowStart, colStart, num));
                this.board[rowStart + i][colStart + j] = num;
            }
        }
    }

    randomGenerator(num) {
        return Math.floor(Math.random() * num + 1);
    }

    unUsedInBox(rowStart, colStart, num) {
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                if (this.board[rowStart + i][colStart + j] === num) return false;
            }
        }
        return true;
    }

    generateSolvedBoard() {
        this.initBoard();
        this.fillDiagonal();
        this.solve(this.board);
        return JSON.parse(JSON.stringify(this.board));
    }

    // Remove K digits to create a puzzle
    removeKDigits(board, K) {
        let count = K;
        while (count !== 0) {
            let cellId = this.randomGenerator(81) - 1;
            let i = Math.floor(cellId / 9);
            let j = cellId % 9;
            if (board[i][j] !== 0) {
                count--;
                board[i][j] = 0;
            }
        }
        return board;
    }

    // Main API to get a new puzzle
    generatePuzzle(difficulty) {
        let solved = this.generateSolvedBoard();
        let removeCount = 40; // medium by default
        
        switch(difficulty) {
            case 'easy': removeCount = 30; break;
            case 'medium': removeCount = 45; break;
            case 'hard': removeCount = 55; break;
        }

        let puzzle = JSON.parse(JSON.stringify(solved));
        puzzle = this.removeKDigits(puzzle, removeCount);

        return {
            solvedData: solved,
            puzzleData: puzzle
        };
    }
}
