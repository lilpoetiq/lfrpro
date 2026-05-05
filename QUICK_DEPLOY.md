# Quick Deploy Commands for DigitalOcean

## On Your Server (SSH'd in):

### 1. Install Node.js and nginx
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs nginx
```

### 2. Upload your project (run from YOUR LOCAL MACHINE)
```bash
# Replace YOUR_DROPLET_IP with your actual IP
rsync -avz --exclude 'node_modules' --exclude '.next' \
  "/Volumes/lil drive/lfr-dashboard/" \
  root@YOUR_DROPLET_IP:/root/lfr-dashboard/
```

### 3. On the server: Install dependencies and build
```bash
cd /root/lfr-dashboard
npm install
npm run build
```

### 4. Set up environment variables
```bash
nano /root/lfr-dashboard/.env.local
# Add your OPENAI_API_KEY and other vars
```

### 5. Configure nginx
```bash
cp /root/lfr-dashboard/nginx.conf /etc/nginx/sites-available/lfr-dashboard
ln -s /etc/nginx/sites-available/lfr-dashboard /etc/nginx/sites-enabled/
rm /etc/nginx/sites-enabled/default  # Remove default site
nginx -t  # Test config
systemctl reload nginx
```

### 6. Start the app with systemd
```bash
cp /root/lfr-dashboard/lfr-dashboard.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable lfr-dashboard
systemctl start lfr-dashboard
systemctl status lfr-dashboard  # Check if running
```

### 7. Set up Cloudflare Tunnel
```bash
# Install cloudflared
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
dpkg -i cloudflared-linux-amd64.deb

# Login and create tunnel
cloudflared tunnel login
cloudflared tunnel create lfr-dashboard

# Create config (replace TUNNEL_ID with actual ID)
mkdir -p ~/.cloudflared
cat > ~/.cloudflared/config.yml << EOF
tunnel: TUNNEL_ID
credentials-file: /root/.cloudflared/TUNNEL_ID.json

ingress:
  - hostname: your-domain.com
    service: http://localhost:80
  - service: http_status:404
EOF

# Install as service
cloudflared service install
systemctl start cloudflared
systemctl enable cloudflared
```

### 8. Check everything is working
```bash
# Check services
systemctl status nginx
systemctl status lfr-dashboard
systemctl status cloudflared

# Test the app
curl http://localhost:3000

# View logs
journalctl -u lfr-dashboard -f
```

## Quick Commands Reference

```bash
# Restart app
systemctl restart lfr-dashboard

# View app logs
journalctl -u lfr-dashboard -f

# Restart nginx
systemctl restart nginx

# Check if app is running on port 3000
netstat -tlnp | grep 3000

# Test nginx config
nginx -t
```
