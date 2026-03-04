# HTXBACHGIA Deploy Guide (SSH Key + Fast Deploy)

This guide standardizes secure access and quick deploy for `htxbachgia.shop`.

## 1) Rotate SSH Password Now

Use this once immediately (especially if password was shared before):

```bash
ssh admin-001@192.168.100.237
passwd
```

Optional (if you also use root login, not recommended):

```bash
sudo passwd root
```

## 2) Create SSH Key On Local Machine

### Windows PowerShell

```powershell
$KeyPath = "$HOME/.ssh/id_ed25519_htxbachgia"
ssh-keygen -t ed25519 -a 64 -f $KeyPath -C "admin-001@192.168.100.237"
```

### Linux/macOS

```bash
ssh-keygen -t ed25519 -a 64 -f ~/.ssh/id_ed25519_htxbachgia -C "admin-001@192.168.100.237"
```

## 3) Publish Public Key To Server

### Linux/macOS (recommended)

```bash
ssh-copy-id -i ~/.ssh/id_ed25519_htxbachgia.pub admin-001@192.168.100.237
```

### Windows PowerShell (manual fallback)

```powershell
$pub = (Get-Content "$HOME/.ssh/id_ed25519_htxbachgia.pub" -Raw).Trim()
ssh admin-001@192.168.100.237 "umask 077; mkdir -p ~/.ssh; grep -qxF '$pub' ~/.ssh/authorized_keys || echo '$pub' >> ~/.ssh/authorized_keys; chmod 700 ~/.ssh; chmod 600 ~/.ssh/authorized_keys"
```

## 4) Verify Key Login

```bash
ssh -i ~/.ssh/id_ed25519_htxbachgia admin-001@192.168.100.237 "hostname && whoami"
```

Expected output ends with:

```text
admin001-ProLiant-DL360-Gen9
admin-001
```

## 5) Optional Hardening (After Key Login Works)

Only do this after you confirmed key login in a second terminal:

```bash
sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak.$(date +%Y%m%d-%H%M%S)
sudo sed -i 's/^#\\?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo sed -i 's/^#\\?PubkeyAuthentication.*/PubkeyAuthentication yes/' /etc/ssh/sshd_config
sudo systemctl restart ssh || sudo systemctl restart sshd
```

## 6) Fast Deploy With SSH Key

`deploy-htxbachgia.sh` now supports:

- `SSH_KEY_PATH`
- `SSH_STRICT_HOST_KEY_CHECKING` (default: `accept-new`)
- `SSH_BATCH_MODE` (`yes` to fail fast if key auth fails)

### Example Deploy

```bash
SSH_USER=admin-001 \
SSH_HOST=192.168.100.237 \
SSH_KEY_PATH=~/.ssh/id_ed25519_htxbachgia \
SSH_BATCH_MODE=yes \
bash ./deploy-htxbachgia.sh version19
```

## 7) Quick Remote Wrapper (Optional)

`scripts/deploy-htxbachgia-remote.sh` also supports key auth and these options:

- `SSH_KEY_PATH`
- `SSH_BATCH_MODE`
- `REMOTE_USE_SUDO` (default `1`, set `0` if sudo is not needed)

Example:

```bash
SSH_USER=admin-001 \
SSH_HOST=192.168.100.237 \
SSH_KEY_PATH=~/.ssh/id_ed25519_htxbachgia \
SSH_BATCH_MODE=yes \
REMOTE_USE_SUDO=0 \
bash ./scripts/deploy-htxbachgia-remote.sh version19
```

## 8) Minimal Rollback

If a deploy fails, redeploy previous tag:

```bash
SSH_USER=admin-001 \
SSH_HOST=192.168.100.237 \
SSH_KEY_PATH=~/.ssh/id_ed25519_htxbachgia \
SSH_BATCH_MODE=yes \
bash ./deploy-htxbachgia.sh version17
```

## 9) Ads API Setup And UI Data Sync Guide

To configure Facebook, Google Ads, TikTok API credentials and push ads cost data into UI, use:

- `frontend/public/docs/ADS-API-SETUP-GUIDE.md`

In browser (after deploy), open:

- `/docs/ADS-API-SETUP-GUIDE.md`

Main UI screens:

- API setup: `/ads-settings`
- Token management: `/api-tokens`
- Ads cost data UI: `/costs/advertising`
