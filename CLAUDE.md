# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

複数プラットフォームと用途に最適化されたマインスイーパーゲームのモノレポです。共通のコアロジックとプラットフォーム固有の実装を持つモジュラーアーキテクチャを使用しています。

## アーキテクチャ

### コア構造
- `/core/minesweeper-core.js` - 共通ゲームロジックを持つベースクラス `MinesweeperCore`
- `/products/` - コアを拡張する独立したゲームバージョン
- `/shared/` - 共通アセット、スタイル、ユーティリティ

### 製品バージョン
- `products/mobile/` - スマートフォン向けタッチ最適化版（シンプル版）
- `products/mobile-pro/` - 商品化向けモバイル版（本格的な機能追加用）
- `products/pc/` - マウス操作対応のデスクトップ版
- `products/pc-pro/` - CSPソルバー、テーマ、統計などの高度な機能を持つ上級版

### 主要クラス
- `MinesweeperCore` - ベースゲームロジック（タイマー、ボード管理、地雷配置）
- `MobileMinesweeper` (MinesweeperCoreを継承) - モバイル固有機能
- `PCMinesweeper` (MinesweeperCoreを継承) - PC固有機能
- `PCProMinesweeper` (PCMinesweeperを継承) - 高度な機能を持つPRO版

## 開発コマンド

ビルドツールを使わないバニラJavaScriptプロジェクトのため:
- package.jsonやビルドコマンドなし
- GitHub Pages経由で直接配信
- ブラウザでの手動テスト
- リントやTypeScript なし - 純粋なバニラJS

## ファイル構造パターン

- 各製品バージョンは独自の `index.html`、`game.js`、`style.css` を持つ
- コアロジックはHTMLの `<script>` タグで読み込み
- 製品はロジック重複ではなくコアクラスを拡張
- 共有アセットは `/shared/` ディレクトリから参照

## バージョン別主要機能

### PC-Pro (`products/pc-pro/`)
- 確率分析付きCSPソルバー (`modules/csp-solver.js`)
- カスタムカラースキーム対応テーマシステム
- 統計追跡とリプレイ機能
- サウンドエフェクトと高度なUI機能

### Mobile (`products/mobile/`)
- タッチ最適化コントロール（タップで開く、長押しで旗）
- 様々な画面サイズに対応するレスポンシブデザイン
- モバイル操作向けシンプルUI

### Mobile-Pro (`products/mobile-pro/`)
- Mobile版をベースとした商品化向け高機能版
- 既存のMobile版は完成品として保持
- 商品として売り出すための本格的な機能追加・拡張用

## 重要事項

- すべてのテキストとコメントは日本語
- 従来のマインスイーパールールを使用
- 最初のクリックは必ず安全（最初のクリック後に地雷配置）
- 各バージョンは独立した状態と設定を維持