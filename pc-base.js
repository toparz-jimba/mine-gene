
// PCMinesweeper: MinesweeperCoreを継承したPC版の実装
class PCMinesweeper extends MinesweeperCore {
    constructor() {
        super();
        
        // 難易度設定
        this.difficulties = {
            easy: { rows: 9, cols: 9, mines: 10 },
            medium: { rows: 16, cols: 16, mines: 40 },
            hard: { rows: 16, cols: 30, mines: 99 },
            hiddeneasy: { rows: 9, cols: 9, mines: 20 },
            hiddenmedium: { rows: 16, cols: 16, mines: 64 },
            hiddenhard: { rows: 16, cols: 30, mines: 120 },
            extreme: { rows: 64, cols: 64, mines: 999 }
        };
        
        this.currentDifficulty = 'easy';
        this.zoomLevel = 1.0;
        this.minZoom = 0.3;
        this.maxZoom = 3.0;
        this.zoomStep = 0.1;
        
        // フォントサイズ関連の変数
        this.currentFontSize = 100; // パーセンテージ
        this.minFontSize = 50;
        this.maxFontSize = 200;
        this.fontSizeStep = 25;
        
        // ドラッグ関連の変数
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.scrollStartX = 0;
        this.scrollStartY = 0;
        
        // 旗アニメーション設定
        this.flagAnimationEnabled = true;
        
        // 省電力モード設定
        this.powerSaveMode = false;
        
        // リバース操作設定
        this.reverseMode = false;
        
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.newGame();
    }
    
    setupEventListeners() {
        const resetBtn = document.getElementById('reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.newGame());
        }
        
        
        const difficultySelect = document.getElementById('difficulty-select');
        if (difficultySelect) {
            difficultySelect.addEventListener('change', (e) => {
                this.currentDifficulty = e.target.value;
                this.newGame();
                this.closeSettings();
            });
        }
        
        const zoomInBtn = document.getElementById('zoom-in-btn');
        if (zoomInBtn) {
            zoomInBtn.addEventListener('click', () => this.zoomIn());
        }
        
        const zoomOutBtn = document.getElementById('zoom-out-btn');
        if (zoomOutBtn) {
            zoomOutBtn.addEventListener('click', () => this.zoomOut());
        }
        
        const settingsBtn = document.getElementById('settings-btn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                this.openSettings();
            });
        }
        
        const helpBtn = document.getElementById('help-btn');
        if (helpBtn) {
            helpBtn.addEventListener('click', () => {
                this.openHelp();
            });
        }
        
        const closeSettingsBtn = document.getElementById('close-settings');
        if (closeSettingsBtn) {
            closeSettingsBtn.addEventListener('click', () => {
                this.closeSettings();
            });
        }
        
        const closeHelpBtn = document.getElementById('close-help');
        if (closeHelpBtn) {
            closeHelpBtn.addEventListener('click', () => {
                this.closeHelp();
            });
        }
        
        const fontSizeUpBtn = document.getElementById('font-size-up-btn');
        if (fontSizeUpBtn) {
            fontSizeUpBtn.addEventListener('click', () => {
                this.increaseFontSize();
            });
        }
        
        const fontSizeDownBtn = document.getElementById('font-size-down-btn');
        if (fontSizeDownBtn) {
            fontSizeDownBtn.addEventListener('click', () => {
                this.decreaseFontSize();
            });
        }
        
        const themeToggleBtn = document.getElementById('theme-toggle-btn');
        if (themeToggleBtn) {
            themeToggleBtn.addEventListener('click', () => {
                this.toggleTheme();
            });
        }
        
        const flagAnimationToggleBtn = document.getElementById('flag-animation-toggle-btn');
        if (flagAnimationToggleBtn) {
            flagAnimationToggleBtn.addEventListener('click', () => {
                this.toggleFlagAnimation();
            });
        }
        
        const powerSaveToggleBtn = document.getElementById('power-save-toggle-btn');
        if (powerSaveToggleBtn) {
            powerSaveToggleBtn.addEventListener('click', () => {
                this.togglePowerSaveMode();
            });
        }
        
        const reverseToggleBtn = document.getElementById('reverse-toggle-btn');
        if (reverseToggleBtn) {
            reverseToggleBtn.addEventListener('click', () => {
                this.toggleReverseMode();
            });
        }
        
        // 設定モーダルの外側クリックで閉じる
        const settingsModal = document.getElementById('settings-modal');
        if (settingsModal) {
            settingsModal.addEventListener('click', (e) => {
                if (e.target === settingsModal) {
                    this.closeSettings();
                }
            });
        }
        
        // ヘルプモーダルの外側クリックで閉じる
        const helpModal = document.getElementById('help-modal');
        if (helpModal) {
            helpModal.addEventListener('click', (e) => {
                if (e.target === helpModal) {
                    this.closeHelp();
                }
            });
        }
        
        
        // ドラッグイベントの設定
        this.setupDragEvents();
    }
    
    setupDragEvents() {
        const wrapper = document.querySelector('.game-board-wrapper');
        if (!wrapper) return;
        
        // 設定の読み込み
        this.loadFlagAnimationSetting();
        this.loadPowerSaveSettings();
        this.loadReverseModeSetting();
        
        // PC向けのドラッグ処理（中ボタンでドラッグ）
        {
            let isDraggingMouse = false;
            let mouseStartX = 0;
            let mouseStartY = 0;
            let scrollStartX = 0;
            let scrollStartY = 0;
            let dragThreshold = 5; // ドラッグと判定する最小移動量
            let hasDraggedEnough = false;
            
            wrapper.addEventListener('mousedown', (e) => {
                // 中ボタンでドラッグ開始
                if (e.button === 1) {
                    isDraggingMouse = true;
                    hasDraggedEnough = false;
                    mouseStartX = e.clientX;
                    mouseStartY = e.clientY;
                    scrollStartX = wrapper.scrollLeft;
                    scrollStartY = wrapper.scrollTop;
                    wrapper.style.cursor = 'grabbing';
                    e.preventDefault();
                }
            });
            
            document.addEventListener('mousemove', (e) => {
                if (!isDraggingMouse) return;
                
                const deltaX = e.clientX - mouseStartX;
                const deltaY = e.clientY - mouseStartY;
                
                // 閾値を超えたらドラッグと判定
                if (!hasDraggedEnough) {
                    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                    if (distance > dragThreshold) {
                        hasDraggedEnough = true;
                    } else {
                        return;
                    }
                }
                
                // リバースモードの場合、スクロール方向を反転
                if (this.reverseMode) {
                    wrapper.scrollLeft = scrollStartX + deltaX;
                    wrapper.scrollTop = scrollStartY + deltaY;
                } else {
                    wrapper.scrollLeft = scrollStartX - deltaX;
                    wrapper.scrollTop = scrollStartY - deltaY;
                }
                
                e.preventDefault();
            });
            
            document.addEventListener('mouseup', (e) => {
                if (isDraggingMouse) {
                    isDraggingMouse = false;
                    wrapper.style.cursor = 'grab';
                }
            });
        }
    }
    
    
    newGame() {
        this.stopTimer();
        this.timer = 0;
        this.updateTimer();
        this.gameOver = false;
        this.gameWon = false;
        this.firstClick = true;
        
        const difficulty = this.difficulties[this.currentDifficulty];
        
        // 親クラスのinitBoardを使用
        this.initBoard(difficulty.rows, difficulty.cols, difficulty.mines);
        
        this.renderBoard();
        this.updateMineCount();
        
        // 残りの地雷数を初期化
        const mineRemainingElement = document.getElementById('mine-remaining');
        if (mineRemainingElement) {
            mineRemainingElement.textContent = this.mineCount;
        }
        
        const resetBtn = document.getElementById('reset-btn');
        if (resetBtn) {
            resetBtn.textContent = 'リセット';
        }
        
        // スクロール位置を左上にリセット（DOMの更新後に実行）
        setTimeout(() => {
            const wrapper = document.querySelector('.game-board-wrapper');
            if (wrapper) {
                wrapper.scrollLeft = 0;
                wrapper.scrollTop = 0;
            }
        }, 0);
    }
    
    renderBoard() {
        const boardElement = document.getElementById('game-board');
        boardElement.innerHTML = '';
        boardElement.style.gridTemplateColumns = `repeat(${this.cols}, 1fr)`;
        
        // ボード要素で右クリックメニューを無効化
        boardElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
        
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.row = row;
                cell.dataset.col = col;
                
                this.setupCellEventListeners(cell, row, col);
                
                boardElement.appendChild(cell);
            }
        }
        
        // 現在のズームレベルとフォントサイズを適用
        this.updateZoom();
        this.updateFontSize();
    }
    
    setupCellEventListeners(cell, row, col) {
        // PC向けイベント
        // 左クリック
        cell.addEventListener('click', (e) => {
            if (this.gameOver) return;
            
            if (!this.flagged[row][col]) {
                this.revealCell(row, col);
            }
        });
        
        // 右クリック
        cell.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (!this.gameOver && !this.revealed[row][col]) {
                this.toggleFlag(row, col);
            }
        });
        
        // ダブルクリック
        cell.addEventListener('dblclick', (e) => {
            if (this.revealed[row][col] && this.board[row][col] > 0) {
                this.chordReveal(row, col);
            }
        });
    }
    
    // コアライブラリのメソッドをオーバーライド
    onGameOver() {
        const resetBtn = document.getElementById('reset-btn');
        if (resetBtn) {
            resetBtn.textContent = 'リセット';
        }
        // ゲームオーバー時のみ地雷セルに赤い背景を適用
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                if (this.board[row][col] === -1 && this.revealed[row][col]) {
                    const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                    if (cell) {
                        cell.classList.add('mine-exploded');
                    }
                }
            }
        }
    }
    
    onGameWon() {
        const resetBtn = document.getElementById('reset-btn');
        if (resetBtn) {
            resetBtn.textContent = 'リセット';
        }
        // 勝利時に全ての地雷を表示（旗が立っていない場所のみ）
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                if (this.board[row][col] === -1 && !this.flagged[row][col]) {
                    const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                    if (cell) {
                        cell.classList.add('revealed');
                        cell.classList.add('mine');
                        cell.classList.add('mine-won'); // 勝利時の地雷表示
                        cell.textContent = '💣';
                    }
                }
            }
        }
        this.showClearModal();
    }
    
    updateTimer() {
        const timerElement = document.getElementById('timer');
        if (timerElement) {
            timerElement.textContent = String(this.timer).padStart(3, '0');
        }
    }
    
    // コアのタイマー更新フックをオーバーライド
    onTimerUpdate(time) {
        this.timer = time;
        this.updateTimer();
    }
    
    // 以下、UI関連のメソッドを追加
    
    toggleFlag(row, col) {
        if (this.revealed[row][col]) return;
        
        const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        
        if (this.flagged[row][col]) {
            this.createRisingFlag(cell);
            cell.classList.add('unflag-animation');
            setTimeout(() => {
                cell.classList.remove('unflag-animation');
            }, 200);
            this.flagged[row][col] = false;
            cell.classList.remove('flagged');
            cell.textContent = '';
            this.updateMineCount();
        } else {
            this.flagged[row][col] = true;
            cell.classList.add('flagged');
            cell.classList.add('flag-animation');
            this.createFallingFlag(cell);
            setTimeout(() => {
                cell.classList.remove('flag-animation');
            }, 300);
            this.updateMineCount();
            this.checkWin();
        }
    }
    
    chordReveal(row, col) {
        if (!this.revealed[row][col]) return;
        
        const mineCount = this.board[row][col];
        if (mineCount === 0) return;
        
        let flagCount = 0;
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                const newRow = row + dr;
                const newCol = col + dc;
                if (this.isValidCell(newRow, newCol) && this.flagged[newRow][newCol]) {
                    flagCount++;
                }
            }
        }
        
        if (flagCount === mineCount) {
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    const newRow = row + dr;
                    const newCol = col + dc;
                    if (this.isValidCell(newRow, newCol) && 
                        !this.flagged[newRow][newCol] && 
                        !this.revealed[newRow][newCol]) {
                        this.revealCell(newRow, newCol);
                    }
                }
            }
        }
    }
    
    updateMineCount() {
        let flaggedCount = 0;
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                if (this.flagged[row][col]) flaggedCount++;
            }
        }
        
        const flagCountElement = document.getElementById('flag-count');
        if (flagCountElement) {
            flagCountElement.textContent = `${flaggedCount}/${this.mineCount}`;
        }
        
        const mineRemainingElement = document.getElementById('mine-remaining');
        if (mineRemainingElement) {
            const remaining = this.mineCount - flaggedCount;
            mineRemainingElement.textContent = remaining;
        }
    }
    
    updateCell(row, col) {
        const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        if (!cell) return;
        
        if (this.revealed[row][col]) {
            cell.classList.add('revealed');
            
            if (this.board[row][col] === -1) {
                cell.classList.add('mine');
                cell.textContent = '💣';
                // ゲームオーバー時のみ赤い背景を適用
                if (this.gameOver) {
                    cell.classList.add('mine-exploded');
                }
            } else if (this.board[row][col] > 0) {
                cell.textContent = this.board[row][col];
                cell.setAttribute('data-count', this.board[row][col]);
                cell.classList.add(`number-${this.board[row][col]}`);
            }
        }
    }
    
    // ズーム機能
    zoomIn() {
        if (this.zoomLevel < this.maxZoom) {
            const oldZoom = this.zoomLevel;
            this.zoomLevel = Math.min(this.zoomLevel + this.zoomStep, this.maxZoom);
            this.updateZoomWithCenter(oldZoom, this.zoomLevel);
        }
    }
    
    zoomOut() {
        if (this.zoomLevel > this.minZoom) {
            const oldZoom = this.zoomLevel;
            this.zoomLevel = Math.max(this.zoomLevel - this.zoomStep, this.minZoom);
            this.updateZoomWithCenter(oldZoom, this.zoomLevel);
        }
    }
    
    updateZoomWithCenter(oldZoom, newZoom) {
        const wrapper = document.querySelector('.game-board-wrapper');
        const boardElement = document.getElementById('game-board');
        if (!wrapper || !boardElement) return;
        
        // 現在のビューポートの中心位置を取得
        const viewportCenterX = wrapper.scrollLeft + wrapper.clientWidth / 2;
        const viewportCenterY = wrapper.scrollTop + wrapper.clientHeight / 2;
        
        // ボード上での実際の位置（ズーム前）
        const boardX = viewportCenterX / oldZoom;
        const boardY = viewportCenterY / oldZoom;
        
        // ズームを適用
        boardElement.style.transform = `scale(${newZoom})`;
        boardElement.style.transformOrigin = 'top left';
        
        // ズーム後の同じ位置が中心に来るようにスクロール位置を調整
        const newScrollLeft = (boardX * newZoom) - wrapper.clientWidth / 2;
        const newScrollTop = (boardY * newZoom) - wrapper.clientHeight / 2;
        
        wrapper.scrollLeft = Math.max(0, newScrollLeft);
        wrapper.scrollTop = Math.max(0, newScrollTop);
    }
    
    updateZoom() {
        const boardElement = document.getElementById('game-board');
        if (boardElement) {
            boardElement.style.transform = `scale(${this.zoomLevel})`;
            boardElement.style.transformOrigin = 'top left';
        }
    }
    
    // フォントサイズ機能
    increaseFontSize() {
        if (this.currentFontSize < this.maxFontSize) {
            this.currentFontSize = Math.min(this.currentFontSize + this.fontSizeStep, this.maxFontSize);
            this.updateFontSize();
            this.saveFontSizeSetting();
        }
    }
    
    decreaseFontSize() {
        if (this.currentFontSize > this.minFontSize) {
            this.currentFontSize = Math.max(this.currentFontSize - this.fontSizeStep, this.minFontSize);
            this.updateFontSize();
            this.saveFontSizeSetting();
        }
    }
    
    updateFontSize() {
        const display = document.getElementById('font-size-display');
        if (display) {
            display.textContent = `${this.currentFontSize}%`;
        }
        
        const cells = document.querySelectorAll('.cell');
        cells.forEach(cell => {
            cell.style.fontSize = `${this.currentFontSize}%`;
        });
    }
    
    saveFontSizeSetting() {
        localStorage.setItem('minesweeper-font-size', this.currentFontSize);
    }
    
    loadFontSizeSetting() {
        const saved = localStorage.getItem('minesweeper-font-size');
        if (saved) {
            this.currentFontSize = parseInt(saved);
            this.updateFontSize();
        }
    }
    
    // テーマ機能
    toggleTheme() {
        const body = document.body;
        const currentTheme = body.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        body.setAttribute('data-theme', newTheme);
        
        const themeBtn = document.getElementById('theme-toggle-btn');
        if (themeBtn) {
            const icon = themeBtn.querySelector('.theme-icon');
            const text = themeBtn.querySelector('.theme-text');
            if (newTheme === 'dark') {
                icon.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>';
                text.textContent = 'ダークモード';
            } else {
                icon.textContent = '☀️';
                text.textContent = 'ライトモード';
            }
        }
        
        localStorage.setItem('minesweeper-theme', newTheme);
    }
    
    loadThemeSetting() {
        const theme = localStorage.getItem('minesweeper-theme') || 'dark';
        document.body.setAttribute('data-theme', theme);
        
        const themeBtn = document.getElementById('theme-toggle-btn');
        if (themeBtn) {
            const icon = themeBtn.querySelector('.theme-icon');
            const text = themeBtn.querySelector('.theme-text');
            if (theme === 'dark') {
                icon.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/></svg>';
                text.textContent = 'ダークモード';
            } else {
                icon.textContent = '☀️';
                text.textContent = 'ライトモード';
            }
        }
    }
    
    // 旗アニメーション
    toggleFlagAnimation() {
        this.flagAnimationEnabled = !this.flagAnimationEnabled;
        
        const btn = document.getElementById('flag-animation-toggle-btn');
        if (btn) {
            const text = btn.querySelector('.flag-animation-text');
            text.textContent = this.flagAnimationEnabled ? 'ON' : 'OFF';
        }
        
        localStorage.setItem('minesweeper-flag-animation', this.flagAnimationEnabled);
    }
    
    loadFlagAnimationSetting() {
        const saved = localStorage.getItem('minesweeper-flag-animation');
        if (saved !== null) {
            this.flagAnimationEnabled = saved === 'true';
            const btn = document.getElementById('flag-animation-toggle-btn');
            if (btn) {
                const text = btn.querySelector('.flag-animation-text');
                text.textContent = this.flagAnimationEnabled ? 'ON' : 'OFF';
            }
        }
    }
    
    createFallingFlag(cell) {
        if (!this.flagAnimationEnabled) return;
        
        const container = document.getElementById('flag-animation-container');
        if (!container) return;
        
        const rect = cell.getBoundingClientRect();
        const flag = document.createElement('div');
        flag.className = 'falling-flag';
        flag.textContent = '🚩';
        flag.style.left = `${rect.left + rect.width / 2}px`;
        flag.style.top = `${rect.top - 30}px`;
        
        container.appendChild(flag);
        
        setTimeout(() => {
            flag.style.transform = `translateY(${rect.height + 30}px)`;
            flag.style.opacity = '0';
        }, 10);
        
        setTimeout(() => {
            flag.remove();
        }, 310);
    }
    
    createRisingFlag(cell) {
        if (!this.flagAnimationEnabled) return;
        
        const container = document.getElementById('flag-animation-container');
        if (!container) return;
        
        const rect = cell.getBoundingClientRect();
        const flag = document.createElement('div');
        flag.className = 'rising-flag';
        flag.textContent = '🚩';
        flag.style.left = `${rect.left + rect.width / 2}px`;
        flag.style.top = `${rect.top + rect.height * 0.15}px`;
        
        container.appendChild(flag);
        
        setTimeout(() => {
            flag.style.transform = 'translateY(-50px)';
            flag.style.opacity = '0';
        }, 10);
        
        setTimeout(() => {
            flag.remove();
        }, 210);
    }
    
    createRisingQuestion(cell) {
        if (!this.flagAnimationEnabled) return;
        
        const container = document.getElementById('flag-animation-container');
        if (!container) return;
        
        const rect = cell.getBoundingClientRect();
        const question = document.createElement('div');
        question.className = 'rising-question';
        question.textContent = '?';
        question.style.left = `${rect.left + rect.width / 2}px`;
        question.style.top = `${rect.top + rect.height / 2}px`;
        
        container.appendChild(question);
        
        setTimeout(() => {
            question.style.transform = 'translateY(-50px)';
            question.style.opacity = '0';
        }, 10);
        
        setTimeout(() => {
            question.remove();
        }, 210);
    }
    
    // 省電力モード
    togglePowerSaveMode() {
        this.powerSaveMode = !this.powerSaveMode;
        
        const body = document.body;
        if (this.powerSaveMode) {
            body.classList.add('power-save-mode');
        } else {
            body.classList.remove('power-save-mode');
        }
        
        const btn = document.getElementById('power-save-toggle-btn');
        if (btn) {
            const text = btn.querySelector('.power-save-text');
            text.textContent = this.powerSaveMode ? 'OFF' : 'ON';
        }
        
        localStorage.setItem('minesweeper-power-save', this.powerSaveMode);
    }
    
    loadPowerSaveSettings() {
        const saved = localStorage.getItem('minesweeper-power-save');
        if (saved === 'true') {
            this.powerSaveMode = true;
            document.body.classList.add('power-save-mode');
            const btn = document.getElementById('power-save-toggle-btn');
            if (btn) {
                const text = btn.querySelector('.power-save-text');
                text.textContent = 'OFF';
            }
        }
    }
    
    // リバースモード
    toggleReverseMode() {
        this.reverseMode = !this.reverseMode;
        
        const btn = document.getElementById('reverse-toggle-btn');
        if (btn) {
            const text = btn.querySelector('.reverse-text');
            text.textContent = this.reverseMode ? 'ON' : 'OFF';
        }
        
        localStorage.setItem('minesweeper-reverse-mode', this.reverseMode);
    }
    
    loadReverseModeSetting() {
        const saved = localStorage.getItem('minesweeper-reverse-mode');
        if (saved === 'true') {
            this.reverseMode = true;
            const btn = document.getElementById('reverse-toggle-btn');
            if (btn) {
                const text = btn.querySelector('.reverse-text');
                text.textContent = 'ON';
            }
        }
    }
    
    // モーダル関連
    openSettings() {
        const modal = document.getElementById('settings-modal');
        if (modal) {
            modal.classList.add('show');
        }
    }
    
    closeSettings() {
        const modal = document.getElementById('settings-modal');
        if (modal) {
            modal.classList.remove('show');
        }
    }
    
    openHelp() {
        const modal = document.getElementById('help-modal');
        if (modal) {
            modal.classList.add('show');
            
            // PC版なので常にPC向けの説明を表示
            const mobileHelp = document.getElementById('mobile-help');
            const pcHelp = document.getElementById('pc-help');
            
            if (mobileHelp) mobileHelp.style.display = 'none';
            if (pcHelp) pcHelp.style.display = 'block';
        }
    }
    
    closeHelp() {
        const modal = document.getElementById('help-modal');
        if (modal) {
            modal.classList.remove('show');
        }
    }
    
    showClearModal() {
        const modal = document.getElementById('clear-modal');
        if (!modal) return;
        
        const message = document.getElementById('clear-message');
        if (message) {
            const minutes = Math.floor(this.timer / 60);
            const seconds = this.timer % 60;
            const timeText = minutes > 0 ? `${minutes}分${seconds}秒` : `${seconds}秒`;
            message.textContent = `クリアタイム: ${timeText}`;
        }
        
        const nextBtn = document.getElementById('next-difficulty-btn');
        // 次の難易度を決定
        const difficultyOrder = ['easy', 'medium', 'hard', 'hiddeneasy', 'hiddenmedium', 'hiddenhard', 'extreme'];
        const currentIndex = difficultyOrder.indexOf(this.currentDifficulty);
        
        if (currentIndex !== -1 && currentIndex < difficultyOrder.length - 1) {
            // 次の難易度がある場合
            const nextDifficulty = difficultyOrder[currentIndex + 1];
            const difficultyNames = {
                'easy': '初級',
                'medium': '中級',
                'hard': '上級',
                'hiddeneasy': '裏初級',
                'hiddenmedium': '裏中級',
                'hiddenhard': '裏上級',
                'extreme': '極悪'
            };
            
            if (nextBtn) {
                nextBtn.style.display = 'block';
                nextBtn.innerHTML = `次の難易度へ<br>(${difficultyNames[nextDifficulty]})`;
                nextBtn.onclick = () => {
                    this.currentDifficulty = nextDifficulty;
                    const select = document.getElementById('difficulty-select');
                    if (select) {
                        select.value = nextDifficulty;
                    }
                    this.newGame();
                    modal.classList.remove('show');
                };
            }
        } else {
            // 最高難易度の場合
            if (nextBtn) {
                nextBtn.style.display = 'none';
            }
        }
        
        modal.classList.add('show');
    }
    
    // コアのrevealCellメソッドをオーバーライドして、UI更新を追加
    revealCell(row, col) {
        super.revealCell(row, col);
        this.updateCell(row, col);
        
        // 周囲のセルも更新（0の場合の連鎖開示）
        if (this.board[row][col] === 0) {
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    const newRow = row + dr;
                    const newCol = col + dc;
                    if (this.isValidCell(newRow, newCol) && this.revealed[newRow][newCol]) {
                        this.updateCell(newRow, newCol);
                    }
                }
            }
        }
    }
    
    // コアのrevealAllMinesメソッドをオーバーライドして、UI更新を追加
    revealAllMines() {
        super.revealAllMines();
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                if (!cell) continue;
                
                if (this.board[row][col] === -1) {
                    if (this.flagged[row][col]) {
                        // 正しく旗が立てられていた地雷はそのまま表示
                        cell.classList.add('revealed');
                        cell.classList.add('flagged');
                        cell.textContent = '🚩';
                    } else {
                        // 旗が立てられていない地雷は爆弾を表示
                        this.updateCell(row, col);
                    }
                } else if (this.flagged[row][col]) {
                    // 地雷でない場所に旗が立っていた場合は×印を表示
                    cell.classList.add('revealed');
                    cell.classList.add('wrong-flag');
                    cell.textContent = '❌';
                }
            }
        }
    }
}

// ゲームの初期化（PCProで使用時はコメントアウト）
/*
document.addEventListener('DOMContentLoaded', () => {
    const game = new PCMinesweeper();
    
    // 設定の読み込み
    game.loadThemeSetting();
    game.loadFontSizeSetting();
});
*/