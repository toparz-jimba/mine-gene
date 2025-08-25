/**
 * Minesweeper Core Module
 * 共通のゲームロジックを提供する基底クラス
 */

class MinesweeperCore {
    constructor() {
        this.board = [];
        this.revealed = [];
        this.flagged = [];
        this.questioned = [];
        this.gameOver = false;
        this.gameWon = false;
        this.firstClick = true;
        this.mineCount = 0;
        this.timer = 0;
        this.timerInterval = null;
        this.isPaused = false;
        this.pausedTime = 0;
        this.initVisibilityHandlers();
    }

    /**
     * ボードを初期化
     */
    initBoard(rows, cols, mines) {
        this.rows = rows;
        this.cols = cols;
        this.totalMines = mines;
        this.mineCount = mines;
        this.board = Array(rows).fill(null).map(() => Array(cols).fill(0));
        this.revealed = Array(rows).fill(null).map(() => Array(cols).fill(false));
        this.flagged = Array(rows).fill(null).map(() => Array(cols).fill(false));
        this.questioned = Array(rows).fill(null).map(() => Array(cols).fill(false));
        this.gameOver = false;
        this.gameWon = false;
        this.firstClick = true;
    }

    /**
     * 地雷を配置（最初のクリック位置を避ける）
     */
    placeMines(excludeRow, excludeCol) {
        let minesPlaced = 0;
        while (minesPlaced < this.totalMines) {
            const row = Math.floor(Math.random() * this.rows);
            const col = Math.floor(Math.random() * this.cols);
            
            if (this.board[row][col] !== -1 && !(row === excludeRow && col === excludeCol)) {
                this.board[row][col] = -1;
                minesPlaced++;
                
                // 周囲のセルの数字を更新
                for (let dr = -1; dr <= 1; dr++) {
                    for (let dc = -1; dc <= 1; dc++) {
                        const newRow = row + dr;
                        const newCol = col + dc;
                        if (this.isValidCell(newRow, newCol) && this.board[newRow][newCol] !== -1) {
                            this.board[newRow][newCol]++;
                        }
                    }
                }
            }
        }
    }

    /**
     * セルが有効範囲内かチェック
     */
    isValidCell(row, col) {
        return row >= 0 && row < this.rows && col >= 0 && col < this.cols;
    }

    /**
     * セルを開く
     */
    revealCell(row, col) {
        if (!this.isValidCell(row, col) || this.revealed[row][col] || 
            this.flagged[row][col] || this.gameOver || this.gameWon) {
            return;
        }

        if (this.firstClick) {
            this.placeMines(row, col);
            this.firstClick = false;
            this.startTimer();
        }

        this.revealed[row][col] = true;
        this.questioned[row][col] = false;

        if (this.board[row][col] === -1) {
            this.gameOver = true;
            this.stopTimer();
            this.revealAllMines();
            this.onGameOver();
            return;
        }

        if (this.board[row][col] === 0) {
            this.revealAdjacentCells(row, col);
        }

        if (this.checkWin()) {
            this.gameWon = true;
            this.stopTimer();
            this.onGameWon();
        }
    }

    /**
     * 隣接するセルを開く（0の場合）
     */
    revealAdjacentCells(row, col) {
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                const newRow = row + dr;
                const newCol = col + dc;
                if (this.isValidCell(newRow, newCol) && !this.revealed[newRow][newCol]) {
                    this.revealCell(newRow, newCol);
                }
            }
        }
    }

    /**
     * 旗を立てる/外す
     */
    toggleFlag(row, col) {
        if (!this.isValidCell(row, col) || this.revealed[row][col] || 
            this.gameOver || this.gameWon) {
            return;
        }

        if (this.flagged[row][col]) {
            this.flagged[row][col] = false;
            this.mineCount++;
        } else if (!this.questioned[row][col]) {
            this.flagged[row][col] = true;
            this.mineCount--;
        }
        
        this.onFlagToggle(row, col);
    }

    /**
     * ?マークを付ける/外す
     */
    toggleQuestion(row, col) {
        if (!this.isValidCell(row, col) || this.revealed[row][col] || 
            this.gameOver || this.gameWon) {
            return;
        }

        if (this.flagged[row][col]) {
            this.flagged[row][col] = false;
            this.questioned[row][col] = true;
            this.mineCount++;
        } else if (this.questioned[row][col]) {
            this.questioned[row][col] = false;
        } else {
            this.questioned[row][col] = true;
        }
        
        this.onQuestionToggle(row, col);
    }

    /**
     * 勝利判定
     */
    checkWin() {
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                if (this.board[row][col] !== -1 && !this.revealed[row][col]) {
                    return false;
                }
            }
        }
        return true;
    }

    /**
     * すべての地雷を表示
     */
    revealAllMines() {
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                if (this.board[row][col] === -1) {
                    this.revealed[row][col] = true;
                }
            }
        }
    }

    /**
     * タイマー開始
     */
    startTimer() {
        this.timer = 0;
        this.isPaused = false;
        this.pausedTime = 0;
        this.timerInterval = setInterval(() => {
            if (!this.isPaused) {
                this.timer++;
                this.onTimerUpdate(this.timer);
            }
        }, 1000);
    }

    /**
     * タイマー停止
     */
    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    /**
     * タイマー一時停止
     */
    pauseTimer() {
        if (!this.isPaused && this.timerInterval && !this.gameOver && !this.gameWon) {
            this.isPaused = true;
            this.pausedTime = Date.now();
        }
    }

    /**
     * タイマー再開
     */
    resumeTimer() {
        if (this.isPaused && this.timerInterval && !this.gameOver && !this.gameWon) {
            this.isPaused = false;
            const pauseDuration = Date.now() - this.pausedTime;
            // 一時停止していた時間分を補正（1秒以上の場合）
            if (pauseDuration > 1000) {
                const secondsPaused = Math.floor(pauseDuration / 1000);
                // タイマーの表示を更新
                this.onTimerUpdate(this.timer);
            }
        }
    }

    /**
     * ページ表示状態の変更を検出してタイマーを制御
     */
    initVisibilityHandlers() {
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', () => {
                if (document.hidden) {
                    this.pauseTimer();
                } else {
                    this.resumeTimer();
                }
            });

            window.addEventListener('blur', () => {
                this.pauseTimer();
            });

            window.addEventListener('focus', () => {
                this.resumeTimer();
            });
        }
    }

    /**
     * リセット
     */
    reset() {
        this.stopTimer();
        this.timer = 0;
        this.isPaused = false;
        this.pausedTime = 0;
        this.gameOver = false;
        this.gameWon = false;
        this.firstClick = true;
    }

    // オーバーライド用のフック
    onGameOver() {}
    onGameWon() {}
    onFlagToggle(row, col) {}
    onQuestionToggle(row, col) {}
    onTimerUpdate(time) {}
}

// エクスポート（ES6モジュール対応）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MinesweeperCore;
}

// ブラウザ環境でグローバルに公開
if (typeof window !== 'undefined') {
    window.MinesweeperCore = MinesweeperCore;
}