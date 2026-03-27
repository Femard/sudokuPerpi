/**
 * Main Application Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    // Letter Mapping (1-9) -> PERPIGNAN letters and distinct colors
    const MAPPING = {
        1: { char: 'P', colorClass: 'c1' }, // Red
        2: { char: 'E', colorClass: 'c2' }, // Orange
        3: { char: 'R', colorClass: 'c3' }, // Gold
        4: { char: 'P', colorClass: 'c4' }, // Green (Distinct P)
        5: { char: 'I', colorClass: 'c5' }, // Teal
        6: { char: 'G', colorClass: 'c6' }, // Blue
        7: { char: 'N', colorClass: 'c7' }, // Indigo (Distinct N)
        8: { char: 'A', colorClass: 'c8' }, // Purple
        9: { char: 'N', colorClass: 'c9' }  // Pink (Distinct N)
    };

    let generator = new SudokuGenerator();
    let currentSolved = null;
    let currentPuzzle = null;
    let userBoard = null;
    
    let selectedCell = null;
    let selectedNumber = null;

    // DOM Elements
    const boardEl = document.getElementById('board');
    const paletteEl = document.getElementById('palette');
    const btnNewGame = document.getElementById('btn-new-game');
    const difficultySelect = document.getElementById('difficulty');
    const btnCheck = document.getElementById('btn-check');
    const btnHint = document.getElementById('btn-hint');
    const btnErase = document.getElementById('btn-erase');
    const btnExportPng = document.getElementById('btn-export-png');
    const btnExportPdf = document.getElementById('btn-export-pdf');
    const btnExportBatch = document.getElementById('btn-export-batch');
    const modal = document.getElementById('victory-modal');
    const btnCloseModal = document.getElementById('btn-close-modal');

    // Initialization
    initPalette();
    startNewGame();

    // Event Listeners
    btnNewGame.addEventListener('click', startNewGame);
    btnCheck.addEventListener('click', checkBoard);
    btnHint.addEventListener('click', giveHint);
    btnErase.addEventListener('click', () => {
        if (selectedCell && !selectedCell.classList.contains('given')) {
            updateCell(selectedCell, 0);
        }
    });
    btnCloseModal.addEventListener('click', () => modal.classList.add('hidden'));
    
    // Exports
    btnExportPng.addEventListener('click', exportToPng);
    btnExportPdf.addEventListener('click', exportToPdf);
    btnExportBatch.addEventListener('click', exportBatchToPdf);

    // Keyboard support
    document.addEventListener('keydown', handleKeyboard);

    function startNewGame() {
        const diff = difficultySelect.value;
        const generated = generator.generatePuzzle(diff);
        currentSolved = generated.solvedData;
        currentPuzzle = JSON.parse(JSON.stringify(generated.puzzleData));
        userBoard = JSON.parse(JSON.stringify(generated.puzzleData));
        selectedCell = null;
        renderBoard();
    }

    function initPalette() {
        paletteEl.innerHTML = '';
        for (let i = 1; i <= 9; i++) {
            const btn = document.createElement('div');
            btn.className = `palette-btn ${MAPPING[i].colorClass}`;
            btn.dataset.val = i;
            btn.textContent = MAPPING[i].char;
            
            btn.addEventListener('click', () => {
                // Select number from palette
                document.querySelectorAll('.palette-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedNumber = i;
                
                // If a cell is already selected, fill it
                if (selectedCell && !selectedCell.classList.contains('given')) {
                    updateCell(selectedCell, selectedNumber);
                }
            });
            
            paletteEl.appendChild(btn);
        }
    }

    function renderBoard() {
        boardEl.innerHTML = '';
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                const val = userBoard[r][c];
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.r = r;
                cell.dataset.c = c;
                
                // If it's a given value (from original puzzle data)
                if (currentPuzzle[r][c] !== 0) {
                    cell.classList.add('given');
                    cell.textContent = MAPPING[val].char;
                    cell.classList.add(MAPPING[val].colorClass);
                } else if (val !== 0) {
                    // It's a user filled value
                    cell.textContent = MAPPING[val].char;
                    cell.classList.add(MAPPING[val].colorClass);
                }

                cell.addEventListener('click', () => onCellClick(cell));
                boardEl.appendChild(cell);
            }
        }
    }

    function onCellClick(cell) {
        // Clear previous selection
        document.querySelectorAll('.cell').forEach(c => {
            c.classList.remove('selected');
            c.classList.remove('error'); // Clear errors on new selection
        });
        
        selectedCell = cell;
        cell.classList.add('selected');

        // If a number is currently selected in palette and cell is not given
        if (selectedNumber !== null && !cell.classList.contains('given')) {
            updateCell(cell, selectedNumber);
        }
    }

    function updateCell(cell, val) {
        const r = parseInt(cell.dataset.r);
        const c = parseInt(cell.dataset.c);
        
        userBoard[r][c] = val;
        
        // Remove all color classes
        for (let i = 1; i <= 9; i++) {
            cell.classList.remove(MAPPING[i].colorClass);
        }
        cell.classList.remove('error');
        
        if (val === 0) {
            cell.textContent = '';
        } else {
            cell.textContent = MAPPING[val].char;
            cell.classList.add(MAPPING[val].colorClass);
        }

        checkWinCondition();
    }

    function checkBoard() {
        let hasErrors = false;
        const cells = boardEl.querySelectorAll('.cell');
        
        cells.forEach(cell => {
            if (cell.classList.contains('given')) return;
            
            const r = parseInt(cell.dataset.r);
            const c = parseInt(cell.dataset.c);
            const val = userBoard[r][c];
            
            cell.classList.remove('error');
            
            if (val !== 0 && val !== currentSolved[r][c]) {
                cell.classList.add('error');
                hasErrors = true;
                // remove error class after animation completes to allow it to trigger again
                setTimeout(() => cell.classList.remove('error'), 500);
            }
        });

        if (!hasErrors) {
            // Optional: visual feedback that it's good so far
        }
    }

    function giveHint() {
        if (!selectedCell || selectedCell.classList.contains('given')) return;
        
        const r = parseInt(selectedCell.dataset.r);
        const c = parseInt(selectedCell.dataset.c);
        
        if (userBoard[r][c] !== currentSolved[r][c]) {
            updateCell(selectedCell, currentSolved[r][c]);
        }
    }

    function checkWinCondition() {
        for (let r = 0; r < 9; r++) {
            for (let c = 0; c < 9; c++) {
                if (userBoard[r][c] !== currentSolved[r][c]) {
                    return false;
                }
            }
        }
        
        // Win!
        setTimeout(() => {
            modal.classList.remove('hidden');
        }, 300);
        return true;
    }

    function handleKeyboard(e) {
        if (!selectedCell || selectedCell.classList.contains('given')) return;
        
        // Numbers 1-9 to allow typing directly (for power users, though they won't know the mapping easily)
        if (e.key >= '1' && e.key <= '9') {
            updateCell(selectedCell, parseInt(e.key));
        } else if (e.key === 'Backspace' || e.key === 'Delete') {
            updateCell(selectedCell, 0);
        }
    }

    // Export functionality
    async function exportToPng() {
        const captureArea = document.getElementById('capture-area');
        btnExportPng.disabled = true;
        btnExportPng.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Exportation...';
        
        try {
            // Unselect cell before capture to make it look clean
            if (selectedCell) selectedCell.classList.remove('selected');
            
            const canvas = await html2canvas(captureArea, {
                scale: 2, // High resolution
                backgroundColor: '#ffffff'
            });
            
            const link = document.createElement('a');
            link.download = `Sudoku_Perpignan_${new Date().getTime()}.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
            
            // Restore selection
            if (selectedCell) selectedCell.classList.add('selected');
        } catch (error) {
            console.error("Erreur capture PNG", error);
            alert("Erreur lors de l'exportation PNG.");
        } finally {
            btnExportPng.disabled = false;
            btnExportPng.innerHTML = '<i class="fa-solid fa-image"></i> Exporter PNG';
        }
    }

    async function exportToPdf() {
        const captureArea = document.getElementById('capture-area');
        btnExportPdf.disabled = true;
        btnExportPdf.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Exportation...';
        
        try {
            if (selectedCell) selectedCell.classList.remove('selected');
            
            const canvas = await html2canvas(captureArea, {
                scale: 2,
                backgroundColor: '#ffffff'
            });
            
            const imgData = canvas.toDataURL('image/png');
            // A4 page: 210 x 297 mm
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            
            // Add Title
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(24);
            pdf.setTextColor(210, 27, 27); // Sang et or red
            pdf.text("Sudoku Perpignan", 105, 20, { align: "center" });
            
            // Calculate image dimensions (maintain aspect ratio)
            const imgProps = pdf.getImageProperties(imgData);
            const pdfWidth = 150; // max width
            const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
            
            // Center image horizontally
            const marginLeft = (210 - pdfWidth) / 2;
            
            pdf.addImage(imgData, 'PNG', marginLeft, 40, pdfWidth, pdfHeight);
            
            pdf.setFontSize(10);
            pdf.setTextColor(100, 100, 100);
            pdf.text(`Généré le: ${new Date().toLocaleDateString('fr-FR')}`, 105, 40 + pdfHeight + 10, { align: "center" });
            
            pdf.save(`Sudoku_Perpignan_${new Date().getTime()}.pdf`);
            
            if (selectedCell) selectedCell.classList.add('selected');
        } catch (error) {
            console.error("Erreur capture PDF", error);
            alert("Erreur lors de l'exportation PDF.");
        } finally {
            btnExportPdf.disabled = false;
            btnExportPdf.innerHTML = '<i class="fa-solid fa-file-pdf"></i> Exporter PDF';
        }
    }

    async function exportBatchToPdf() {
        btnExportBatch.disabled = true;
        btnExportBatch.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Exportation...';
        
        // Wait a small tick so the UI updates
        await new Promise(r => setTimeout(r, 50));
        
        try {
            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF('p', 'mm', 'a4');
            const batches = [
                { diff: 'easy', count: 35, label: 'Facile' },
                { diff: 'medium', count: 25, label: 'Moyen' },
                { diff: 'hard', count: 20, label: 'Difficile' }
            ];

            const generatedPuzzles = [];
            const seen = new Set();
            
            batches.forEach(b => {
                let count = 0;
                while(count < b.count) {
                    const generated = generator.generatePuzzle(b.diff);
                    const serialized = JSON.stringify(generated.puzzleData);
                    if (!seen.has(serialized)) {
                        seen.add(serialized);
                        generatedPuzzles.push({ puzzle: generated.puzzleData, difficulty: b.label });
                        count++;
                    }
                }
            });

            const pdfColorMapping = {
                1: [229, 57, 53],
                2: [245, 124, 0],
                3: [251, 192, 45],
                4: [67, 160, 71],
                5: [0, 172, 193],
                6: [30, 136, 229],
                7: [57, 73, 171],
                8: [142, 36, 170],
                9: [216, 27, 96]
            };

            for(let i=0; i < generatedPuzzles.length; i++) {
                if (i > 0 && i % 2 === 0) {
                    pdf.addPage();
                }

                const puzzleObj = generatedPuzzles[i];
                const board = puzzleObj.puzzle;
                const isTop = (i % 2 === 0);
                
                const startY = isTop ? 30 : 160;
                const startX = 40;
                const cellSize = 14.5;
                const boardSize = cellSize * 9;
                
                // Add title
                pdf.setFont("helvetica", "bold");
                pdf.setFontSize(16);
                pdf.setTextColor(218, 18, 26);
                pdf.text(`Perpignan Sudoku - ${puzzleObj.difficulty} #${i + 1}`, 105, startY - 10, { align: "center" });
                
                // Draw grid
                for(let r = 0; r <= 9; r++) {
                    const y = startY + r * cellSize;
                    if (r % 3 === 0) {
                        pdf.setLineWidth(1.0);
                        pdf.setDrawColor(218, 18, 26);
                    } else {
                        pdf.setLineWidth(0.3);
                        pdf.setDrawColor(200, 200, 200);
                    }
                    pdf.line(startX, y, startX + boardSize, y);
                }
                
                for(let c = 0; c <= 9; c++) {
                    const x = startX + c * cellSize;
                    if (c % 3 === 0) {
                        pdf.setLineWidth(1.0);
                        pdf.setDrawColor(218, 18, 26);
                    } else {
                        pdf.setLineWidth(0.3);
                        pdf.setDrawColor(200, 200, 200);
                    }
                    pdf.line(x, startY, x, startY + boardSize);
                }
                
                // Fill numbers
                pdf.setFont("helvetica", "bold");
                pdf.setFontSize(16);
                
                for(let r = 0; r < 9; r++) {
                    for(let c = 0; c < 9; c++) {
                        const val = board[r][c];
                        if (val !== 0) {
                            const rgb = pdfColorMapping[val];
                            pdf.setTextColor(rgb[0], rgb[1], rgb[2]);
                            
                            const char = MAPPING[val].char;
                            const textX = startX + c * cellSize + (cellSize / 2);
                            const textY = startY + r * cellSize + (cellSize / 2) + 5.5; 
                            pdf.text(char, textX, textY, { align: "center", baseline: "middle" });
                        }
                    }
                }
            }

            pdf.save(`Sudoku_Perpignan_Lot_80.pdf`);

        } catch (error) {
            console.error("Erreur batch export", error);
            alert("Erreur lors de l'exportation du lot.");
        } finally {
            btnExportBatch.disabled = false;
            btnExportBatch.innerHTML = '<i class="fa-solid fa-layer-group"></i> Exporter Lot (80)';
        }
    }
});
