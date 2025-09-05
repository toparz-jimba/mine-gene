// PCProMinesweeper: PCMinesweeperを継承したPRO版の実装
class PCProMinesweeper extends PCMinesweeper {
    constructor() {
        super();
        
        // PRO版専用の機能
        
        
        
        // CSPソルバー
        this.cspSolver = null;
        this.probabilityMode = false;
        this.assistMode = false; // 補助モード
        this.isRevealing = false; // 再帰的な開示処理中フラグ
        
        // 補助機能の視覚表示設定
        this.assistVisualEnabled = true;
        
        // 盤面管理機能
        this.isEditorMode = false;
        this.isEditingFromSavedBoard = false; // 保存済み盤面からの編集かどうか
        this.editorMines = new Set(); // エディター用地雷配置 "row,col"形式
        this.editorRevealed = new Set(); // エディター用開いた状態のマス "row,col"形式
        this.savedEditorMines = new Set(); // タブ切り替え時に保持する地雷情報
        this.savedEditorRevealed = new Set(); // タブ切り替え時に保持する開く設定情報
        this.continuousPlacement = false; // 連続配置モード
        this.editorMode = 'mine'; // 'mine' または 'reveal'
        this.savedGameState = null; // メインゲームの状態を保存
        
        this.initPro();
    }
    
    initPro() {
        this.loadSettings();
        this.setupProEventListeners();
        this.initCSPSolver();
    }
    
    setupProEventListeners() {
        
        
        
        
        
        
        // サウンドトグル
        
        // 確率表示ボタン
        const probabilityBtn = document.getElementById('probability-btn');
        if (probabilityBtn) {
            probabilityBtn.addEventListener('click', () => this.toggleProbabilityMode());
        }
        
        // 補助モードボタン
        const assistBtn = document.getElementById('assist-btn');
        if (assistBtn) {
            assistBtn.addEventListener('click', () => this.toggleAssistMode());
        }
        
        // 補助機能の視覚表示設定ボタン
        const assistVisualToggleBtn = document.getElementById('assist-visual-toggle-btn');
        if (assistVisualToggleBtn) {
            assistVisualToggleBtn.addEventListener('click', () => this.toggleAssistVisual());
        }
        
        // 盤面管理ボタン
        const boardManagerBtn = document.getElementById('board-manager-btn');
        if (boardManagerBtn) {
            boardManagerBtn.addEventListener('click', () => this.openBoardManager());
        }
        
        // キーボードショートカット
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key) {
                }
            }
        });
    }
    
    
    
    
    getNeighbors(row, col) {
        const neighbors = [];
        for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
                if (dr === 0 && dc === 0) continue;
                const newRow = row + dr;
                const newCol = col + dc;
                if (this.isValidCell(newRow, newCol)) {
                    neighbors.push({ row: newRow, col: newCol });
                }
            }
        }
        return neighbors;
    }
    
    
    // 補助機能の視覚表示設定切り替え
    toggleAssistVisual() {
        this.assistVisualEnabled = !this.assistVisualEnabled;
        const assistVisualToggleBtn = document.getElementById('assist-visual-toggle-btn');
        if (assistVisualToggleBtn) {
            const textElement = assistVisualToggleBtn.querySelector('.assist-visual-text');
            if (textElement) {
                textElement.textContent = this.assistVisualEnabled ? 'ON' : 'OFF';
            }
        }
        localStorage.setItem('minesweeper-pro-assist-visual', this.assistVisualEnabled);
        
        // 補助モードが有効な場合は再表示
        if (this.assistMode) {
            this.calculateAndDisplayAssist();
        }
    }
    
    // 設定の保存と読み込み
    loadSettings() {
        // 補助機能の視覚表示設定
        const assistVisualSetting = localStorage.getItem('minesweeper-pro-assist-visual');
        if (assistVisualSetting === 'false') {
            this.assistVisualEnabled = false;
            const assistVisualToggleBtn = document.getElementById('assist-visual-toggle-btn');
            if (assistVisualToggleBtn) {
                const textElement = assistVisualToggleBtn.querySelector('.assist-visual-text');
                if (textElement) {
                    textElement.textContent = 'OFF';
                }
            }
        }
    }
    
    // オーバーライドメソッド
    revealCell(row, col) {
        const wasRevealed = this.revealed[row][col];
        super.revealCell(row, col);
        
        if (!wasRevealed && this.revealed[row][col]) {
            // アクションを記録
            this.recordAction({
                type: 'reveal',
                row: row,
                col: col
            });
            
            
            if (this.soundEnabled) this.playSound('reveal');
        }
    }
    
    toggleFlag(row, col) {
        const wasFlagged = this.flagged[row][col];
        super.toggleFlag(row, col);
        
        // アクションを記録
        this.recordAction({
            type: 'flag',
            row: row,
            col: col
        });
        
        
        if (this.soundEnabled && this.flagged[row][col]) {
            this.playSound('flag');
        }
    }
    
    onGameOver() {
        super.onGameOver();
        if (this.soundEnabled) this.playSound('lose');
    }
    
    onGameWon() {
        super.onGameWon();
        if (this.soundEnabled) this.playSound('win');
        
    }
    
    
    newGame() {
        // 現在のモード状態を保存
        const probabilityModeState = this.probabilityMode;
        const assistModeState = this.assistMode;
        
        // リセット
        
        // 確率表示をクリア
        this.clearProbabilityDisplay();
        
        // 補助表示をクリア  
        this.clearAssistDisplay();
        
        // CSPソルバーの永続確率をクリア
        if (this.cspSolver) {
            this.cspSolver.persistentProbabilities = [];
            console.log('[DEBUG] Cleared persistent probabilities on game reset');
        }
        
        
        // 基本的なnewGame処理
        super.newGame();
        
        // モード状態を復元
        if (probabilityModeState) {
            this.probabilityMode = true;
            const probabilityBtn = document.getElementById('probability-btn');
            const boardElement = document.getElementById('game-board');
            if (probabilityBtn) probabilityBtn.classList.add('active');
            if (boardElement) boardElement.classList.add('probability-mode');
        }
        
        if (assistModeState) {
            this.assistMode = true;
            const assistBtn = document.getElementById('assist-btn');
            const boardElement = document.getElementById('game-board');
            if (assistBtn) assistBtn.classList.add('active');
            if (boardElement) boardElement.classList.add('assist-mode');
        }
    }
    
    // CSPソルバー関連メソッド
    initCSPSolver() {
        if (typeof CSPSolver !== 'undefined') {
            this.cspSolver = new CSPSolver(this);
        }
    }
    
    
    toggleProbabilityMode() {
        this.probabilityMode = !this.probabilityMode;
        const btn = document.getElementById('probability-btn');
        const boardElement = document.getElementById('game-board');
        
        if (this.probabilityMode) {
            btn.classList.add('active');
            boardElement.classList.add('probability-mode');
            this.calculateAndDisplayProbabilities();
        } else {
            btn.classList.remove('active');
            boardElement.classList.remove('probability-mode');
            this.clearProbabilityDisplay();
        }
    }
    
    toggleAssistMode() {
        this.assistMode = !this.assistMode;
        const btn = document.getElementById('assist-btn');
        const boardElement = document.getElementById('game-board');
        
        if (this.assistMode) {
            btn.classList.add('active');
            boardElement.classList.add('assist-mode');
            this.calculateAndDisplayAssist();
        } else {
            btn.classList.remove('active');
            boardElement.classList.remove('assist-mode');
            this.clearAssistDisplay();
        }
    }
    

    calculateAndDisplayAssist() {
        if (!this.cspSolver) return;
        
        // 計算中インジケーターを表示
        this.showCalculatingIndicator();
        
        // 非同期で計算を実行
        setTimeout(() => {
            const result = this.cspSolver.calculateProbabilities();
            // 永続確率と通常確率をマージして表示用の確率を作成
            const displayProbabilities = this.mergeWithPersistentProbabilities(result.probabilities);
            this.displayAssist(displayProbabilities);
            // タイムアウトセルがあれば色付け
            if (result.timedOutCells && result.timedOutCells.length > 0) {
                this.highlightTimeoutCells(result.timedOutCells);
            }
            this.hideCalculatingIndicator();
        }, 10);
    }
    
    // 永続確率と通常確率をマージ（永続確率を優先）
    mergeWithPersistentProbabilities(probabilities) {
        const merged = [];
        for (let row = 0; row < this.rows; row++) {
            merged[row] = [];
            for (let col = 0; col < this.cols; col++) {
                // 永続確率があればそれを使用、なければ通常確率を使用
                if (this.cspSolver.persistentProbabilities && 
                    this.cspSolver.persistentProbabilities[row] && 
                    (this.cspSolver.persistentProbabilities[row][col] === 0 || 
                     this.cspSolver.persistentProbabilities[row][col] === 100)) {
                    merged[row][col] = this.cspSolver.persistentProbabilities[row][col];
                } else {
                    merged[row][col] = probabilities[row][col];
                }
            }
        }
        return merged;
    }
    
    displayAssist(probabilities) {
        // 視覚表示が無効な場合は色付け・アルファベット表示を行わない
        if (!this.assistVisualEnabled) {
            // ポップアップ表示のみ行う
            this.showAssistPopup(probabilities);
            return;
        }
        
        // 確率モードが有効な場合は地雷候補マスの追加表示のみ行う
        if (this.probabilityMode) {
            // 地雷候補マスのみ追加表示（確率表示は維持）
            for (let row = 0; row < this.rows; row++) {
                for (let col = 0; col < this.cols; col++) {
                    // 開示済みまたは旗付きのセルはスキップ
                    if (this.revealed[row][col] || this.flagged[row][col]) {
                        continue;
                    }

                    const probability = probabilities[row][col];
                    if (probability === -5) {
                        // 地雷候補マス：アルファベットIDがある場合のみ追加表示
                        const alphabetIds = this.cspSolver ? this.cspSolver.getAlphabetIdsForCell(row, col) : null;
                        if (alphabetIds) {
                            const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                            if (cell) {
                                cell.classList.add('mine-candidate');
                                // アルファベットオーバーレイが既に存在するかチェック
                                const existingAlphabetOverlay = cell.querySelector('.mine-candidate-overlay');
                                if (!existingAlphabetOverlay) {
                                    const alphabetOverlay = document.createElement('div');
                                    alphabetOverlay.className = 'probability-overlay mine-candidate-overlay';
                                    alphabetOverlay.textContent = alphabetIds.charAt(0);
                                    alphabetOverlay.style.position = 'absolute';
                                    alphabetOverlay.style.bottom = '2px';
                                    alphabetOverlay.style.right = '2px';
                                    alphabetOverlay.style.fontSize = '10px';
                                    alphabetOverlay.style.color = 'white';
                                    alphabetOverlay.style.fontWeight = 'bold';
                                    cell.appendChild(alphabetOverlay);
                                }
                            }
                        }
                    }
                }
            }
        } else {
            // 補助モード単体時：アルファベット付きマスのみ表示
            for (let row = 0; row < this.rows; row++) {
                for (let col = 0; col < this.cols; col++) {
                    // 開示済みまたは旗付きのセルはスキップ
                    if (this.revealed[row][col] || this.flagged[row][col]) {
                        continue;
                    }

                    const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                    if (!cell) continue;

                    // 既存のオーバーレイをクリア
                    const existingOverlay = cell.querySelector('.probability-overlay');
                    if (existingOverlay) {
                        existingOverlay.remove();
                    }

                    // アシストクラスをクリア
                    cell.classList.remove('probability-safe', 'probability-low', 
                                        'probability-medium', 'probability-high', 'probability-certain',
                                        'probability-unknown', 'probability-interrupted', 'probability-twocell-ref',
                                        'mine-candidate');

                    const probability = probabilities[row][col];

                    if (probability === -3) {
                        // 計算中断のセル
                        cell.classList.add('probability-interrupted');
                        const overlay = document.createElement('div');
                        overlay.className = 'probability-overlay';
                        overlay.textContent = '---';
                        cell.appendChild(overlay);
                    } else if (probability === -4) {
                        // 2セル制約伝播参考のセル
                        cell.classList.add('probability-twocell-ref');
                        const overlay = document.createElement('div');
                        overlay.className = 'probability-overlay';
                        overlay.textContent = '2C';
                        cell.appendChild(overlay);
                    } else if (probability === -5) {
                        // 地雷候補マス：アルファベットIDがある場合のみ表示
                        const alphabetIds = this.cspSolver ? this.cspSolver.getAlphabetIdsForCell(row, col) : null;
                        if (alphabetIds) {
                            cell.classList.add('mine-candidate');
                            const overlay = document.createElement('div');
                            overlay.className = 'probability-overlay mine-candidate-overlay';
                            overlay.textContent = alphabetIds.charAt(0);
                            cell.appendChild(overlay);
                        }
                    }
                }
            }
        }
        
        // ポップアップ表示のための処理
        this.showAssistPopup(probabilities);
    }
    
    updateAssistDisplay(minProbability, hasCertainMine) {
        let display = document.querySelector('.assist-display');
        if (!display) {
            display = document.createElement('div');
            display.className = 'assist-display';
            const gameContainer = document.querySelector('.game-container') || document.querySelector('.container');
            if (gameContainer) {
                gameContainer.appendChild(display);
            } else {
                document.body.appendChild(display);
            }
        }
        
        if (minProbability === 101) {
            // 確率が計算できない場合は表示しない
            display.style.display = 'none';
            return;
        }
        
        let statusText = `${minProbability}%`;
        if (hasCertainMine) {
            statusText += ' 💣';
        }
        
        display.innerHTML = `<span class="assist-text">${statusText}</span>`;
        display.style.display = 'block';
    }
    
    hideAssistDisplay() {
        const display = document.querySelector('.assist-display');
        if (display) {
            display.style.display = 'none';
        }
    }
    
    clearAssistDisplay() {
        // 補助表示を非表示
        this.hideAssistDisplay();
        
        // 視覚表示が無効な場合は色付け・アルファベット表示のクリアは不要
        if (!this.assistVisualEnabled) {
            return;
        }
        
        // 確率モードが有効な場合は補助機能の追加表示のみクリア
        if (this.probabilityMode) {
            // 地雷候補の色付けと小さなアルファベットのみクリア
            const cells = document.querySelectorAll('.cell');
            cells.forEach(cell => {
                // アルファベットオーバーレイのみ削除
                const alphabetOverlay = cell.querySelector('.mine-candidate-overlay');
                if (alphabetOverlay) {
                    alphabetOverlay.remove();
                }
                // 地雷候補の色付けのみ削除
                cell.classList.remove('mine-candidate');
            });
        } else {
            // 補助モード単体時は全ての表示をクリア
            const cells = document.querySelectorAll('.cell');
            cells.forEach(cell => {
                const overlay = cell.querySelector('.probability-overlay');
                if (overlay) {
                    overlay.remove();
                }
                cell.classList.remove('probability-safe', 'probability-low', 
                                    'probability-medium', 'probability-high', 'probability-certain',
                                    'probability-unknown', 'probability-interrupted', 'probability-twocell-ref', 'probability-skipped',
                                    'mine-candidate');
            });
        }
        
        // タイムアウトハイライトもクリア
        this.clearTimeoutHighlight();
    }
    
    // タイムアウトされたセルをハイライト
    highlightTimeoutCells(timedOutCells) {
        console.log(`Highlighting ${timedOutCells.length} timeout cells`);
        
        if (!this.boardElement || !timedOutCells || timedOutCells.length === 0) return;
        
        timedOutCells.forEach(cellInfo => {
            const cell = this.boardElement.querySelector(`[data-row="${cellInfo.row}"][data-col="${cellInfo.col}"]`);
            if (cell && !this.revealed[cellInfo.row][cellInfo.col]) {
                // タイムアウトセル用のスタイルクラスを追加
                cell.classList.add('timeout-cell');
                // 薄いオレンジ色の背景を設定
                cell.style.backgroundColor = 'rgba(255, 165, 0, 0.3)';
                cell.style.border = '2px solid #ff8c00';
            }
        });
    }
    
    // タイムアウトハイライトをクリア
    clearTimeoutHighlight() {
        if (!this.boardElement) return;
        this.boardElement.querySelectorAll('.timeout-cell').forEach(cell => {
            cell.classList.remove('timeout-cell');
            cell.style.backgroundColor = '';
            cell.style.border = '';
        });
    }
    
    showAssistPopup(probabilities) {
        // 優先順位: 0% > 100% > その他の最低確率
        let hasSafeCell = false; // 0%のセルがあるか
        let hasUnflaggedCertainMine = false; // 旗が立っていない100%のセルがあるか
        let hasSkippedCells = false; // 完全探索がスキップされたセルがあるか
        let minProbability = 101; // その他の確率の最小値（100%より大きい値で初期化）
        let displayProbability = 101; // 実際に表示する確率
        
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                // 開示済みのセルはスキップ
                if (this.revealed[row][col]) {
                    continue;
                }
                
                const probability = probabilities[row][col];
                
                // 旗付きのセルはスキップ（最低確率の計算から除外）
                if (this.flagged[row][col]) {
                    continue;
                }
                
                // 完全探索がスキップされたセルをチェック
                if (probability === -4) {
                    hasSkippedCells = true;
                }
                
                // 制約ベースの確率のみ考慮（-2は平均確率なので無視）
                if (probability >= 0) {
                    // 0%のセルをチェック（最優先）
                    if (probability === 0) {
                        hasSafeCell = true;
                    }
                    // 旗が立っていない100%のセルをチェック（2番目の優先度）
                    else if (probability === 100 && !this.flagged[row][col]) {
                        hasUnflaggedCertainMine = true;
                    }
                    // その他の確率の最小値を更新
                    else if (probability < minProbability) {
                        minProbability = probability;
                    }
                }
            }
        }
        
        // 表示する確率を決定（優先順位順）
        if (hasSafeCell) {
            displayProbability = 0;
        } else if (hasUnflaggedCertainMine) {
            displayProbability = 100;
        } else if (minProbability <= 100) {
            displayProbability = minProbability;
        }
        
        // ポップアップに表示
        this.updateAssistDisplay(displayProbability, hasUnflaggedCertainMine, hasSkippedCells);
    }
    
    updateAssistDisplay(displayProbability, hasCertainMine, hasSkippedCells = false) {
        let display = document.querySelector('.assist-display');
        
        if (!display) {
            display = document.createElement('div');
            display.className = 'assist-display';
            
            document.body.appendChild(display);
        }
        
        let statusText = '';
        let assistClass = '';
        
        if (displayProbability === 101) {
            // 確率が計算できない場合
            if (hasSkippedCells) {
                // スキップされたセルがある場合は「組み合わせ超過」のみ表示
                statusText = '組み合わせ超過';
                assistClass = 'probability';
            } else {
                // スキップされたセルもない場合は表示しない
                display.style.display = 'none';
                return;
            }
        } else if (displayProbability === 0) {
            statusText = '0%';
            assistClass = 'safe';
        } else if (displayProbability === 100) {
            statusText = '100%';
            assistClass = 'mine';
            if (hasCertainMine) {
                statusText += ' 💣';
            }
        } else {
            statusText = `${displayProbability}%`;
            assistClass = 'probability';
        }
        
        // 完全探索がスキップされたセルがある場合は追加表示
        if (hasSkippedCells) {
            statusText += ' 組み合わせ超過';
        }
        
        display.innerHTML = `<span class="assist-text">${statusText}</span>`;
        display.style.display = 'block';
    }
    
    calculateAndDisplayProbabilities() {
        if (!this.cspSolver) return;
        
        // 計算中インジケーターを表示
        this.showCalculatingIndicator();
        
        // 非同期で計算を実行
        setTimeout(() => {
            const result = this.cspSolver.calculateProbabilities();
            // 永続確率と通常確率をマージして表示用の確率を作成
            const displayProbabilities = this.mergeWithPersistentProbabilities(result.probabilities);
            this.displayProbabilities(displayProbabilities, result.globalProbability);
            // タイムアウトセルがあれば色付け
            if (result.timedOutCells && result.timedOutCells.length > 0) {
                this.highlightTimeoutCells(result.timedOutCells);
            }
            this.hideCalculatingIndicator();
        }, 10);
    }
    
    displayProbabilities(probabilities, globalProbability) {
        // 全体確率を表示
        this.updateGlobalProbabilityDisplay(globalProbability);
        
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
                if (!cell) continue;
                
                // 既存の確率表示を削除
                const existingOverlay = cell.querySelector('.probability-overlay');
                if (existingOverlay) {
                    existingOverlay.remove();
                }
                
                // 確率クラスをクリア
                cell.classList.remove('probability-safe', 'probability-low', 
                                    'probability-medium', 'probability-high', 'probability-certain',
                                    'probability-unknown', 'probability-interrupted', 'probability-twocell-ref', 'probability-skipped',
                                    'mine-candidate');
                
                const probability = probabilities[row][col];
                
                // 開示済みまたは旗付きのセルはスキップ
                if (this.revealed[row][col] || this.flagged[row][col]) {
                    continue;
                }
                
                if (probability >= 0) {
                    // 制約ベースで計算された確率
                    const overlay = document.createElement('div');
                    overlay.className = 'probability-overlay';
                    
                    // 近似機能は廃止済み
                    overlay.textContent = `${probability}%`;
                    
                    // 確率に応じてクラスを設定
                    if (probability === 0) {
                        cell.classList.add('probability-safe');
                    } else if (probability <= 25) {
                        cell.classList.add('probability-low');
                    } else if (probability <= 50) {
                        cell.classList.add('probability-medium');
                    } else if (probability < 100) {
                        cell.classList.add('probability-high');
                    } else {
                        cell.classList.add('probability-certain');
                    }
                    
                    // 近似機能は廃止済み
                    
                    cell.appendChild(overlay);
                } else if (probability === -2) {
                    // 制約外のセル（全体確率を適用）
                    cell.classList.add('probability-unknown');
                    // 確率は表示しない（全体確率を別途表示）
                } else if (probability === -3) {
                    // 計算中断のセル
                    cell.classList.add('probability-interrupted');
                    const overlay = document.createElement('div');
                    overlay.className = 'probability-overlay';
                    overlay.textContent = '---';
                    cell.appendChild(overlay);
                } else if (probability === -4) {
                    // 2セル制約伝播参考のセル
                    cell.classList.add('probability-twocell-ref');
                    const overlay = document.createElement('div');
                    overlay.className = 'probability-overlay';
                    overlay.textContent = '2C';
                    cell.appendChild(overlay);
                } else if (probability === 0) {
                    // 確定安全マス（0%）
                    if (this.assistMode) {
                        // 補助モード時：アルファベット表示のみ
                        const alphabetId = this.cspSolver ? this.cspSolver.getAlphabetIdForCell(row, col) : null;
                        if (alphabetId) {
                            cell.classList.add('probability-safe');
                            const overlay = document.createElement('div');
                            overlay.className = 'probability-overlay';
                            overlay.textContent = `0% ${alphabetId}`;
                            cell.appendChild(overlay);
                        }
                    } else {
                        // 確率モード時：通常の0%表示
                        cell.classList.add('probability-safe');
                        const overlay = document.createElement('div');
                        overlay.className = 'probability-overlay';
                        overlay.textContent = '0%';
                        cell.appendChild(overlay);
                    }
                } else if (probability === -5) {
                    // 地雷候補マス（補助モード時かつ視覚表示有効時のみ表示）
                    if (this.assistMode && this.assistVisualEnabled) {
                        const alphabetIds = this.cspSolver ? this.cspSolver.getAlphabetIdsForCell(row, col) : null;
                        if (alphabetIds) {
                            cell.classList.add('mine-candidate');
                            const overlay = document.createElement('div');
                            overlay.className = 'probability-overlay mine-candidate-overlay';
                            overlay.textContent = alphabetIds.charAt(0); // 最初の文字のみ表示
                            cell.appendChild(overlay);
                        }
                    }
                }
            }
        }
    }
    
    clearProbabilityDisplay() {
        const cells = document.querySelectorAll('.cell');
        cells.forEach(cell => {
            // 補助機能が有効かつ視覚表示有効な場合はアルファベットオーバーレイを保持
            if (this.assistMode && this.assistVisualEnabled) {
                // 確率オーバーレイのみ削除（アルファベットオーバーレイは保持）
                const overlays = cell.querySelectorAll('.probability-overlay');
                overlays.forEach(overlay => {
                    if (!overlay.classList.contains('mine-candidate-overlay')) {
                        overlay.remove();
                    }
                });
                // 確率関連のクラスのみ削除（mine-candidateは保持）
                cell.classList.remove('probability-safe', 'probability-low', 
                                    'probability-medium', 'probability-high', 'probability-certain',
                                    'probability-unknown', 'probability-interrupted', 'probability-skipped',
                                    'probability-approximate');
            } else {
                // 補助機能が無効または視覚表示無効な場合は全て削除
                const overlay = cell.querySelector('.probability-overlay');
                if (overlay) {
                    overlay.remove();
                }
                cell.classList.remove('probability-safe', 'probability-low', 
                                    'probability-medium', 'probability-high', 'probability-certain',
                                    'probability-unknown', 'probability-interrupted', 'probability-twocell-ref', 'probability-skipped',
                                    'mine-candidate');
            }
        });
        
        // 全体確率表示をクリア
        this.hideGlobalProbabilityDisplay();
        
        // タイムアウトハイライトもクリア
        this.clearTimeoutHighlight();
    }
    
    showCalculatingIndicator() {
        // 計算中インジケーターは表示しない
        return;
    }
    
    hideCalculatingIndicator() {
        // 計算中インジケーターは表示しない
        return;
    }
    
    updateGlobalProbabilityDisplay(globalProbability) {
        let display = document.querySelector('.global-probability-display');
        if (!display) {
            display = document.createElement('div');
            display.className = 'global-probability-display';
            // ゲームコンテナ内に配置
            const gameContainer = document.querySelector('.game-container') || document.querySelector('.container');
            if (gameContainer) {
                gameContainer.appendChild(display);
            } else {
                document.body.appendChild(display);
            }
        }
        
        const flaggedCount = this.countFlags();
        const remainingMines = this.mineCount - flaggedCount;
        const unknownCount = this.getUnknownCells().length;
        
        display.innerHTML = `<span class="global-prob-value">平均確率: ${globalProbability}%</span>`;
        display.style.display = 'block';
    }
    
    hideGlobalProbabilityDisplay() {
        const display = document.querySelector('.global-probability-display');
        if (display) {
            display.style.display = 'none';
        }
    }
    
    // ヘルパーメソッド
    countFlags() {
        let count = 0;
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                if (this.flagged[row][col]) count++;
            }
        }
        return count;
    }
    
    getUnknownCells() {
        const cells = [];
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                if (!this.revealed[row][col] && !this.flagged[row][col]) {
                    cells.push({ row, col });
                }
            }
        }
        return cells;
    }
    
    // オーバーライド: セルが更新されたら確率を再計算
    revealCell(row, col) {
        // 既に開いているセルの場合は何もしない
        if (!this.isValidCell(row, col) || this.revealed[row][col] || 
            this.gameOver || this.gameWon) {
            return;
        }
        
        // 再帰的な開示処理中またはchord操作中は確率計算を延期
        const wasRevealing = this.isRevealing || this.isChording;
        if (!wasRevealing) {
            this.isRevealing = true;
            this.revealedCellsCount = 0;  // 開いたセル数をカウント
            this.revealedCells = [];  // 開いたセルの座標を記録
        }
        
        const wasRevealed = this.revealed[row][col];
        const previousBoard = this.board[row][col];
        super.revealCell(row, col);
        
        // 爆弾を開いた場合は確率計算を行わずに終了
        if (this.gameOver) {
            if (!wasRevealing) {
                this.isRevealing = false;
                this.revealedCellsCount = 0;
                this.revealedCells = [];
            }
            return;
        }
        
        // 新しくセルが開いた場合
        if (!wasRevealed && this.revealed[row][col]) {
            this.revealedCellsCount++;
            this.revealedCells.push({row, col});
        }
        
        // 最初の呼び出しの場合のみ確率を再計算
        if (!wasRevealing && !this.isChording) {
            this.isRevealing = false;
            
            // 大きく開けた場合でも制約伝播は実行（完全探索は20マス制限で自動的に制御される）
            if (this.probabilityMode) {
                this.calculateAndDisplayProbabilities();
            }
            if (this.assistMode) {
                this.calculateAndDisplayAssist();
            }
            
            this.revealedCellsCount = 0;  // カウントをリセット
            this.revealedCells = [];  // 座標リストをリセット
        }
    }
    
    // 指定されたセルの周囲の確率表示をクリア
    clearProbabilitiesAroundCells(cells) {
        const clearedCells = new Set();
        
        for (const {row, col} of cells) {
            // 開いたセル自体とその周囲8マスの確率表示をクリア
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    const newRow = row + dr;
                    const newCol = col + dc;
                    const key = `${newRow},${newCol}`;
                    
                    if (this.isValidCell(newRow, newCol) && !clearedCells.has(key)) {
                        clearedCells.add(key);
                        const cell = document.querySelector(`[data-row="${newRow}"][data-col="${newCol}"]`);
                        if (cell) {
                            const overlay = cell.querySelector('.probability-overlay');
                            if (overlay) {
                                overlay.remove();
                            }
                            cell.classList.remove('probability-safe', 'probability-low', 
                                                'probability-medium', 'probability-high', 
                                                'probability-certain', 'probability-unknown', 'probability-interrupted',
                                                'mine-candidate');
                        }
                    }
                }
            }
        }
    }
    
    // ダブルクリックで周囲のマスを開く（コード操作）
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
            // コード操作開始
            this.isChording = true;
            this.revealedCellsCount = 0;
            this.revealedCells = [];
            
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
            
            // コード操作終了、一度だけ計算
            this.isChording = false;
            
            // 実際にセルが開いた場合のみ計算
            if (this.revealedCellsCount > 0) {
                // 大きく開けた場合でも制約伝播は実行（完全探索は20マス制限で自動的に制御される）
                if (this.probabilityMode) {
                    this.calculateAndDisplayProbabilities();
                }
                if (this.assistMode) {
                    this.calculateAndDisplayAssist();
                }
            }
            
            this.revealedCellsCount = 0;
            this.revealedCells = [];
        }
    }
    
    toggleFlag(row, col) {
        // 旗を外す場合の判定（旗を外す前に状態を確認）
        const isRemovingFlag = this.flagged[row][col];
        
        super.toggleFlag(row, col);
        
        // 旗を外した場合、そのセルの永続確率をクリア
        if (isRemovingFlag && this.cspSolver && this.cspSolver.persistentProbabilities) {
            if (this.cspSolver.persistentProbabilities[row] && 
                this.cspSolver.persistentProbabilities[row][col] !== undefined) {
                console.log(`[DEBUG] Clearing persistent probability for unflagged cell (${row},${col}): was ${this.cspSolver.persistentProbabilities[row][col]}%`);
                this.cspSolver.persistentProbabilities[row][col] = -1;
            }
            
            // 旗を外した場合、すべての永続確率をクリアして再計算を強制
            console.log(`[DEBUG] Flag removed - clearing all persistent probabilities to force recalculation`);
            this.cspSolver.persistentProbabilities = [];
        }
        
        // 旗を立てた/外した時に確率を再計算
        if (this.probabilityMode && this.cspSolver) {
            this.calculateAndDisplayProbabilities();
        }
        if (this.assistMode && this.cspSolver) {
            this.calculateAndDisplayAssist();
        }
    }
    
    // 盤面管理機能
    openBoardManager() {
        const modal = document.getElementById('board-manager-modal');
        if (modal) {
            modal.classList.add('show');
            this.setupBoardManagerEvents();
            this.loadSavedBoards();
        }
    }
    
    closeBoardManager() {
        const modal = document.getElementById('board-manager-modal');
        if (modal) {
            modal.classList.remove('show');
        }
        // 保存済み盤面の編集から開始された編集モードの場合は継続する
        if (this.isEditorMode && !this.isEditingFromSavedBoard) {
            this.exitEditorMode();
        }
    }
    
    setupBoardManagerEvents() {
        // 既存のイベントリスナーがある場合は削除
        this.removeBoardManagerEvents();
        
        // タブ切り替え
        this.savedBoardsTabHandler = () => this.showTab('saved-boards');
        this.boardEditorTabHandler = () => this.showTab('board-editor');
        this.importExportTabHandler = () => this.showTab('import-export');
        
        document.getElementById('saved-boards-tab')?.addEventListener('click', this.savedBoardsTabHandler);
        document.getElementById('board-editor-tab')?.addEventListener('click', this.boardEditorTabHandler);
        document.getElementById('import-export-tab')?.addEventListener('click', this.importExportTabHandler);
        
        // 閉じるボタン
        this.closeBoardManagerHandler = () => this.closeBoardManager();
        document.getElementById('close-board-manager')?.addEventListener('click', this.closeBoardManagerHandler);
        
        // 現在の盤面を保存
        this.saveCurrentBoardHandler = () => this.saveCurrentBoard();
        document.getElementById('save-current-board')?.addEventListener('click', this.saveCurrentBoardHandler);
        
        // エディター機能
        this.mineModeHandler = () => this.setEditorMode('mine');
        this.revealModeHandler = () => this.setEditorMode('reveal');
        this.saveEditedBoardHandler = () => this.saveEditedBoard();
        this.testBoardHandler = () => this.testBoard();
        
        document.getElementById('mine-mode-btn')?.addEventListener('click', this.mineModeHandler);
        document.getElementById('reveal-mode-btn')?.addEventListener('click', this.revealModeHandler);
        document.getElementById('save-edited-board')?.addEventListener('click', this.saveEditedBoardHandler);
        document.getElementById('test-board-btn')?.addEventListener('click', this.testBoardHandler);
        
        // インポート/エクスポート
        this.exportCurrentHandler = () => this.exportCurrentBoard();
        this.importBoardHandler = () => this.importBoard();
        this.copyExportHandler = () => this.copyExportCode();
        
        document.getElementById('export-current-btn')?.addEventListener('click', this.exportCurrentHandler);
        document.getElementById('import-board-btn')?.addEventListener('click', this.importBoardHandler);
        document.getElementById('copy-export-btn')?.addEventListener('click', this.copyExportHandler);
        
        // 検索機能
        this.boardSearchHandler = (e) => this.filterSavedBoards(e.target.value);
        document.getElementById('board-search-input')?.addEventListener('input', this.boardSearchHandler);
        
        // モーダル外クリックで閉じる
        this.modalClickHandler = (e) => {
            const modal = document.getElementById('board-manager-modal');
            if (e.target === modal) {
                this.closeBoardManager();
            }
        };
        document.getElementById('board-manager-modal')?.addEventListener('click', this.modalClickHandler);
    }
    
    removeBoardManagerEvents() {
        document.getElementById('saved-boards-tab')?.removeEventListener('click', this.savedBoardsTabHandler);
        document.getElementById('board-editor-tab')?.removeEventListener('click', this.boardEditorTabHandler);
        document.getElementById('import-export-tab')?.removeEventListener('click', this.importExportTabHandler);
        document.getElementById('close-board-manager')?.removeEventListener('click', this.closeBoardManagerHandler);
        document.getElementById('save-current-board')?.removeEventListener('click', this.saveCurrentBoardHandler);
        document.getElementById('mine-mode-btn')?.removeEventListener('click', this.mineModeHandler);
        document.getElementById('reveal-mode-btn')?.removeEventListener('click', this.revealModeHandler);
        document.getElementById('save-edited-board')?.removeEventListener('click', this.saveEditedBoardHandler);
        document.getElementById('test-board-btn')?.removeEventListener('click', this.testBoardHandler);
        document.getElementById('export-current-btn')?.removeEventListener('click', this.exportCurrentHandler);
        document.getElementById('import-board-btn')?.removeEventListener('click', this.importBoardHandler);
        document.getElementById('copy-export-btn')?.removeEventListener('click', this.copyExportHandler);
        document.getElementById('board-search-input')?.removeEventListener('input', this.boardSearchHandler);
        document.getElementById('board-manager-modal')?.removeEventListener('click', this.modalClickHandler);
    }
    
    showTab(tabName) {
        // 全タブを非アクティブ化
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        
        // 選択したタブをアクティブ化
        document.getElementById(tabName + '-tab')?.classList.add('active');
        document.getElementById(tabName + '-content')?.classList.add('active');
        
        if (tabName === 'board-editor') {
            this.enterEditorMode();
        } else if (this.isEditorMode) {
            this.exitEditorMode();
        }
    }
    
    // 軽量化データ形式での盤面データ作成（地雷配置のみ保存）
    createBoardData(name = '') {
        const mines = [];
        
        console.log('Creating board data. isEditorMode:', this.isEditorMode, 'firstClick:', this.firstClick);
        console.log('Board state:', this.board ? 'exists' : 'null');
        
        // 現在のボードから地雷位置を抽出
        if (this.isEditorMode) {
            // エディターモードでは editorMines を使用
            console.log('Using editor mines:', Array.from(this.editorMines));
            this.editorMines.forEach(minePos => {
                const [row, col] = minePos.split(',').map(Number);
                mines.push([row, col]);
            });
        } else {
            // ゲームモードでは実際のボードを使用
            console.log('Checking game board for mines...');
            
            if (this.firstClick) {
                console.warn('Game not started yet - no mines placed');
                return null; // ゲームが開始されていない場合はnullを返す
            }
            
            for (let row = 0; row < this.rows; row++) {
                for (let col = 0; col < this.cols; col++) {
                    if (this.board && this.board[row] && this.board[row][col] === -1) {
                        mines.push([row, col]);
                        console.log('Found mine at:', [row, col]);
                    }
                }
            }
        }
        
        console.log('Extracted mines:', mines);
        
        // 開いた状態の情報を抽出
        const revealedCells = [];
        console.log('createBoardData: isEditorMode =', this.isEditorMode);
        console.log('createBoardData: editorRevealed =', Array.from(this.editorRevealed));
        if (this.isEditorMode) {
            // エディターモードでは editorRevealed を使用
            this.editorRevealed.forEach(cellPos => {
                const [row, col] = cellPos.split(',').map(Number);
                revealedCells.push([row, col]);
            });
        }
        console.log('createBoardData: final revealedCells =', revealedCells);
        
        const boardData = {
            name: name,
            timestamp: Date.now(),
            rows: this.rows,
            cols: this.cols,
            mines: mines,
            revealedCells: revealedCells,
            difficulty: this.currentDifficulty
        };
        
        console.log('Created board data:', boardData);
        
        return boardData;
    }
    
    saveCurrentBoard() {
        // ゲームが開始されているか確認
        if (this.firstClick && !this.isEditorMode) {
            alert('まず盤面をクリックしてゲームを開始してください');
            return;
        }
        
        const name = prompt('盤面名を入力してください:', `盤面_${new Date().toLocaleString('ja-JP', {month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'})}`);
        if (!name) return;
        
        const boardData = this.createBoardData(name);
        if (!boardData) {
            alert('盤面データの作成に失敗しました');
            return;
        }
        
        this.saveBoardToStorage(boardData);
        this.loadSavedBoards();
        
        alert('盤面を保存しました: ' + name);
    }
    
    saveBoardToStorage(boardData) {
        const savedBoards = this.getSavedBoards();
        
        // 同じ名前の盤面があれば上書き確認
        const existingIndex = savedBoards.findIndex(board => board.name === boardData.name);
        if (existingIndex !== -1) {
            if (!confirm('同じ名前の盤面が存在します。上書きしますか？')) {
                return false;
            }
            savedBoards[existingIndex] = boardData;
        } else {
            savedBoards.push(boardData);
        }
        
        // 最新のものから順に並び替え
        savedBoards.sort((a, b) => b.timestamp - a.timestamp);
        
        // 上限設定（100個まで）
        if (savedBoards.length > 100) {
            savedBoards.splice(100);
        }
        
        localStorage.setItem('minesweeper-saved-boards', JSON.stringify(savedBoards));
        return true;
    }
    
    getSavedBoards() {
        const saved = localStorage.getItem('minesweeper-saved-boards');
        return saved ? JSON.parse(saved) : [];
    }
    
    loadSavedBoards() {
        const savedBoards = this.getSavedBoards();
        const listElement = document.getElementById('saved-boards-list');
        
        if (savedBoards.length === 0) {
            listElement.innerHTML = '<div class="empty-state">保存された盤面がありません</div>';
            return;
        }
        
        listElement.innerHTML = '';
        
        savedBoards.forEach(boardData => {
            const boardItem = this.createBoardListItem(boardData);
            listElement.appendChild(boardItem);
        });
    }
    
    createBoardListItem(boardData) {
        const item = document.createElement('div');
        item.className = 'board-item';
        
        const date = new Date(boardData.timestamp).toLocaleString('ja-JP');
        const mineCount = boardData.mines.length;
        const revealedCount = boardData.revealedCells ? boardData.revealedCells.length : 0;
        
        item.innerHTML = `
            <div class="board-item-info">
                <h4 class="board-name">${this.escapeHtml(boardData.name)}</h4>
                <div class="board-details">
                    <span>${boardData.rows}×${boardData.cols}</span>
                    <span>地雷${mineCount}個</span>
                    ${revealedCount > 0 ? `<span>開始${revealedCount}個</span>` : ''}
                    <span>${date}</span>
                </div>
            </div>
            <div class="board-item-actions">
                <button class="board-btn primary" data-action="load">読み込み</button>
                <button class="board-btn secondary" data-action="edit">編集</button>
                <button class="board-btn danger" data-action="delete">削除</button>
            </div>
        `;
        
        // イベントリスナー追加
        item.querySelector('[data-action="load"]').addEventListener('click', () => {
            this.editBoard(boardData);
        });
        
        item.querySelector('[data-action="edit"]').addEventListener('click', () => {
            this.editBoard(boardData);
        });
        
        item.querySelector('[data-action="delete"]').addEventListener('click', () => {
            this.deleteBoard(boardData);
        });
        
        return item;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    loadBoard(boardData) {
        console.log('Loading board:', boardData);
        
        // ゲーム初期状態でその盤面をロード（新しいゲームとして開始）
        this.currentDifficulty = boardData.difficulty || 'easy';
        const difficultySelect = document.getElementById('difficulty-select');
        if (difficultySelect) {
            difficultySelect.value = this.currentDifficulty;
        }
        
        // ボード初期化
        this.initBoard(boardData.rows, boardData.cols, boardData.mines.length);
        
        // 地雷配置を設定
        this.board = Array(boardData.rows).fill(null).map(() => Array(boardData.cols).fill(0));
        boardData.mines.forEach(([row, col]) => {
            if (row < boardData.rows && col < boardData.cols) {
                this.board[row][col] = -1;
            }
        });
        
        console.log('Board after mine placement:', this.board);
        
        // 周囲の数字を計算
        this.calculateNumbers();
        
        console.log('Board after number calculation:', this.board);
        
        // 新しいゲーム状態で開始
        this.revealed = Array(boardData.rows).fill(null).map(() => Array(boardData.cols).fill(false));
        this.flagged = Array(boardData.rows).fill(null).map(() => Array(boardData.cols).fill(false));
        this.questioned = Array(boardData.rows).fill(null).map(() => Array(boardData.cols).fill(false));
        
        // 保存された開いた状態を適用
        if (boardData.revealedCells && boardData.revealedCells.length > 0) {
            console.log('loadBoard: applying revealedCells =', boardData.revealedCells);
            boardData.revealedCells.forEach(([row, col]) => {
                if (row < boardData.rows && col < boardData.cols) {
                    this.revealed[row][col] = true;
                    console.log(`loadBoard: set revealed[${row}][${col}] = true`);
                }
            });
            console.log('loadBoard: revealed array after applying =', this.revealed);
        } else {
            console.log('loadBoard: no revealedCells to apply');
        }
        
        this.gameOver = false;
        this.gameWon = false;
        this.timer = 0;
        this.firstClick = false; // 地雷は既に配置済み
        
        // 地雷数と設定を更新
        this.mineCount = boardData.mines.length;
        this.totalMines = boardData.mines.length;
        
        // タイマーを停止
        this.stopTimer();
        
        // UI更新
        this.renderBoard();
        this.updateMineCount();
        this.updateTimer();
        
        // 確率・補助表示をクリア
        if (this.probabilityMode) {
            this.clearProbabilityDisplay();
        }
        if (this.assistMode) {
            this.clearAssistDisplay();
        }
        
        // モーダルを閉じる
        this.closeBoardManager();
        
        alert(`盤面「${boardData.name}」を読み込みました`);
    }
    
    calculateNumbers() {
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                if (this.board[row][col] !== -1) {
                    let count = 0;
                    for (let dr = -1; dr <= 1; dr++) {
                        for (let dc = -1; dc <= 1; dc++) {
                            const newRow = row + dr;
                            const newCol = col + dc;
                            if (this.isValidCell(newRow, newCol) && this.board[newRow][newCol] === -1) {
                                count++;
                            }
                        }
                    }
                    this.board[row][col] = count;
                }
            }
        }
    }
    
    deleteBoard(boardData) {
        if (!confirm(`盤面「${boardData.name}」を削除しますか？`)) return;
        
        const savedBoards = this.getSavedBoards();
        const filteredBoards = savedBoards.filter(board => 
            !(board.name === boardData.name && board.timestamp === boardData.timestamp)
        );
        
        localStorage.setItem('minesweeper-saved-boards', JSON.stringify(filteredBoards));
        this.loadSavedBoards();
        
        alert(`盤面「${boardData.name}」を削除しました`);
    }
    
    filterSavedBoards(searchTerm) {
        const items = document.querySelectorAll('.board-item');
        const term = searchTerm.toLowerCase();
        
        items.forEach(item => {
            const name = item.querySelector('.board-name').textContent.toLowerCase();
            item.style.display = name.includes(term) ? 'block' : 'none';
        });
    }
    
    // エディター機能
    setEditorMode(mode) {
        this.editorMode = mode;
        
        // ボタンのスタイルを更新
        const mineModeBtn = document.getElementById('mine-mode-btn');
        const revealModeBtn = document.getElementById('reveal-mode-btn');
        
        if (mode === 'mine') {
            mineModeBtn?.classList.add('primary');
            mineModeBtn?.classList.remove('secondary');
            revealModeBtn?.classList.add('secondary');
            revealModeBtn?.classList.remove('primary');
        } else if (mode === 'reveal') {
            revealModeBtn?.classList.add('primary');
            revealModeBtn?.classList.remove('secondary');
            mineModeBtn?.classList.add('secondary');
            mineModeBtn?.classList.remove('primary');
        }
        
        this.updateEditorInstructions();
        
        // ボード表示を更新
        if (this.isEditorMode) {
            this.renderEditorBoard();
        }
    }
    
    updateEditorInstructions() {
        const instructions = document.querySelector('.editor-instructions p');
        if (!instructions) return;
        
        if (this.editorMode === 'mine') {
            if (this.continuousPlacement) {
                instructions.textContent = '地雷配置モード: 連続配置モード ON - マウスオーバーで地雷を配置/削除します。右クリックで連続配置モードを OFF にできます。';
            } else {
                instructions.textContent = '地雷配置モード: クリックで地雷を配置/削除できます。右クリックで連続配置モードを切り替えできます。';
            }
        } else if (this.editorMode === 'reveal') {
            instructions.textContent = '開く設定モード: クリックでマスの開く/閉じる状態を設定できます。地雷が配置されたマスは設定できません。';
        }
    }
    
    enterEditorMode() {
        console.log('Entering editor mode');
        this.isEditorMode = true;
        
        // 保存済み盤面の編集以外では、このフラグをfalseにする
        if (!this.isEditingFromSavedBoard) {
            this.isEditingFromSavedBoard = false;
        }
        
        // 現在のゲーム状態を保存
        this.saveCurrentGameState();
        
        // 保存されたエディター情報を復元
        if (this.savedEditorMines.size > 0) {
            this.editorMines = new Set(this.savedEditorMines);
        }
        if (this.savedEditorRevealed.size > 0) {
            this.editorRevealed = new Set(this.savedEditorRevealed);
        }
        
        // 現在の盤面の地雷配置をエディター用にコピー（editBoardから呼ばれた場合や保存情報がある場合はスキップ）
        if (this.editorMines.size === 0) {
            console.log('Copying mines from current board to editor');
            for (let row = 0; row < this.rows; row++) {
                for (let col = 0; col < this.cols; col++) {
                    if (this.board && this.board[row] && this.board[row][col] === -1) {
                        this.editorMines.add(`${row},${col}`);
                    }
                }
            }
        }
        
        console.log('Editor mines before display update:', Array.from(this.editorMines));
        
        // デフォルトで地雷配置モードに設定
        this.setEditorMode('mine');
        
        this.updateEditorDisplay();
        this.renderEditorBoard();
        
        // ボードのタイトルを変更
        const title = document.getElementById('board-manager-title');
        if (title) {
            title.textContent = '盤面エディター';
        }
    }
    
    saveCurrentGameState() {
        // 現在のメインゲームの状態を保存
        this.savedGameState = {
            board: this.board ? this.board.map(row => [...row]) : null,
            revealed: this.revealed ? this.revealed.map(row => [...row]) : null,
            flagged: this.flagged ? this.flagged.map(row => [...row]) : null,
            questioned: this.questioned ? this.questioned.map(row => [...row]) : null,
            rows: this.rows,
            cols: this.cols,
            totalMines: this.totalMines,
            mineCount: this.mineCount,
            gameOver: this.gameOver,
            gameWon: this.gameWon,
            timer: this.timer,
            firstClick: this.firstClick,
            currentDifficulty: this.currentDifficulty
        };
    }
    
    restoreGameState() {
        if (!this.savedGameState) {
            // 保存された状態がない場合は元のボード表示
            this.renderBoard();
            return;
        }
        
        // ゲーム状態を復元
        const state = this.savedGameState;
        this.board = state.board;
        this.revealed = state.revealed;
        this.flagged = state.flagged;
        this.questioned = state.questioned;
        this.rows = state.rows;
        this.cols = state.cols;
        this.totalMines = state.totalMines;
        this.mineCount = state.mineCount;
        this.gameOver = state.gameOver;
        this.gameWon = state.gameWon;
        this.timer = state.timer;
        this.firstClick = state.firstClick;
        this.currentDifficulty = state.currentDifficulty;
        
        // 画面を更新
        this.renderBoard();
        this.updateMineCount();
        this.updateTimer();
        
        // 保存された状態をクリア
        this.savedGameState = null;
    }
    
    exitEditorMode() {
        // エディター情報を保存（タブ切り替え時に失われないように）
this.savedEditorMines = new Set(this.editorMines);
        this.savedEditorRevealed = new Set(this.editorRevealed);
        
        this.isEditorMode = false;
        
        // 保存済み盤面編集フラグをリセット
        this.isEditingFromSavedBoard = false;
        
        // エディターモード用のクラスを削除
        const boardElement = document.getElementById('game-board');
        if (boardElement) {
            boardElement.classList.remove('editor-mode');
        }
        
        // 保存されたゲーム状態を復元
        this.restoreGameState();
        
        // タイトルを戻す
        const title = document.getElementById('board-manager-title');
        if (title) {
            title.textContent = '盤面管理';
        }
    }
    
    renderEditorBoard() {
        const boardElement = document.getElementById('game-board');
        boardElement.innerHTML = '';
        boardElement.style.gridTemplateColumns = `repeat(${this.cols}, 1fr)`;
        
        // エディターモード用のクラス追加
        boardElement.classList.add('editor-mode');
        
        // ボード要素で右クリックメニューを無効化
        boardElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
        
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const cell = document.createElement('div');
                cell.className = 'cell editor-cell';
                cell.dataset.row = row;
                cell.dataset.col = col;
                
                this.setupEditorCellEventListeners(cell, row, col);
                this.updateEditorCell(row, col, cell);
                
                boardElement.appendChild(cell);
            }
        }
    }
    
    setupEditorCellEventListeners(cell, row, col) {
        // 左クリック: モードに応じた操作
        cell.addEventListener('click', (e) => {
            e.preventDefault();
            if (this.editorMode === 'mine') {
                this.toggleMineInEditor(row, col);
            } else if (this.editorMode === 'reveal') {
                this.toggleRevealInEditor(row, col);
            }
        });
        
        // 右クリック: 連続配置モードトグル（地雷モードのみ）
        cell.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            if (this.editorMode === 'mine') {
                this.continuousPlacement = !this.continuousPlacement;
                this.updateEditorInstructions();
            }
        });
        
        // マウスオーバー: 連続配置モード時
        cell.addEventListener('mouseenter', () => {
            if (this.continuousPlacement && this.editorMode === 'mine') {
                this.toggleMineInEditor(row, col);
            }
        });
    }
    
    toggleMineInEditor(row, col) {
        const key = `${row},${col}`;
        
        if (this.editorMines.has(key)) {
            this.editorMines.delete(key);
        } else {
            // 地雷を配置する場合、そのマスの開く設定を削除
            this.editorMines.add(key);
            if (this.editorRevealed.has(key)) {
                this.editorRevealed.delete(key);
            }
        }
        
        // エディター情報を常時保存
        this.savedEditorMines = new Set(this.editorMines);
        this.savedEditorRevealed = new Set(this.editorRevealed);
        
        // セル表示を更新
        const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        if (cell) {
            this.updateEditorCell(row, col, cell);
        }
        
        // 統計表示を更新
        this.updateEditorDisplay();
    }
    
    toggleRevealInEditor(row, col) {
        const key = `${row},${col}`;
        
        // 地雷が配置されているマスは開く設定できない
        if (this.editorMines.has(key)) {
            return;
        }
        
        if (this.editorRevealed.has(key)) {
            this.editorRevealed.delete(key);
        } else {
            this.editorRevealed.add(key);
        }
        
        // エディター情報を常時保存
        this.savedEditorMines = new Set(this.editorMines);
        this.savedEditorRevealed = new Set(this.editorRevealed);
        
        // セル表示を更新
        const cell = document.querySelector(`[data-row="${row}"][data-col="${col}"]`);
        if (cell) {
            this.updateEditorCell(row, col, cell);
        }
    }
    
    updateEditorCell(row, col, cell) {
        const key = `${row},${col}`;
        
        // クラスをクリア
        cell.classList.remove('editor-mine', 'editor-revealed');
        cell.textContent = '';
        
        if (this.editorMines.has(key)) {
            cell.classList.add('editor-mine');
            cell.textContent = '💣';
            console.log(`Cell (${row},${col}) marked as mine`);
        } else if (this.editorRevealed.has(key)) {
            cell.classList.add('editor-revealed');
            cell.textContent = '✓';
            console.log(`Cell (${row},${col}) marked as revealed`);
        }
    }
    
    updateEditorDisplay() {
        const mineCountDisplay = document.getElementById('mine-count-display');
        const boardSizeDisplay = document.getElementById('board-size-display');
        
        console.log('Updating editor display - mine count:', this.editorMines.size);
        
        if (mineCountDisplay) {
            mineCountDisplay.textContent = this.editorMines.size;
        }
        
        if (boardSizeDisplay) {
            boardSizeDisplay.textContent = `${this.rows}×${this.cols}`;
        }
    }
    
    
    saveEditedBoard() {
        const nameInput = document.getElementById('board-name-input');
        const name = nameInput ? nameInput.value.trim() : '';
        
        if (!name) {
            alert('盤面名を入力してください');
            return;
        }
        
        if (this.editorMines.size === 0) {
            alert('地雷を配置してください');
            return;
        }
        
        const boardData = this.createBoardData(name);
        this.saveBoardToStorage(boardData);
        
        alert(`盤面「${name}」を保存しました`);
        
        // 盤面名をクリア
        if (nameInput) {
            nameInput.value = '';
        }
        
        // 保存済み盤面リストを更新
        this.loadSavedBoards();
    }
    
    testBoard() {
        if (this.editorMines.size === 0) {
            alert('地雷を配置してください');
            return;
        }
        
        // エディターの盤面をテスト用に適用
        const boardData = this.createBoardData('テスト盤面');
        
        console.log('testBoard: boardData =', boardData);
        console.log('testBoard: revealedCells =', boardData.revealedCells);
        
        // ゲームモードに戻す
        this.exitEditorMode();
        
        // テスト盤面をロード
        this.loadBoard(boardData);
    }
    
    editBoard(boardData) {
        console.log('Editing board:', boardData);
        
        // 保存済み盤面からの編集であることをマーク
        this.isEditingFromSavedBoard = true;
        
        // エディタータブに切り替え
        this.showTab('board-editor');
        
        // ボードサイズと難易度を合わせる
        this.currentDifficulty = boardData.difficulty || 'easy';
        const difficultySelect = document.getElementById('difficulty-select');
        if (difficultySelect) {
            difficultySelect.value = this.currentDifficulty;
        }
        
        // ボード初期化
        this.initBoard(boardData.rows, boardData.cols, boardData.mines.length);
        
        // エディター用地雷配置を設定
        this.editorMines.clear();
        console.log('Setting editor mines from boardData.mines:', boardData.mines);
        
        boardData.mines.forEach(([row, col]) => {
            const key = `${row},${col}`;
            this.editorMines.add(key);
            console.log('Added mine at:', key);
        });
        
        // エディター用開いた状態を設定
        this.editorRevealed.clear();
        if (boardData.revealedCells && boardData.revealedCells.length > 0) {
            console.log('editBoard: Setting editor revealed cells from boardData.revealedCells:', boardData.revealedCells);
            
            boardData.revealedCells.forEach(([row, col]) => {
                const key = `${row},${col}`;
                this.editorRevealed.add(key);
                console.log('editBoard: Added revealed cell at:', key);
            });
        } else {
            console.log('editBoard: No revealedCells in boardData');
        }
        
        console.log('Editor mines after setup:', Array.from(this.editorMines));
        console.log('Editor revealed cells after setup:', Array.from(this.editorRevealed));
        
        // エディター情報を保存（常時保存）
        this.savedEditorMines = new Set(this.editorMines);
        this.savedEditorRevealed = new Set(this.editorRevealed);
        
        // 盤面名を設定
        const nameInput = document.getElementById('board-name-input');
        if (nameInput) {
            nameInput.value = boardData.name;
        }
        
        // エディターモードに入る
        this.enterEditorMode();
    }
    
    // インポート/エクスポート機能
    exportCurrentBoard() {
        // エディター情報を保持しているかチェック（現在の情報 + 保存された情報）
        const hasCurrentEditorData = this.editorMines && this.editorMines.size > 0;
        const hasSavedEditorData = this.savedEditorMines && this.savedEditorMines.size > 0;
        
        
        let boardData;
        if (hasCurrentEditorData || hasSavedEditorData) {
            // エディター情報がある場合は、一時的にエディターモードとして扱う
            const wasEditorMode = this.isEditorMode;
            this.isEditorMode = true;
            
            // 保存された情報を現在の情報に復元
            if (hasSavedEditorData && !hasCurrentEditorData) {
                this.editorMines = new Set(this.savedEditorMines);
                this.editorRevealed = new Set(this.savedEditorRevealed);
            }
            
            boardData = this.createBoardData('エクスポート盤面');
            
            // 元の状態に戻す
            this.isEditorMode = wasEditorMode;
        } else {
            // エディター情報がない場合は通常通り
            boardData = this.createBoardData('エクスポート盤面');
        }
        
        
        if (!boardData) {
            alert('ゲームを開始してから盤面をエクスポートしてください');
            return;
        }
        
        const exportCode = this.encodeBoardData(boardData);
        console.log('Generated export code:', exportCode);
        
        const exportArea = document.getElementById('export-code-area');
        if (exportArea) {
            exportArea.value = exportCode;
        }
    }
    
    encodeBoardData(boardData) {
        // 軽量化されたデータをBase64エンコード
        const compactData = {
            n: boardData.name,
            t: boardData.timestamp,
            r: boardData.rows,
            c: boardData.cols,
            m: boardData.mines,
            rv: boardData.revealedCells || [],
            d: boardData.difficulty
        };
        
        try {
            const jsonString = JSON.stringify(compactData);
            return 'MS-' + btoa(unescape(encodeURIComponent(jsonString)));
        } catch (error) {
            console.error('Export encoding error:', error);
            return null;
        }
    }
    
    decodeBoardData(exportCode) {
        try {
            if (!exportCode.startsWith('MS-')) {
                throw new Error('Invalid format');
            }
            
            const base64Data = exportCode.substring(3);
            const jsonString = decodeURIComponent(escape(atob(base64Data)));
            const compactData = JSON.parse(jsonString);
            
            return {
                name: compactData.n || 'インポート盤面',
                timestamp: compactData.t || Date.now(),
                rows: compactData.r,
                cols: compactData.c,
                mines: compactData.m,
                revealedCells: compactData.rv || [],
                difficulty: compactData.d || 'easy'
            };
        } catch (error) {
            console.error('Import decoding error:', error);
            return null;
        }
    }
    
    importBoard() {
        const importArea = document.getElementById('import-code-area');
        if (!importArea) return;
        
        const importCode = importArea.value.trim();
        if (!importCode) {
            alert('盤面コードを入力してください');
            return;
        }
        
        console.log('Importing code:', importCode);
        
        const boardData = this.decodeBoardData(importCode);
        console.log('Decoded board data:', boardData);
        
        if (!boardData) {
            alert('無効な盤面コードです');
            return;
        }
        
        // 盤面データの検証
        if (!this.validateBoardData(boardData)) {
            console.log('Validation failed for board data:', boardData);
            alert('盤面データが無効です');
            return;
        }
        
        console.log('Board data validation passed');
        
        // インポートした盤面をエディターで表示
        this.editBoard(boardData);
        
        // インポートエリアをクリア
        importArea.value = '';
    }
    
    validateBoardData(boardData) {
        // 基本的な検証
        if (!boardData.rows || !boardData.cols || !boardData.mines) {
            return false;
        }
        
        // サイズの検証
        if (boardData.rows < 3 || boardData.rows > 100 || 
            boardData.cols < 3 || boardData.cols > 100) {
            return false;
        }
        
        // 地雷数の検証
        const maxMines = boardData.rows * boardData.cols - 1;
        if (boardData.mines.length > maxMines) {
            return false;
        }
        
        // 地雷位置の検証
        for (const [row, col] of boardData.mines) {
            if (row < 0 || row >= boardData.rows || 
                col < 0 || col >= boardData.cols) {
                return false;
            }
        }
        
        return true;
    }
    
    copyExportCode() {
        const exportArea = document.getElementById('export-code-area');
        if (!exportArea || !exportArea.value) {
            alert('エクスポートコードがありません');
            return;
        }
        
        exportArea.select();
        exportArea.setSelectionRange(0, 99999); // モバイル対応
        
        try {
            document.execCommand('copy');
            alert('盤面コードをコピーしました');
        } catch (error) {
            // Fallback: navigator.clipboard APIを使用
            if (navigator.clipboard) {
                navigator.clipboard.writeText(exportArea.value).then(() => {
                    alert('盤面コードをコピーしました');
                }).catch(() => {
                    alert('コピーに失敗しました。手動で選択してコピーしてください。');
                });
            } else {
                alert('コピーに失敗しました。手動で選択してコピーしてください。');
            }
        }
    }
    
    // 既存のrenderBoardメソッドをオーバーライドしてエディターモード対応
    renderBoard() {
        if (this.isEditorMode) {
            this.renderEditorBoard();
            return;
        }
        
        // PCMinesweeperのrenderBoardを呼び出し
        const boardElement = document.getElementById('game-board');
        if (boardElement) {
            boardElement.innerHTML = '';
            boardElement.style.gridTemplateColumns = `repeat(${this.cols}, 1fr)`;
            boardElement.classList.remove('editor-mode');
            
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
            
            // 全セルがDOMに追加された後にupdateCellを呼ぶ
            for (let row = 0; row < this.rows; row++) {
                for (let col = 0; col < this.cols; col++) {
                    this.updateCell(row, col);
                }
            }
            
            // 現在のズームレベルとフォントサイズを適用
            this.updateZoom();
            this.updateFontSize();
        }
    }
}

// ゲームの初期化
document.addEventListener('DOMContentLoaded', () => {
    window.game = new PCProMinesweeper();
});