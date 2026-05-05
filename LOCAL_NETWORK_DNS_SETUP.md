# Local Network DNS Setup for lfrpro.com

Your server is now configured to be accessible on your local network at **10.0.0.15:3000**

## Option 1: Router DNS (EASIEST - Recommended)

Most modern routers allow you to set custom DNS entries. This is the best option for your employees.

### Steps:

1. **Access your router admin panel:**
   - Usually at `http://192.168.1.1` or `http://10.0.0.1`
   - Check your router's manual for the exact IP

2. **Find DNS/Hosts settings:**
   - Look for "Local DNS", "Static DNS", "Hosts", or "DNS Override"
   - Common locations: Advanced → DNS → Local DNS or Network → DNS

3. **Add DNS entry:**
   - **Hostname:** `lfrpro.com`
   - **IP Address:** `10.0.0.15`
   - Also add: `www.lfrpro.com` → `10.0.0.15`

4. **Save and restart router** (if required)

5. **Employees connect:**
   - Employees just need to be on the same WiFi/network
   - They can access: `http://lfrpro.com:3000`

## Option 2: Install dnsmasq (Advanced)

If your router doesn't support custom DNS, you can run a DNS server on your Mac.

### Install Homebrew (if not installed):
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

### Install dnsmasq:
```bash
brew install dnsmasq
```

### Configure dnsmasq:
```bash
# Create config file
sudo nano /usr/local/etc/dnsmasq.conf
```

Add these lines:
```
address=/lfrpro.com/10.0.0.15
address=/www.lfrpro.com/10.0.0.15
listen-address=10.0.0.15
```

### Start dnsmasq:
```bash
sudo brew services start dnsmasq
```

### Configure employees' devices:
- **Mac:** System Settings → Network → WiFi → Details → DNS → Add `10.0.0.15` as first DNS server
- **Windows:** Network Settings → Change adapter options → Properties → IPv4 → Use DNS: `10.0.0.15`
- **iPhone/Android:** WiFi settings → DNS → Manual → Add `10.0.0.15`

## Option 3: Manual Hosts File (Simple but requires setup on each device)

Each employee needs to edit their hosts file:

### On Mac:
```bash
sudo nano /etc/hosts
```
Add:
```
10.0.0.15    lfrpro.com
10.0.0.15    www.lfrpro.com
```

### On Windows:
1. Open Notepad as Administrator
2. Open: `C:\Windows\System32\drivers\etc\hosts`
3. Add:
```
10.0.0.15    lfrpro.com
10.0.0.15    www.lfrpro.com
```

### On iPhone/Android:
- Use a hosts file editor app (like "Hosts Go" for Android)
- Or use a VPN app that supports custom DNS

## Option 4: Use IP Address Directly (No DNS needed)

Simplest option - employees just use:
- **http://10.0.0.15:3000**

No DNS setup required, but they'll need to remember the IP address.

## Start Your Server

Make sure your server is running and accessible on the network:

```bash
npm run dev
```

The server is now configured to accept connections from any device on your network.

## Verify Setup

1. **On your Mac:** Open `http://lfrpro.com:3000` (should work after hosts file setup)
2. **On employee device:** Open `http://lfrpro.com:3000` (after DNS/router setup)
3. **Or test with IP:** `http://10.0.0.15:3000` (should work immediately)

## Troubleshooting

### Server not accessible from other devices:
- Check firewall: System Settings → Network → Firewall → Allow incoming connections
- Make sure devices are on the same network
- Try accessing via IP first: `http://10.0.0.15:3000`

### DNS not resolving:
- Clear DNS cache on employee devices
- Mac: `sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder`
- Windows: `ipconfig /flushdns`
- Restart browser or device

### Port 3000 blocked:
- Check if port 3000 is open: `lsof -ti:3000`
- Make sure Next.js is running: `npm run dev`

## Recommended Setup

**For easiest employee access, use Option 1 (Router DNS):**
- One-time setup on router
- All employees automatically get DNS resolution
- No configuration needed on employee devices
- Works for all devices (phones, tablets, laptops)

