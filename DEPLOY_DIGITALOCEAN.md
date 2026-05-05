# DigitalOcean Deployment Guide

## Step 1: SSH into your DigitalOcean droplet

```bash
ssh root@YOUR_DROPLET_IP
```

## Step 2: Install Node.js and npm

```bash
# Update system
apt update && apt upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Verify installation
node --version
npm --version
```

## Step 3: Install nginx

```bash
apt install -y nginx
systemctl enable nginx
systemctl start nginx
```

## Step 4: Upload your project

### Option A: Clone from Git (if you have a repo)
```bash
cd /root
git clone YOUR_REPO_URL lfr-dashboard
cd lfr-dashboard
```

### Option B: Upload via SCP (from your local machine)
```bash
# From your local machine, run:
scp -r /Volumes/lil\ drive/lfr-dashboard root@YOUR_DROPLET_IP:/root/
```

### Option C: Use rsync (recommended)
```bash
# From your local machine:
rsync -avz --exclude 'node_modules' --exclude '.next' /Volumes/lil\ drive/lfr-dashboard/ root@YOUR_DROPLET_IP:/root/lfr-dashboard/
```

## Step 5: Install dependencies and build

```bash
cd /root/lfr-dashboard
npm install
npm run build
```

## Step 6: Set up environment variables

```bash
nano /root/lfr-dashboard/.env.local
```

Add your environment variables:
```env
OPENAI_API_KEY=your_openai_api_key_here
AI_SERVER_URL=http://localhost:3001
WEBSITE_URL=http://YOUR_DOMAIN_OR_IP
META_APP_ID=your_meta_app_id
META_APP_SECRET=your_meta_app_secret
CRON_SECRET=your_random_secret_string
```

## Step 7: Configure nginx

```bash
# Copy the nginx config
cp /root/lfr-dashboard/nginx.conf /etc/nginx/sites-available/lfr-dashboard

# Create symlink to enable it
ln -s /etc/nginx/sites-available/lfr-dashboard /etc/nginx/sites-enabled/

# Remove default nginx site (optional)
rm /etc/nginx/sites-enabled/default

# Test nginx configuration
nginx -t

# Reload nginx
systemctl reload nginx
```

## Step 8: Set up systemd service (keeps app running)

```bash
# Copy service file
cp /root/lfr-dashboard/lfr-dashboard.service /etc/systemd/system/

# Reload systemd
systemctl daemon-reload

# Enable service (starts on boot)
systemctl enable lfr-dashboard

# Start the service
systemctl start lfr-dashboard

# Check status
systemctl status lfr-dashboard

# View logs
journalctl -u lfr-dashboard -f
```

## Step 9: Set up Cloudflare Tunnel (cloudflared)

### Install cloudflared

```bash
# Download cloudflared
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb

# Install it
dpkg -i cloudflared-linux-amd64.deb

# Or use snap
snap install cloudflared
```

### Authenticate with Cloudflare

```bash
cloudflared tunnel login
```

This will open a browser window. Log in and authorize the tunnel.

### Create a tunnel

```bash
cloudflared tunnel create lfr-dashboard
```

This will create a tunnel and give you a tunnel ID. Save this ID.

### Configure the tunnel

```bash
# Create config directory
mkdir -p ~/.cloudflared

# Create config file
nano ~/.cloudflared/config.yml
```

Add this configuration (replace TUNNEL_ID with your actual tunnel ID):
```yaml
tunnel: TUNNEL_ID
credentials-file: /root/.cloudflared/TUNNEL_ID.json

ingress:
  - hostname: your-domain.com
    service: http://localhost:80
  - service: http_status:404
```

### Set up DNS

In your Cloudflare dashboard:
1. Go to your domain
2. Go to DNS → Records
3. Add a CNAME record:
   - Name: `@` (or `www` for subdomain)
   - Target: `TUNNEL_ID.cfargotunnel.com`
   - Proxy: Enabled (orange cloud)

### Run cloudflared as a service

```bash
# Install cloudflared service
cloudflared service install

# Start the service
systemctl start cloudflared
systemctl enable cloudflared

# Check status
systemctl status cloudflared
```

## Step 10: Verify everything is working

```bash
# Check nginx status
systemctl status nginx

# Check Next.js app status
systemctl status lfr-dashboard

# Check cloudflared status
systemctl status cloudflared

# Test nginx is proxying correctly
curl http://localhost:3000

# Check nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# Check app logs
journalctl -u lfr-dashboard -f
```

## Troubleshooting

### App not starting
```bash
# Check logs
journalctl -u lfr-dashboard -n 50

# Try running manually to see errors
cd /root/lfr-dashboard
npm start
```

### nginx showing default page
```bash
# Make sure your config is enabled
ls -la /etc/nginx/sites-enabled/

# Test nginx config
nginx -t

# Reload nginx
systemctl reload nginx
```

### Cloudflare tunnel not working
```bash
# Check cloudflared logs
journalctl -u cloudflared -f

# Test tunnel manually
cloudflared tunnel run lfr-dashboard
```

### Port 3000 not accessible
```bash
# Check if app is running
netstat -tlnp | grep 3000

# Check firewall
ufw status
ufw allow 3000/tcp
```

## Updating the app

```bash
cd /root/lfr-dashboard
git pull  # or upload new files
npm install
npm run build
systemctl restart lfr-dashboard
```

## Firewall setup (if using ufw)

```bash
# Allow SSH
ufw allow 22/tcp

# Allow HTTP/HTTPS (if not using cloudflared)
ufw allow 80/tcp
ufw allow 443/tcp

# Enable firewall
ufw enable
```

## Security Notes

1. **Don't expose port 3000 directly** - Use nginx as reverse proxy
2. **Use Cloudflare tunnel** - Provides HTTPS and DDoS protection
3. **Keep system updated** - `apt update && apt upgrade`
4. **Use strong passwords** - Change default root password
5. **Set up SSH keys** - Disable password authentication if possible
