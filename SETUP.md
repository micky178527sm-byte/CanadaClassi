# Setup

## Pushover通知設定

Codexの完了通知にPushoverを使う場合は、プロジェクトルートに `.env.local` を作成し、以下を設定してください。

```
PUSHOVER_USER_KEY=xxxxxxxx
PUSHOVER_APP_TOKEN=yyyyyyyy
```

注意:
- `.env.local` はコミットしないでください（`.gitignore` 済み）。
- VS Code / Codex 実行環境でも `.env.local` を自動で読み込みます。

### 動作確認

通知テスト:
```
./tools/codex_notify_pushover.sh --test
```

キー未設定時は警告ログを出して終了します（失敗扱いにはしません）。
