# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

マインスイーパーゲームのモノレポです。現在は単一のPC版実装が中心となっており、共通のコアロジックと機能拡張を持つモジュラーアーキテクチャを使用しています。

## アーキテクチャ

### コア構造
- `/minesweeper-core.js` - 共通ゲームロジックを持つベースクラス `MinesweeperCore`  
- `/pc-base.js` - PC向けベース機能を持つ `PCMinesweeper` クラス
- `/game.js` - PRO版機能を持つ `PCProMinesweeper` クラス（メイン実装）
- `/modules/` - 専門モジュール（CSPソルバーなど）
- `/assets/` - 共通アセット（サウンド、テーマ）

### 主要クラス継承構造
- `MinesweeperCore` - ベースゲームロジック（タイマー、ボード管理、地雷配置）
- `PCMinesweeper` (MinesweeperCoreを継承) - PC向け基本機能（ズーム、マウス操作）
- `PCProMinesweeper` (PCMinesweeperを継承) - 高度な機能（CSPソルバー、カスタムテーマ）

### 専門モジュール
- `modules/csp-solver.js` - 制約充足問題ソルバー（地雷配置確率計算）
- `modules/csp-worker.js` - WebWorker対応の並列計算処理

## 開発コマンド

ビルドツールを使わないバニラJavaScriptプロジェクトのため:
- package.jsonやビルドコマンドなし
- GitHub Pages経由で直接配信
- ブラウザでの手動テスト
- リントやTypeScript なし - 純粋なバニラJS

## ファイル構造パターン

- `index.html` - メインHTMLファイル（全クラスを`<script>`タグで読み込み）
- `minesweeper-core.js` → `pc-base.js` → `game.js` の順でクラス継承
- モジュール類は `modules/` ディレクトリで独立管理
- 共有アセットは `assets/` ディレクトリから参照（sounds/, themes/）

## 主要機能

### PRO版機能 (`game.js`)
- **CSPソルバー**: 制約充足問題を用いた地雷配置確率計算 (`modules/csp-solver.js`)
- **カスタムテーマ**: 5種類の色テーマ（クラシック、オーシャン、フォレスト、サンセット、ギャラクシー）
- **サウンドエフェクト**: ゲーム操作音の対応
- **ズーム機能**: 0.3倍～3.0倍のスケーリング対応

### 基本機能 (`pc-base.js`)
- 7つの難易度（簡単～極限）+ 隠し難易度3種
- マウス操作（左クリック：開く、右クリック：旗、ホイール：？マーク）
- ドラッグ&ドロップでの盤面移動
- フォントサイズ調整（50%～200%）

## 重要事項

- すべてのテキストとコメントは日本語
- 従来のマインスイーパールールを使用
- 最初のクリックは必ず安全（最初のクリック後に地雷配置）
- 各バージョンは独立した状態と設定を維持